const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async function (event) {
  var payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    console.error('submission-created: failed to parse body:', err && err.message ? err.message : err);
    return { statusCode: 200, body: 'ok' };
  }

  // Only handle rider registration form; silently ignore all others
  if (!payload || payload.form_name !== 'rider-registration') {
    return { statusCode: 200, body: 'ok' };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('submission-created: Supabase env vars not set');
    return { statusCode: 200, body: 'ok' };
  }

  var d = payload.data || {};

  var row = {
    netlify_submission_id: payload.id || null,
    rider_first:         d['rider-first']          || null,
    rider_last:          d['rider-last']            || null,
    rider_grade:         d['rider-grade']           || null,
    rider_dob:           d['rider-dob']             || null,
    rider_category:      d['rider-gender']          || null,
    rider_experience:    d['rider-experience']      || null,
    returning_rider:     d['rider-returning']       || null,
    parent_first:        d['parent-first']          || null,
    parent_last:         d['parent-last']           || null,
    parent_email:        d['parent-email']          || null,
    parent_phone:        d['parent-phone']          || null,
    parent_relationship: d['parent-relationship']   || null,
    emerg_name:          d['emergency-name']        || null,
    emerg_phone:         d['emergency-phone']       || null,
    emerg_relationship:  d['emergency-relationship']|| null,
    medical_notes:       d['allergies']             || null,
    bike_type:           d['bike-type']             || null,
    additional_notes:    d['notes']                 || null,
    status:              'pending',
    source:              'netlify-form',
    raw_payload:         d
  };

  // rider_first and parent_email are NOT NULL — skip insert if missing
  if (!row.rider_first || !row.parent_email) {
    console.error('submission-created: missing required fields (rider_first or parent_email), skipping insert');
    return { statusCode: 200, body: 'ok' };
  }

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  try {
    // Upsert on netlify_submission_id prevents duplicate rows if Netlify
    // retries the event after a network timeout where the insert already ran.
    var result = await supabase
      .from('registrations')
      .upsert([row], { onConflict: 'netlify_submission_id', ignoreDuplicates: true });

    if (result.error) {
      console.error('submission-created: Supabase upsert error:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details
      });
    }
  } catch (err) {
    console.error('submission-created: unexpected error during upsert:', err && err.message ? err.message : err);
  }

  // Always return 200 — non-200 causes Netlify to retry indefinitely
  return { statusCode: 200, body: 'ok' };
};
