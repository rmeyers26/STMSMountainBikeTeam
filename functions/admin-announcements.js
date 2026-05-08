const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const TABLE_NAME = 'announcements';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

var VALID_TAGS = [
  'Pre-Season Training', 'Practice', 'Race Day', 'Championship',
  'Deadline', 'Team Event', 'Parent Event', 'Sponsor', 'General'
];

function authenticate(event) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return {
      ok: false,
      response: jsonResponse(500, {
        ok: false,
        error: 'Admin announcements is not configured.',
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

function parseBody(event) {
  try {
    return { ok: true, body: JSON.parse(event.body || '{}') };
  } catch (_) {
    return { ok: false, response: jsonResponse(400, { ok: false, error: 'Invalid JSON body.' }) };
  }
}

exports.handler = async function (event) {
  var method = event.httpMethod;

  // ── GET: list all announcements (admin sees inactive rows too) ──────────────
  if (method === 'GET') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;

    var result;
    try {
      result = await auth.supabase
        .from(TABLE_NAME)
        .select('id, created_at, updated_at, event_date, event_time, title, tag, location, note, sort_order, is_active, expires_at')
        .order('event_date', { ascending: true })
        .order('sort_order', { ascending: true })
        .limit(200);
    } catch (error) {
      console.error('admin-announcements GET exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error loading announcements.' });
    }

    if (result.error) {
      console.error('admin-announcements GET query failed:', result.error);
      return jsonResponse(500, { ok: false, error: 'Unable to load announcements right now.' });
    }

    return jsonResponse(200, { ok: true, announcements: result.data || [] });
  }

  // ── POST: create new announcement ──────────────────────────────────────────
  if (method === 'POST') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;

    var parsed = parseBody(event);
    if (!parsed.ok) return parsed.response;
    var body = parsed.body;

    var eventDate = (body.event_date || '').trim();
    if (!eventDate || !DATE_RE.test(eventDate)) {
      return jsonResponse(400, { ok: false, error: 'A valid event_date (YYYY-MM-DD) is required.' });
    }

    var title = (body.title || '').trim();
    if (!title) {
      return jsonResponse(400, { ok: false, error: 'title is required.' });
    }
    if (title.length > 200) {
      return jsonResponse(400, { ok: false, error: 'title must be 200 characters or fewer.' });
    }

    var tag = (body.tag || '').trim();
    if (VALID_TAGS.indexOf(tag) === -1) {
      return jsonResponse(400, { ok: false, error: 'Invalid tag value.' });
    }

    var sortOrder = typeof body.sort_order === 'number' ? Math.max(0, Math.floor(body.sort_order)) : 0;

    var expiresAt = null;
    if (body.expires_at) {
      var d = new Date(body.expires_at);
      if (isNaN(d.getTime())) {
        return jsonResponse(400, { ok: false, error: 'Invalid expires_at value.' });
      }
      expiresAt = d.toISOString();
    }

    var insertData = {
      event_date: eventDate,
      event_time: (body.event_time || '').trim() || null,
      title: title,
      tag: tag,
      location: (body.location || '').trim() || null,
      note: (body.note || '').trim() || null,
      sort_order: sortOrder,
      is_active: true,
      expires_at: expiresAt
    };

    var insertResult;
    try {
      insertResult = await auth.supabase
        .from(TABLE_NAME)
        .insert(insertData)
        .select('id');
    } catch (error) {
      console.error('admin-announcements POST exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error while creating the announcement.' });
    }

    if (insertResult.error) {
      console.error('admin-announcements POST failed:', insertResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to create the announcement right now.' });
    }

    return jsonResponse(201, { ok: true, id: insertResult.data[0].id });
  }

  // ── PATCH: update an existing announcement ─────────────────────────────────
  if (method === 'PATCH') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;

    var parsed = parseBody(event);
    if (!parsed.ok) return parsed.response;
    var body = parsed.body;

    var id = body.id;
    if (!id || !UUID_RE.test(id)) {
      return jsonResponse(400, { ok: false, error: 'A valid announcement id is required.' });
    }

    var updateData = {};

    if (body.event_date !== undefined) {
      var eventDate = (body.event_date || '').trim();
      if (!eventDate || !DATE_RE.test(eventDate)) {
        return jsonResponse(400, { ok: false, error: 'A valid event_date (YYYY-MM-DD) is required.' });
      }
      updateData.event_date = eventDate;
    }

    if (body.title !== undefined) {
      var title = (body.title || '').trim();
      if (!title) return jsonResponse(400, { ok: false, error: 'title is required.' });
      if (title.length > 200) return jsonResponse(400, { ok: false, error: 'title must be 200 characters or fewer.' });
      updateData.title = title;
    }

    if (body.tag !== undefined) {
      var tag = (body.tag || '').trim();
      if (VALID_TAGS.indexOf(tag) === -1) return jsonResponse(400, { ok: false, error: 'Invalid tag value.' });
      updateData.tag = tag;
    }

    if (body.event_time !== undefined) updateData.event_time = (body.event_time || '').trim() || null;
    if (body.location !== undefined)   updateData.location   = (body.location || '').trim() || null;
    if (body.note !== undefined)       updateData.note       = (body.note || '').trim() || null;

    if (body.sort_order !== undefined) {
      updateData.sort_order = typeof body.sort_order === 'number' ? Math.max(0, Math.floor(body.sort_order)) : 0;
    }

    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    if (body.expires_at !== undefined) {
      if (body.expires_at === null || body.expires_at === '') {
        updateData.expires_at = null;
      } else {
        var d = new Date(body.expires_at);
        if (isNaN(d.getTime())) return jsonResponse(400, { ok: false, error: 'Invalid expires_at value.' });
        updateData.expires_at = d.toISOString();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return jsonResponse(400, { ok: false, error: 'No fields provided to update.' });
    }

    var updateResult;
    try {
      updateResult = await auth.supabase
        .from(TABLE_NAME)
        .update(updateData)
        .eq('id', id)
        .select('id');
    } catch (error) {
      console.error('admin-announcements PATCH exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error while updating the announcement.' });
    }

    if (updateResult.error) {
      console.error('admin-announcements PATCH failed:', updateResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to update the announcement right now.' });
    }

    if (!updateResult.data || updateResult.data.length === 0) {
      return jsonResponse(404, { ok: false, error: 'Announcement not found.' });
    }

    return jsonResponse(200, { ok: true });
  }

  // ── DELETE: soft delete (archive) an announcement ──────────────────────────
  if (method === 'DELETE') {
    var auth = authenticate(event);
    if (!auth.ok) return auth.response;

    var parsed = parseBody(event);
    if (!parsed.ok) return parsed.response;
    var body = parsed.body;

    var id = body.id;
    if (!id || !UUID_RE.test(id)) {
      return jsonResponse(400, { ok: false, error: 'A valid announcement id is required.' });
    }

    var archiveResult;
    try {
      archiveResult = await auth.supabase
        .from(TABLE_NAME)
        .update({ is_active: false })
        .eq('id', id)
        .select('id');
    } catch (error) {
      console.error('admin-announcements DELETE exception:', error && error.message ? error.message : error);
      return jsonResponse(500, { ok: false, error: 'Unexpected error while archiving the announcement.' });
    }

    if (archiveResult.error) {
      console.error('admin-announcements DELETE failed:', archiveResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to archive the announcement right now.' });
    }

    if (!archiveResult.data || archiveResult.data.length === 0) {
      return jsonResponse(404, { ok: false, error: 'Announcement not found.' });
    }

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
};
