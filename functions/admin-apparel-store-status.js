const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');
const {
  SETTINGS_TABLE,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  createSupabaseClient,
  defaultStoreOpen,
  toBoolean,
  readApparelStoreStatus,
  writeApparelStoreStatus
} = require('./apparel-store-settings');

const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return jsonResponse(500, {
      ok: false,
      error: 'Admin store settings are not configured.',
      hint: 'Set Supabase and admin token environment variables in Netlify and redeploy.'
    });
  }

  var token = getBearerToken(event.headers || {});
  var verification = verifyToken(token, TOKEN_SECRET);
  if (!verification.ok) {
    return jsonResponse(401, { ok: false, error: verification.error });
  }

  var supabase = createSupabaseClient();
  if (!supabase) {
    return jsonResponse(500, {
      ok: false,
      error: 'Supabase environment variables are not configured.',
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify site environment variables, then redeploy.'
    });
  }

  if (event.httpMethod === 'GET') {
    try {
      var currentStatus = await readApparelStoreStatus(supabase);
      return jsonResponse(200, {
        ok: true,
        isOpen: currentStatus.isOpen,
        source: currentStatus.source,
        updatedAt: currentStatus.updatedAt,
        updatedBy: currentStatus.updatedBy,
        defaultOpen: defaultStoreOpen()
      });
    } catch (error) {
      console.error('admin-apparel-store-status GET failed:', {
        message: error && error.message,
        code: error && error.code,
        details: error && error.details,
        hint: error && error.hint,
        table: SETTINGS_TABLE
      });
      return jsonResponse(500, {
        ok: false,
        error: 'Unable to load apparel store status.',
        hint: 'Ensure the settings table exists and includes setting_key + setting_value columns.'
      });
    }
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body.' });
  }

  if (body.isOpen == null) {
    return jsonResponse(400, { ok: false, error: 'isOpen is required.' });
  }

  var nextIsOpen = toBoolean(body.isOpen, false);
  var updatedBy = verification.payload && verification.payload.sub ? verification.payload.sub : 'admin';

  try {
    var updatedStatus = await writeApparelStoreStatus(supabase, nextIsOpen, updatedBy);
    return jsonResponse(200, {
      ok: true,
      isOpen: updatedStatus.isOpen,
      source: updatedStatus.source,
      updatedAt: updatedStatus.updatedAt,
      updatedBy: updatedStatus.updatedBy
    });
  } catch (error) {
    console.error('admin-apparel-store-status POST failed:', {
      message: error && error.message,
      code: error && error.code,
      details: error && error.details,
      hint: error && error.hint,
      table: SETTINGS_TABLE
    });
    return jsonResponse(500, {
      ok: false,
      error: 'Unable to update apparel store status.',
      hint: 'Ensure the settings table exists and supports upsert on setting_key.'
    });
  }
};
