const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const TABLE_NAME = 'sponsors';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

var VALID_TIERS = ['gold', 'silver', 'bronze', 'community'];

function authenticate(event) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return {
      ok: false,
      response: jsonResponse(500, {
        ok: false,
        error: 'Admin sponsors is not configured.',
        hint: 'Set Supabase and admin token environment variables in Netlify and redeploy.'
      })
    };
  }

  var token = getBearerToken(event.headers || {});
  var verification = verifyToken(token, TOKEN_SECRET);
  if (!verification.ok) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: verification.error }) };
  }

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  return { ok: true, supabase: supabase };
}

function parseBody(event) {
  try {
    return { ok: true, body: JSON.parse(event.body || '{}') };
  } catch (_) {
    return { ok: false, response: jsonResponse(400, { ok: false, error: 'Invalid JSON body.' }) };
  }
}

exports.handler = async function (event) {
  var method = event.httpMethod;

  // ── GET: list all sponsors (admin sees inactive too) ────────────────────────
  if (method === 'GET') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;

    var result;
    try {
      result = await auth.supabase
        .from(TABLE_NAME)
        .select('id, created_at, updated_at, tier, name, description, website_url, logo_url, logo_text, sort_order, is_active')
        .order('tier', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
    } catch (error) {
      console.error('admin-sponsors GET exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error loading sponsors.' });
    }

    if (result.error) {
      console.error('admin-sponsors GET query failed:', result.error);
      return jsonResponse(500, { ok: false, error: 'Unable to load sponsors right now.' });
    }

    return jsonResponse(200, { ok: true, sponsors: result.data || [] });
  }

  // ── POST: create new sponsor ────────────────────────────────────────────────
  if (method === 'POST') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;

    var parsed = parseBody(event);
    if (!parsed.ok) return parsed.response;
    var body = parsed.body;

    var name = (body.name || '').trim();
    if (!name) return jsonResponse(400, { ok: false, error: 'name is required.' });
    if (name.length > 100) return jsonResponse(400, { ok: false, error: 'name must be 100 characters or fewer.' });

    var tier = (body.tier || '').trim().toLowerCase();
    if (VALID_TIERS.indexOf(tier) === -1) {
      return jsonResponse(400, { ok: false, error: 'Invalid tier. Must be gold, silver, bronze, or community.' });
    }

    var sortOrder = typeof body.sort_order === 'number' ? Math.max(0, Math.floor(body.sort_order)) : 0;

    var insertData = {
      tier: tier,
      name: name,
      description: (body.description || '').trim() || null,
      website_url: (body.website_url || '').trim() || null,
      logo_url:   (body.logo_url || '').trim() || null,
      logo_text:  (body.logo_text || '').trim() || null,
      sort_order: sortOrder,
      is_active: true
    };

    var insertResult;
    try {
      insertResult = await auth.supabase
        .from(TABLE_NAME)
        .insert(insertData)
        .select('id');
    } catch (error) {
      console.error('admin-sponsors POST exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error while creating the sponsor.' });
    }

    if (insertResult.error) {
      console.error('admin-sponsors POST failed:', insertResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to create the sponsor right now.' });
    }

    return jsonResponse(201, { ok: true, id: insertResult.data[0].id });
  }

  // ── PATCH: update a sponsor ─────────────────────────────────────────────────
  if (method === 'PATCH') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;

    var parsed = parseBody(event);
    if (!parsed.ok) return parsed.response;
    var body = parsed.body;

    var id = body.id;
    if (!id || !UUID_RE.test(id)) {
      return jsonResponse(400, { ok: false, error: 'A valid sponsor id is required.' });
    }

    var updateData = {};

    if (body.name !== undefined) {
      var name = (body.name || '').trim();
      if (!name) return jsonResponse(400, { ok: false, error: 'name is required.' });
      if (name.length > 100) return jsonResponse(400, { ok: false, error: 'name must be 100 characters or fewer.' });
      updateData.name = name;
    }

    if (body.tier !== undefined) {
      var tier = (body.tier || '').trim().toLowerCase();
      if (VALID_TIERS.indexOf(tier) === -1) {
        return jsonResponse(400, { ok: false, error: 'Invalid tier.' });
      }
      updateData.tier = tier;
    }

    if (body.description !== undefined) updateData.description = (body.description || '').trim() || null;
    if (body.website_url !== undefined) updateData.website_url = (body.website_url || '').trim() || null;
    if (body.logo_url !== undefined)    updateData.logo_url    = (body.logo_url || '').trim() || null;
    if (body.logo_text !== undefined)   updateData.logo_text   = (body.logo_text || '').trim() || null;

    if (body.sort_order !== undefined) {
      updateData.sort_order = typeof body.sort_order === 'number' ? Math.max(0, Math.floor(body.sort_order)) : 0;
    }

    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    if (Object.keys(updateData).length === 0) {
      return jsonResponse(400, { ok: false, error: 'No fields provided to update.' });
    }

    var updateResult;
    try {
      updateResult = await auth.supabase
        .from(TABLE_NAME)
        .update(updateData)
        .eq('id', id)
        .select('id');
    } catch (error) {
      console.error('admin-sponsors PATCH exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error while updating the sponsor.' });
    }

    if (updateResult.error) {
      console.error('admin-sponsors PATCH failed:', updateResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to update the sponsor right now.' });
    }

    if (!updateResult.data || updateResult.data.length === 0) {
      return jsonResponse(404, { ok: false, error: 'Sponsor not found.' });
    }

    return jsonResponse(200, { ok: true });
  }

  // ── DELETE: soft delete (archive) ──────────────────────────────────────────
  if (method === 'DELETE') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;

    var parsed = parseBody(event);
    if (!parsed.ok) return parsed.response;
    var body = parsed.body;

    var id = body.id;
    if (!id || !UUID_RE.test(id)) {
      return jsonResponse(400, { ok: false, error: 'A valid sponsor id is required.' });
    }

    var archiveResult;
    try {
      archiveResult = await auth.supabase
        .from(TABLE_NAME)
        .update({ is_active: false })
        .eq('id', id)
        .select('id');
    } catch (error) {
      console.error('admin-sponsors DELETE exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error while removing the sponsor.' });
    }

    if (archiveResult.error) {
      console.error('admin-sponsors DELETE failed:', archiveResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to remove the sponsor right now.' });
    }

    if (!archiveResult.data || archiveResult.data.length === 0) {
      return jsonResponse(404, { ok: false, error: 'Sponsor not found.' });
    }

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
};
