const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const TABLE_NAME = process.env.SUPABASE_APPAREL_TABLE || 'apparel_orders';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return jsonResponse(500, {
      ok: false,
      error: 'Admin report is not configured.',
      hint: 'Set Supabase and admin token environment variables in Netlify and redeploy.'
    });
  }

  var token = getBearerToken(event.headers || {});
  var verification = verifyToken(token, TOKEN_SECRET);
  if (!verification.ok) {
    return jsonResponse(401, { ok: false, error: verification.error });
  }

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  var result;
  try {
    result = await supabase
      .from(TABLE_NAME)
      .select('id, created_at, contact_name, contact_email, rider_count, source, order_payload')
      .order('created_at', { ascending: false })
      .limit(250);
  } catch (error) {
    console.error('admin-orders unexpected query exception:', error && error.message ? error.message : error);
    return jsonResponse(500, {
      ok: false,
      error: 'Unexpected error while loading apparel orders.'
    });
  }

  if (result.error) {
    console.error('admin-orders query failed:', {
      message: result.error.message,
      code: result.error.code,
      details: result.error.details,
      hint: result.error.hint,
      table: TABLE_NAME
    });
    return jsonResponse(500, {
      ok: false,
      error: 'Unable to load apparel orders right now.'
    });
  }

  return jsonResponse(200, {
    ok: true,
    orders: result.data || []
  });
};