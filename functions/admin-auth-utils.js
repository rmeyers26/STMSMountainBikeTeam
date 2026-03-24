const crypto = require('crypto');

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  var normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }

  return Buffer.from(normalized, 'base64').toString('utf8');
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function signToken(payload, secret) {
  var payloadSegment = toBase64Url(JSON.stringify(payload));
  var signature = crypto
    .createHmac('sha256', secret)
    .update(payloadSegment)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return payloadSegment + '.' + signature;
}

function verifyToken(token, secret) {
  if (!token || token.indexOf('.') === -1) {
    return { ok: false, error: 'Missing or invalid token.' };
  }

  var parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false, error: 'Malformed token.' };
  }

  var payloadSegment = parts[0];
  var providedSignature = parts[1];
  var expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadSegment)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  var providedBuffer = Buffer.from(providedSignature);
  var expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { ok: false, error: 'Invalid token signature.' };
  }

  var payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadSegment));
  } catch (error) {
    return { ok: false, error: 'Unreadable token payload.' };
  }

  if (!payload || payload.role !== 'admin') {
    return { ok: false, error: 'Token role is not authorized.' };
  }

  if (!payload.exp || Date.now() >= payload.exp) {
    return { ok: false, error: 'Token has expired.' };
  }

  return { ok: true, payload: payload };
}

function getBearerToken(headers) {
  var authHeader = headers && (headers.authorization || headers.Authorization);
  if (!authHeader || authHeader.indexOf('Bearer ') !== 0) {
    return '';
  }

  return authHeader.slice(7).trim();
}

module.exports = {
  getBearerToken: getBearerToken,
  jsonResponse: jsonResponse,
  signToken: signToken,
  verifyToken: verifyToken
};