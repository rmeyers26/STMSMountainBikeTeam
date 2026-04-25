const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, verifyToken } = require('./admin-auth-utils');
const {
  createSupabaseClient,
  defaultStoreOpen,
  readApparelStoreStatus
} = require('./apparel-store-settings');

const TABLE_NAME = process.env.SUPABASE_APPAREL_TABLE || 'apparel_orders';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function toInt(value) {
  var parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Missing request body.';
  }

  var contact = payload.contact || {};
  if (!String(contact.firstName || '').trim()) return 'First name is required.';
  if (!String(contact.lastName || '').trim()) return 'Last name is required.';
  if (!String(contact.email || '').trim()) return 'Email is required.';
  if (!String(contact.customerType || '').trim()) return 'Order type (New or Returning) is required.';

  var riders = Array.isArray(payload.riders) ? payload.riders : [];
  if (!riders.length) return 'At least one rider is required.';

  for (var i = 0; i < riders.length; i++) {
    var rider = riders[i] || {};
    var riderName = String(rider.name || '').trim() || 'Rider ' + (i + 1);

    if (!String(rider.name || '').trim()) {
      return 'Each rider must have a name.';
    }
    if (!String(rider.role || '').trim()) {
      return riderName + ': ordering role is required.';
    }
    if (!String(rider.team || '').trim()) {
      return riderName + ': team selection is required.';
    }

    var topQty = toInt(rider.topQty);
    var bibQty = toInt(rider.bibQty);
    var tshirtQty = toInt(rider.tshirtQty);

    if (topQty < 0 || topQty > 1) {
      return riderName + ': top quantity must be 0 or 1.';
    }
    if (bibQty < 0 || bibQty > 1) {
      return riderName + ': bib quantity must be 0 or 1.';
    }
    if (tshirtQty < 0 || tshirtQty > 1) {
      return riderName + ': t-shirt quantity must be 0 or 1.';
    }

    if (rider.role === 'rider') {
      if (topQty <= 0) {
        return riderName + ': riders must order at least one top (jersey).';
      }
      if (bibQty <= 0) {
        return riderName + ': riders must order at least one bib.';
      }
    }

    if (topQty > 0 && !String(rider.topSize || '').trim()) {
      return riderName + ': top size is required when top quantity is greater than zero.';
    }
    if (bibQty > 0 && !String(rider.bibSize || '').trim()) {
      return riderName + ': bib size is required when bib quantity is greater than zero.';
    }
    if (tshirtQty > 0 && !String(rider.tshirtSize || '').trim()) {
      return riderName + ': t-shirt size is required when t-shirt quantity is greater than zero.';
    }
  }

  return null;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse(500, {
      ok: false,
      error: 'Supabase environment variables are not configured.',
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify site environment variables, then redeploy.'
    });
  }

  var payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body.' });
  }

  var supabaseForStatus = createSupabaseClient();
  var storeStatus = { isOpen: defaultStoreOpen() };
  if (supabaseForStatus) {
    try {
      storeStatus = await readApparelStoreStatus(supabaseForStatus);
    } catch (error) {
      console.error('submit-apparel store status lookup failed, using default:', {
        message: error && error.message,
        code: error && error.code,
        details: error && error.details,
        hint: error && error.hint
      });
    }
  }

  var source = String(payload && payload.source ? payload.source : 'apparel-form').trim();
  var isAdminManualEntry = source === 'admin-apparel-form';

  if (!storeStatus.isOpen) {
    if (isAdminManualEntry) {
      var token = getBearerToken(event.headers || {});
      var verification = verifyToken(token, TOKEN_SECRET);
      if (!verification.ok) {
        return jsonResponse(401, { ok: false, error: verification.error });
      }
    } else {
      return jsonResponse(403, {
        ok: false,
        error: 'Team apparel orders are currently closed. Please check back soon.'
      });
    }
  }

  var validationError = validatePayload(payload);
  if (validationError) {
    return jsonResponse(400, { ok: false, error: validationError });
  }

  var contact = payload.contact || {};
  var riders = Array.isArray(payload.riders) ? payload.riders : [];

  var row = {
    contact_email: String(contact.email || '').trim(),
    contact_name: (String(contact.firstName || '').trim() + ' ' + String(contact.lastName || '').trim()).trim(),
    rider_count: riders.length,
    source: 'apparel-form',
    order_payload: payload
  };

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  var result;
  try {
    result = await supabase.from(TABLE_NAME).insert(row).select('id').single();
  } catch (error) {
    console.error('submit-apparel unexpected insert exception:', error && error.message ? error.message : error);
    return jsonResponse(500, {
      ok: false,
      error: 'Unexpected Supabase error while saving the order.',
      hint: 'Check Netlify function logs for submit-apparel.'
    });
  }

  if (result.error) {
    console.error('submit-apparel insert failed:', {
      message: result.error.message,
      code: result.error.code,
      details: result.error.details,
      hint: result.error.hint,
      table: TABLE_NAME
    });
    return jsonResponse(500, {
      ok: false,
      error: 'Unable to save order right now. Please try again.',
      hint: 'Verify table exists, service role key is correct, and Netlify env vars are set on Production context.'
    });
  }

  return jsonResponse(200, {
    ok: true,
    orderId: result.data ? result.data.id : null
  });
};
