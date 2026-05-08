const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const BUCKET_NAME = 'sponsor-logos';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

var MAX_BYTES = 375 * 1024; // 375 KB decoded

var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Magic-byte signatures for each allowed type
var SIGNATURES = {
  'image/png':  [137, 80, 78, 71, 13, 10, 26, 10],
  'image/jpeg': [255, 216],
  'image/gif':  [71, 73, 70, 56],
  // WebP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
  'image/webp': [82, 73, 70, 70]
};

function matchesSignature(buf, contentType) {
  var sig = SIGNATURES[contentType];
  if (!sig) return false;
  for (var i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  // Extra check for WebP: bytes 8-11 must be "WEBP" (87,69,66,80)
  if (contentType === 'image/webp') {
    if (buf.length < 12) return false;
    if (buf[8] !== 87 || buf[9] !== 69 || buf[10] !== 66 || buf[11] !== 80) return false;
  }
  return true;
}

function sanitizeFilename(filename) {
  return String(filename || 'logo')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-_]/g, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, 100) || 'logo';
}

function authenticate(event) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return {
      ok: false,
      response: jsonResponse(500, {
        ok: false,
        error: 'Upload function is not configured.',
        hint: 'Set Supabase and admin token environment variables in Netlify and redeploy.'
      })
    };
  }

  var token = getBearerToken(event.headers || {});
  var verification = verifyToken(token, TOKEN_SECRET);
  if (!verification.ok) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: verification.error }) };
  }

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  return { ok: true, supabase: supabase };
}

// In-memory rate limiter: max 20 uploads per 5 minutes per IP
var uploadCounts = new Map();
var RATE_WINDOW_MS = 5 * 60 * 1000;
var RATE_LIMIT = 20;

function checkRateLimit(ip) {
  var now = Date.now();
  var entry = uploadCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    uploadCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  var auth = authenticate(event);
  if (!auth.ok) return auth.response;

  var ip = (event.headers && (event.headers['x-forwarded-for'] || event.headers['client-ip'])) || 'unknown';
  if (!checkRateLimit(ip)) {
    return jsonResponse(429, { ok: false, error: 'Too many uploads. Please wait a few minutes.' });
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body.' });
  }

  var filename    = body.filename    || '';
  var contentType = body.contentType || '';
  var data        = body.data        || '';  // base64, NO data: prefix

  if (ALLOWED_TYPES.indexOf(contentType) === -1) {
    return jsonResponse(400, { ok: false, error: 'Unsupported file type. Allowed: JPEG, PNG, GIF, WebP.' });
  }

  if (!data) {
    return jsonResponse(400, { ok: false, error: 'No image data provided.' });
  }

  var fileBuffer;
  try {
    fileBuffer = Buffer.from(data, 'base64');
  } catch (_) {
    return jsonResponse(400, { ok: false, error: 'Invalid base64 data.' });
  }

  // Validate decoded size
  if (fileBuffer.length > MAX_BYTES) {
    return jsonResponse(400, { ok: false, error: 'File is too large. Maximum size is 375 KB.' });
  }

  // Validate magic bytes match the declared content type
  if (!matchesSignature(fileBuffer, contentType)) {
    return jsonResponse(400, { ok: false, error: 'File content does not match the declared type.' });
  }

  var safeName = sanitizeFilename(filename);
  var storagePath = 'sponsors/' + Date.now() + '-' + safeName;

  var uploadResult;
  try {
    uploadResult = await auth.supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: contentType,
        upsert: false
      });
  } catch (error) {
    console.error('admin-upload-logo upload exception:', error && error.message ? error.message : error);
    return jsonResponse(500, { ok: false, error: 'Unexpected error during upload.' });
  }

  if (uploadResult.error) {
    console.error('admin-upload-logo upload failed:', uploadResult.error);
    return jsonResponse(500, { ok: false, error: 'Unable to upload file. Please try again.' });
  }

  var publicUrl = SUPABASE_URL.replace(/\/$/, '')
    + '/storage/v1/object/public/'
    + BUCKET_NAME + '/'
    + storagePath;

  return jsonResponse(200, { ok: true, url: publicUrl });
};
