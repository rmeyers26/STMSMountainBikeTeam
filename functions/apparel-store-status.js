const { jsonResponse } = require('./admin-auth-utils');
const {
  SETTINGS_TABLE,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  createSupabaseClient,
  defaultStoreOpen,
  readApparelStoreStatus
} = require('./apparel-store-settings');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse(200, {
      ok: true,
      isOpen: defaultStoreOpen(),
      source: 'default'
    });
  }

  var supabase = createSupabaseClient();
  if (!supabase) {
    return jsonResponse(200, {
      ok: true,
      isOpen: defaultStoreOpen(),
      source: 'default'
    });
  }

  try {
    var currentStatus = await readApparelStoreStatus(supabase);
    return jsonResponse(200, {
      ok: true,
      isOpen: currentStatus.isOpen,
      source: currentStatus.source,
      updatedAt: currentStatus.updatedAt
    });
  } catch (error) {
    console.error('apparel-store-status GET failed:', {
      message: error && error.message,
      code: error && error.code,
      details: error && error.details,
      hint: error && error.hint,
      table: SETTINGS_TABLE
    });

    return jsonResponse(200, {
      ok: true,
      isOpen: defaultStoreOpen(),
      source: 'default',
      warning: 'Store status lookup failed, using default value.'
    });
  }
};
