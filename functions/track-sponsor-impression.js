const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: '' };
  }

  var sponsorIds, page;
  try {
    var body = JSON.parse(event.body || '{}');
    sponsorIds = Array.isArray(body.sponsor_ids) ? body.sponsor_ids : [];
    page = typeof body.page === 'string' ? body.page.slice(0, 50) : 'unknown';
  } catch (e) {
    return { statusCode: 400, body: '' };
  }

  // Validate UUIDs and cap batch size
  var uuidRe = /^[0-9a-f-]{36}$/i;
  sponsorIds = sponsorIds.filter(function (id) {
    return typeof id === 'string' && uuidRe.test(id);
  }).slice(0, 50);

  if (!sponsorIds.length) {
    return { statusCode: 200, body: '' };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { statusCode: 200, body: '' };
  }

  try {
    var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });
    var rows = sponsorIds.map(function (id) {
      return { sponsor_id: id, event_type: 'impression', page: page };
    });
    await supabase.from('sponsor_events').insert(rows);
  } catch (e) {
    // Silently fail — tracking must not break the user experience
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
