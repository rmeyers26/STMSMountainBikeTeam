const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SETTINGS_TABLE = process.env.SUPABASE_SETTINGS_TABLE || 'app_settings';
const SETTINGS_KEY = 'apparel_orders_open';

function toBoolean(value, defaultValue) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    var normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  }
  return defaultValue;
}

function defaultStoreOpen() {
  var envValue = process.env.APPAREL_ORDERS_DEFAULT_OPEN;
  if (envValue == null || envValue === '') {
    return true;
  }
  return toBoolean(envValue, true);
}

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
}

function parseStoreSetting(settingValue) {
  if (settingValue && typeof settingValue === 'object' && settingValue.isOpen != null) {
    return toBoolean(settingValue.isOpen, defaultStoreOpen());
  }

  return toBoolean(settingValue, defaultStoreOpen());
}

async function readApparelStoreStatus(supabase) {
  var result = await supabase
    .from(SETTINGS_TABLE)
    .select('setting_value, updated_at, updated_by')
    .eq('setting_key', SETTINGS_KEY)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return {
      isOpen: defaultStoreOpen(),
      source: 'default',
      updatedAt: null,
      updatedBy: null
    };
  }

  return {
    isOpen: parseStoreSetting(result.data.setting_value),
    source: 'database',
    updatedAt: result.data.updated_at || null,
    updatedBy: result.data.updated_by || null
  };
}

async function writeApparelStoreStatus(supabase, isOpen, updatedBy) {
  var value = {
    isOpen: !!isOpen
  };

  var result = await supabase
    .from(SETTINGS_TABLE)
    .upsert({
      setting_key: SETTINGS_KEY,
      setting_value: value,
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' })
    .select('setting_value, updated_at, updated_by')
    .single();

  if (result.error) {
    throw result.error;
  }

  return {
    isOpen: parseStoreSetting(result.data && result.data.setting_value),
    source: 'database',
    updatedAt: result.data && result.data.updated_at ? result.data.updated_at : null,
    updatedBy: result.data && result.data.updated_by ? result.data.updated_by : null
  };
}

module.exports = {
  SETTINGS_KEY,
  SETTINGS_TABLE,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  createSupabaseClient,
  defaultStoreOpen,
  readApparelStoreStatus,
  toBoolean,
  writeApparelStoreStatus
};
