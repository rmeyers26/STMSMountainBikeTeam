const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const TABLE_NAME = process.env.SUPABASE_APPAREL_TABLE || 'apparel_orders';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verify the Bearer token and return an authenticated Supabase client.
 * Returns { ok: false, response } when auth fails so the handler can return early.
 */
function authenticate(event) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return {
      ok: false,
      response: jsonResponse(500, {
        ok: false,
        error: 'Admin report is not configured.',
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

exports.handler = async function (event) {
  var method = event.httpMethod;

  // ── GET: list orders ────────────────────────────────────────────────────────
  if (method === 'GET') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;
    var supabase = auth.supabase;

    var result;
    try {
      result = await supabase
        .from(TABLE_NAME)
        .select('id, created_at, contact_name, contact_email, rider_count, source, order_payload')
        .order('created_at', { ascending: false })
        .limit(250);
    } catch (error) {
      console.error('admin-orders GET exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error while loading apparel orders.' });
    }

    if (result.error) {
      console.error('admin-orders GET query failed:', result.error);
      return jsonResponse(500, { ok: false, error: 'Unable to load apparel orders right now.' });
    }

    return jsonResponse(200, { ok: true, orders: result.data || [] });
  }

  // ── PATCH: update an order ──────────────────────────────────────────────────
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

    var id = body.id;
    if (!id || !UUID_RE.test(id)) {
      return jsonResponse(400, { ok: false, error: 'A valid order id is required.' });
    }

    var payload = body.order_payload;
    if (!payload || typeof payload !== 'object') {
      return jsonResponse(400, { ok: false, error: 'order_payload is required.' });
    }

    var riders = Array.isArray(payload.riders) ? payload.riders : [];
    var riderCount = typeof body.rider_count === 'number' ? body.rider_count : riders.length;
    if (riderCount !== riders.length) {
      return jsonResponse(400, {
        ok: false,
        error: 'rider_count (' + riderCount + ') does not match the number of riders in order_payload (' + riders.length + ').'
      });
    }

    var contact = payload.contact || {};
    var contactName = ((contact.firstName || '') + ' ' + (contact.lastName || '')).trim();
    var contactEmail = (contact.email || '').trim();

    var updateResult;
    try {
      updateResult = await supabase
        .from(TABLE_NAME)
        .update({
          contact_name: contactName,
          contact_email: contactEmail,
          rider_count: riderCount,
          order_payload: payload
        })
        .eq('id', id)
        .select('id');
    } catch (error) {
      console.error('admin-orders PATCH exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error while updating the order.' });
    }

    if (updateResult.error) {
      console.error('admin-orders PATCH failed:', updateResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to update the order right now.' });
    }

    if (!updateResult.data || updateResult.data.length === 0) {
      return jsonResponse(404, { ok: false, error: 'Order not found.' });
    }

    return jsonResponse(200, { ok: true });
  }

  // ── DELETE: remove an order ─────────────────────────────────────────────────
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

    var id = body.id;
    if (!id || !UUID_RE.test(id)) {
      return jsonResponse(400, { ok: false, error: 'A valid order id is required.' });
    }

    var deleteResult;
    try {
      deleteResult = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id)
        .select('id');
    } catch (error) {
      console.error('admin-orders DELETE exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error while deleting the order.' });
    }

    if (deleteResult.error) {
      console.error('admin-orders DELETE failed:', deleteResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to delete the order right now.' });
    }

    if (!deleteResult.data || deleteResult.data.length === 0) {
      return jsonResponse(404, { ok: false, error: 'Order not found.' });
    }

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
};