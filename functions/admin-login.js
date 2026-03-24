const crypto = require('crypto');
const { jsonResponse, signToken } = require('./admin-auth-utils');

const PASSCODE = process.env.ADMIN_REPORT_PASSCODE || '';
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function hasValidSecrets() {
  return Boolean(PASSCODE && TOKEN_SECRET);
}

function safePasscodeMatch(input) {
  var provided = Buffer.from(String(input || ''));
  var expected = Buffer.from(PASSCODE);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!hasValidSecrets()) {
    return jsonResponse(500, {
      ok: false,
      error: 'Admin login is not configured.',
      hint: 'Set ADMIN_REPORT_PASSCODE and ADMIN_REPORT_TOKEN_SECRET in Netlify environment variables and redeploy.'
    });
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body.' });
  }

  var passcode = String(body.passcode || '');
  if (!passcode) {
    return jsonResponse(400, { ok: false, error: 'Passcode is required.' });
  }

  if (!safePasscodeMatch(passcode)) {
    return jsonResponse(401, { ok: false, error: 'Incorrect passcode.' });
  }

  var expiresAt = Date.now() + TOKEN_TTL_MS;
  var token = signToken({
    role: 'admin',
    issuedAt: Date.now(),
    exp: expiresAt
  }, TOKEN_SECRET);

  return jsonResponse(200, {
    ok: true,
    token: token,
    expiresAt: expiresAt
  });
};