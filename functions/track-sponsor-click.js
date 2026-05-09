const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: '' };
  }

  var sponsorId, page;
  try {
    var body = JSON.parse(event.body || '{}');
    sponsorId = body.sponsor_id;
    page = typeof body.page === 'string' ? body.page.slice(0, 50) : 'unknown';
  } catch (e) {
    return { statusCode: 400, body: '' };
  }

  // Basic UUID format check
  if (!sponsorId || !/^[0-9a-f-]{36}$/i.test(sponsorId)) {
    return { statusCode: 400, body: '' };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { statusCode: 200, body: '' };
  }

  try {
    var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });
    await supabase.from('sponsor_events').insert({
      sponsor_id: sponsorId,
      event_type: 'click',
      page: page
    });
  } catch (e) {
    // Silently fail — tracking must not break the user experience
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
