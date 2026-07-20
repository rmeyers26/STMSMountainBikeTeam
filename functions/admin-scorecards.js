const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

// The five score categories the scorecard grid supports.
const VALID_KEYS = ['handling', 'skills', 'fitness', 'safety', 'confidence'];
const TEXT_MAX = 5000;

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

function isValidSeason(year) {
  return !isNaN(year) && year >= 2000 && year <= 2100;
}

// Validate + normalize the scores object. Returns { ok, value } or { ok:false, error }.
function sanitizeScores(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Scores must be an object.' };
  }

  var clean = {};
  var catKeys = Object.keys(raw);
  for (var i = 0; i < catKeys.length; i++) {
    var catKey = catKeys[i];
    if (VALID_KEYS.indexOf(catKey) === -1) {
      return { ok: false, error: 'Unknown score category: ' + catKey };
    }

    var months = raw[catKey];
    if (typeof months !== 'object' || months === null || Array.isArray(months)) {
      return { ok: false, error: 'Scores for ' + catKey + ' must be an object.' };
    }

    var cleanMonths = {};
    var monthKeys = Object.keys(months);
    for (var j = 0; j < monthKeys.length; j++) {
      var mKey = monthKeys[j];
      var mIndex = parseInt(mKey, 10);
      if (String(mIndex) !== String(mKey) || mIndex < 0 || mIndex > 11) {
        return { ok: false, error: 'Invalid month index: ' + mKey };
      }

      var value = months[mKey];
      // Blank / null months are allowed (skip them).
      if (value === null || value === '' || value === undefined) continue;

      var score = typeof value === 'number' ? value : parseInt(value, 10);
      if (isNaN(score) || score < 1 || score > 5 || Math.floor(score) !== score) {
        return { ok: false, error: 'Scores must be integers 1–5.' };
      }
      cleanMonths[String(mIndex)] = score;
    }

    if (Object.keys(cleanMonths).length > 0) {
      clean[catKey] = cleanMonths;
    }
  }

  return { ok: true, value: clean };
}

function sanitizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value).slice(0, TEXT_MAX);
}

exports.handler = async function (event) {
  var method = event.httpMethod;

  // ── GET: load a single rider's scorecard for a season ───────────────────────
  if (method === 'GET') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;
    var supabase = auth.supabase;

    var params = event.queryStringParameters || {};
    var riderId = parseInt(params.rider_id, 10);
    var seasonYear = parseInt(params.season_year, 10);

    if (!riderId || isNaN(riderId) || riderId < 1) {
      return jsonResponse(400, { ok: false, error: 'A valid rider_id is required.' });
    }
    if (!isValidSeason(seasonYear)) {
      return jsonResponse(400, { ok: false, error: 'A valid season_year is required.' });
    }

    var result;
    try {
      result = await supabase
        .from('rider_scorecards')
        .select('scores, race_category, notes, goals, evaluator')
        .eq('rider_id', riderId)
        .eq('season_year', seasonYear)
        .maybeSingle();
    } catch (error) {
      console.error('admin-scorecards GET exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error loading scorecard.' });
    }

    if (result.error) {
      console.error('admin-scorecards GET error:', result.error);
      return jsonResponse(500, { ok: false, error: 'Unable to load scorecard.' });
    }

    return jsonResponse(200, { ok: true, scorecard: result.data || null });
  }

  // ── PUT: create or update (upsert) a rider's scorecard for a season ──────────
  if (method === 'PUT') {
    var putAuth = authenticate(event);
    if (!putAuth.ok) return putAuth.response;
    var db = putAuth.supabase;

    var body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body.' });
    }

    var rid = parseInt(body.rider_id, 10);
    var season = parseInt(body.season_year, 10);
    if (!rid || isNaN(rid) || rid < 1) {
      return jsonResponse(400, { ok: false, error: 'A valid rider_id is required.' });
    }
    if (!isValidSeason(season)) {
      return jsonResponse(400, { ok: false, error: 'A valid season_year is required.' });
    }

    var scoreCheck = sanitizeScores(body.scores);
    if (!scoreCheck.ok) {
      return jsonResponse(400, { ok: false, error: scoreCheck.error });
    }

    var row = {
      rider_id: rid,
      season_year: season,
      scores: scoreCheck.value,
      race_category: sanitizeText(body.race_category),
      notes: sanitizeText(body.notes),
      goals: sanitizeText(body.goals),
      evaluator: sanitizeText(body.evaluator),
      updated_at: new Date().toISOString()
    };

    var upsertResult;
    try {
      upsertResult = await db
        .from('rider_scorecards')
        .upsert(row, { onConflict: 'rider_id,season_year' })
        .select('id');
    } catch (error) {
      console.error('admin-scorecards PUT exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error saving scorecard.' });
    }

    if (upsertResult.error) {
      if (upsertResult.error.code === '23503') {
        return jsonResponse(400, { ok: false, error: 'That rider does not exist.' });
      }
      console.error('admin-scorecards PUT error:', upsertResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to save scorecard.' });
    }

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
};
