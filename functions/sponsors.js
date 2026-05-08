const { createClient } = require('@supabase/supabase-js');
const { jsonResponse } = require('./admin-auth-utils');

const TABLE_NAME = 'sponsors';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse(500, { ok: false, error: 'Sponsors data source is not configured.' });
  }

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  var result;
  try {
    result = await supabase
      .from(TABLE_NAME)
      .select('id, tier, name, description, website_url, logo_url, logo_text, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
  } catch (error) {
    console.error('sponsors GET exception:', error && error.message ? error.message : error);
    return jsonResponse(500, { ok: false, error: 'Unexpected error loading sponsors.' });
  }

  if (result.error) {
    console.error('sponsors GET query failed:', result.error);
    return jsonResponse(500, { ok: false, error: 'Unable to load sponsors right now.' });
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=120'
    },
    body: JSON.stringify({ ok: true, sponsors: result.data || [] })
  };
};
