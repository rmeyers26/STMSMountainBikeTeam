const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

function authenticate(event) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return {
      ok: false,
      response: jsonResponse(500, {
        ok: false,
        error: 'Server is not configured. Set Supabase env vars in Netlify.'
      })
    };
  }

  var token = getBearerToken(event.headers || {});
  var verification = verifyToken(token, TOKEN_SECRET);
  if (!verification.ok) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: verification.error }) };
  }

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return { ok: true, supabase: supabase };
}

exports.handler = async function (event) {
  var method = event.httpMethod;

  // ── GET: list riders for a season + available season years ─────────────────
  if (method === 'GET') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;
    var supabase = auth.supabase;

    var params = event.queryStringParameters || {};
    var seasonYear = parseInt(params.season_year, 10);
    if (isNaN(seasonYear) || seasonYear < 2000 || seasonYear > 2100) {
      seasonYear = new Date().getFullYear();
    }

    var ridersResult, seasonsResult;
    try {
      var results = await Promise.all([
        supabase
          .from('riders')
          .select('id, first_name, last_name, bib_number, category_id, season_year, categories(name)')
          .eq('season_year', seasonYear)
          .order('last_name', { ascending: true })
          .order('first_name', { ascending: true }),
        supabase
          .from('riders')
          .select('season_year')
          .order('season_year', { ascending: false })
      ]);
      ridersResult = results[0];
      seasonsResult = results[1];
    } catch (error) {
      console.error('admin-riders GET exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error loading riders.' });
    }

    if (ridersResult.error) {
      console.error('admin-riders GET riders error:', ridersResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to load riders.' });
    }

    if (seasonsResult.error) {
      console.error('admin-riders GET seasons error:', seasonsResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to load season list.' });
    }

    var seenYears = {};
    var currentYear = new Date().getFullYear();
    var seasons = (seasonsResult.data || []).reduce(function (acc, row) {
      if (!seenYears[row.season_year]) {
        seenYears[row.season_year] = true;
        acc.push(row.season_year);
      }
      return acc;
    }, []);

    if (!seenYears[currentYear]) seasons.unshift(currentYear);

    return jsonResponse(200, { ok: true, riders: ridersResult.data || [], seasons: seasons });
  }

  // ── POST: create rider ──────────────────────────────────────────────────────
  if (method === 'POST') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;
    var supabase = auth.supabase;

    var body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body.' });
    }

    var firstName = (body.first_name || '').trim();
    var lastName = (body.last_name || '').trim();
    var categoryId = parseInt(body.category_id, 10);
    var seasonYear = parseInt(body.season_year, 10);
    var bibNumber = (body.bib_number || '').trim() || null;

    if (!firstName) return jsonResponse(400, { ok: false, error: 'First name is required.' });
    if (!lastName) return jsonResponse(400, { ok: false, error: 'Last name is required.' });
    if (!categoryId || isNaN(categoryId)) return jsonResponse(400, { ok: false, error: 'A valid category is required.' });
    if (!seasonYear || isNaN(seasonYear) || seasonYear < 2000 || seasonYear > 2100) {
      return jsonResponse(400, { ok: false, error: 'A valid season year is required.' });
    }

    var result;
    try {
      result = await supabase
        .from('riders')
        .insert({
          first_name: firstName,
          last_name: lastName,
          bib_number: bibNumber,
          category_id: categoryId,
          season_year: seasonYear
        })
        .select('id');
    } catch (error) {
      console.error('admin-riders POST exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error creating rider.' });
    }

    if (result.error) {
      if (result.error.code === '23505') {
        return jsonResponse(409, {
          ok: false,
          error: 'Bib number ' + bibNumber + ' is already assigned to another rider in ' + seasonYear + '.'
        });
      }
      console.error('admin-riders POST error:', result.error);
      return jsonResponse(500, { ok: false, error: 'Unable to create rider.' });
    }

    return jsonResponse(201, { ok: true, id: result.data[0].id });
  }

  // ── PATCH: update rider ─────────────────────────────────────────────────────
  if (method === 'PATCH') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;
    var supabase = auth.supabase;

    var body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body.' });
    }

    var id = parseInt(body.id, 10);
    if (!id || isNaN(id)) return jsonResponse(400, { ok: false, error: 'A valid rider id is required.' });

    var updates = {};
    if (body.first_name !== undefined) {
      var fn = (body.first_name || '').trim();
      if (!fn) return jsonResponse(400, { ok: false, error: 'First name cannot be empty.' });
      updates.first_name = fn;
    }
    if (body.last_name !== undefined) {
      var ln = (body.last_name || '').trim();
      if (!ln) return jsonResponse(400, { ok: false, error: 'Last name cannot be empty.' });
      updates.last_name = ln;
    }
    if (body.category_id !== undefined) {
      var catId = parseInt(body.category_id, 10);
      if (!catId || isNaN(catId)) return jsonResponse(400, { ok: false, error: 'A valid category is required.' });
      updates.category_id = catId;
    }
    if (body.season_year !== undefined) {
      var sy = parseInt(body.season_year, 10);
      if (isNaN(sy) || sy < 2000 || sy > 2100) return jsonResponse(400, { ok: false, error: 'A valid season year is required.' });
      updates.season_year = sy;
    }
    if (body.bib_number !== undefined) {
      updates.bib_number = (body.bib_number || '').trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return jsonResponse(400, { ok: false, error: 'No fields to update.' });
    }

    var result;
    try {
      result = await supabase
        .from('riders')
        .update(updates)
        .eq('id', id)
        .select('id');
    } catch (error) {
      console.error('admin-riders PATCH exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error updating rider.' });
    }

    if (result.error) {
      if (result.error.code === '23505') {
        return jsonResponse(409, { ok: false, error: 'That bib number is already assigned to another rider in that season.' });
      }
      console.error('admin-riders PATCH error:', result.error);
      return jsonResponse(500, { ok: false, error: 'Unable to update rider.' });
    }

    if (!result.data || result.data.length === 0) {
      return jsonResponse(404, { ok: false, error: 'Rider not found.' });
    }

    return jsonResponse(200, { ok: true });
  }

  // ── DELETE: remove rider ────────────────────────────────────────────────────
  if (method === 'DELETE') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;
    var supabase = auth.supabase;

    var body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body.' });
    }

    var id = parseInt(body.id, 10);
    if (!id || isNaN(id)) return jsonResponse(400, { ok: false, error: 'A valid rider id is required.' });

    var result;
    try {
      result = await supabase
        .from('riders')
        .delete()
        .eq('id', id)
        .select('id');
    } catch (error) {
      console.error('admin-riders DELETE exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error deleting rider.' });
    }

    if (result.error) {
      console.error('admin-riders DELETE error:', result.error);
      return jsonResponse(500, { ok: false, error: 'Unable to delete rider.' });
    }

    if (!result.data || result.data.length === 0) {
      return jsonResponse(404, { ok: false, error: 'Rider not found.' });
    }

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
};
