const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return jsonResponse(500, { ok: false, error: 'Server is not configured. Set Supabase env vars in Netlify.' });
  }

  var token = getBearerToken(event.headers || {});
  var verification = verifyToken(token, TOKEN_SECRET);
  if (!verification.ok) {
    return jsonResponse(401, { ok: false, error: verification.error });
  }

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  var result;
  try {
    var seedResult = await supabase
      .from('categories')
      .upsert([{ name: 'Coach', sort_order: 18 }], { onConflict: 'name', ignoreDuplicates: true });

    if (seedResult.error) {
      console.error('admin-categories seed error:', seedResult.error);
    }

    result = await supabase
      .from('categories')
      .select('id, name')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
  } catch (error) {
    console.error('admin-categories GET exception:', error && error.message ? error.message : error);
    return jsonResponse(500, { ok: false, error: 'Unexpected error loading categories.' });
  }

  if (result.error) {
    console.error('admin-categories GET error:', result.error);
    return jsonResponse(500, { ok: false, error: 'Unable to load categories.' });
  }

  return jsonResponse(200, { ok: true, categories: result.data || [] });
};
