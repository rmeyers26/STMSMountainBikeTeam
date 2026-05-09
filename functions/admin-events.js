const { createClient } = require('@supabase/supabase-js');
const { getBearerToken, jsonResponse, verifyToken } = require('./admin-auth-utils');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOKEN_SECRET = process.env.ADMIN_REPORT_TOKEN_SECRET || '';

function authenticate(event) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOKEN_SECRET) {
    return { ok: false, response: jsonResponse(500, { ok: false, error: 'Server is not configured.' }) };
  }
  var token = getBearerToken(event.headers || {});
  var verification = verifyToken(token, TOKEN_SECRET);
  if (!verification.ok) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: verification.error }) };
  }
  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return { ok: true, supabase };
}

exports.handler = async function (event) {
  var method = event.httpMethod;
  var auth = authenticate(event);
  if (!auth.ok) return auth.response;
  var supabase = auth.supabase;

  // ── GET: list events, or single event with participants ────────────────────
  if (method === 'GET') {
    var params = event.queryStringParameters || {};

    if (params.event_id) {
      var eventId = parseInt(params.event_id, 10);
      if (isNaN(eventId)) return jsonResponse(400, { ok: false, error: 'Invalid event_id.' });

      var [evResult, partResult] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase
          .from('event_participants')
          .select('rider_id, status, riders(id, first_name, last_name, bib_number, category_id, categories(name))')
          .eq('event_id', eventId)
          .order('rider_id', { ascending: true })
      ]);

      if (evResult.error) return jsonResponse(404, { ok: false, error: 'Event not found.' });
      if (partResult.error) return jsonResponse(500, { ok: false, error: 'Unable to load participants.' });

      return jsonResponse(200, { ok: true, event: evResult.data, participants: partResult.data || [] });
    }

    // List all events
    var listResult = await supabase
      .from('events')
      .select('id, name, event_date, laps, lap_distance_km, status, started_at, created_at')
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (listResult.error) return jsonResponse(500, { ok: false, error: 'Unable to load events.' });

    // Attach participant counts
    var eventIds = (listResult.data || []).map(function (e) { return e.id; });
    var counts = {};
    if (eventIds.length) {
      var countResult = await supabase
        .from('event_participants')
        .select('event_id')
        .in('event_id', eventIds);
      if (!countResult.error) {
        (countResult.data || []).forEach(function (row) {
          counts[row.event_id] = (counts[row.event_id] || 0) + 1;
        });
      }
    }

    var events = (listResult.data || []).map(function (e) {
      return Object.assign({}, e, { participant_count: counts[e.id] || 0 });
    });

    return jsonResponse(200, { ok: true, events });
  }

  // ── POST: create event + add participants ───────────────────────────────────
  if (method === 'POST') {
    var body;
    try { body = JSON.parse(event.body || '{}'); } catch (_) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON.' });
    }

    var name = (body.name || '').trim();
    var eventDate = (body.event_date || '').trim();
    var laps = parseInt(body.laps, 10);
    var lapDist = body.lap_distance_km ? parseFloat(body.lap_distance_km) : null;
    var riderIds = Array.isArray(body.rider_ids) ? body.rider_ids.map(Number).filter(Boolean) : [];

    if (!name) return jsonResponse(400, { ok: false, error: 'Event name is required.' });
    if (!eventDate) return jsonResponse(400, { ok: false, error: 'Event date is required.' });
    if (isNaN(laps) || laps < 1) return jsonResponse(400, { ok: false, error: 'Laps must be at least 1.' });

    var insertResult = await supabase
      .from('events')
      .insert({ name, event_date: eventDate, laps, lap_distance_km: lapDist, status: 'pending' })
      .select('id')
      .single();

    if (insertResult.error) {
      console.error('admin-events POST insert error:', insertResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to create event.' });
    }

    var newEventId = insertResult.data.id;

    if (riderIds.length) {
      var participantRows = riderIds.map(function (rid) {
        return { event_id: newEventId, rider_id: rid, status: 'DNS' };
      });
      var partInsert = await supabase.from('event_participants').insert(participantRows);
      if (partInsert.error) {
        console.error('admin-events POST participants error:', partInsert.error);
        return jsonResponse(500, { ok: false, error: 'Event created but failed to add participants.' });
      }
    }

    return jsonResponse(200, { ok: true, event_id: newEventId });
  }

  // ── PATCH: update event (start, finish, reopen, rename) ───────────────────
  if (method === 'PATCH') {
    var body;
    try { body = JSON.parse(event.body || '{}'); } catch (_) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON.' });
    }

    var id = parseInt(body.id, 10);
    if (isNaN(id)) return jsonResponse(400, { ok: false, error: 'Invalid event id.' });

    var action = body.action;
    var updates = {};

    if (action === 'start') {
      updates.status = 'active';
      updates.started_at = new Date().toISOString();
    } else if (action === 'finish') {
      updates.status = 'finished';
    } else if (action === 'reopen') {
      updates.status = 'active';
    } else {
      if (body.name) updates.name = body.name.trim();
      if (body.event_date) updates.event_date = body.event_date;
      if (body.laps) updates.laps = parseInt(body.laps, 10);
      if (body.lap_distance_km !== undefined) updates.lap_distance_km = parseFloat(body.lap_distance_km) || null;
    }

    if (!Object.keys(updates).length) {
      return jsonResponse(400, { ok: false, error: 'No valid fields to update.' });
    }

    var updateResult = await supabase.from('events').update(updates).eq('id', id);
    if (updateResult.error) {
      console.error('admin-events PATCH error:', updateResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to update event.' });
    }

    // When starting, mark all DNS participants as racing
    if (action === 'start') {
      await supabase
        .from('event_participants')
        .update({ status: 'racing' })
        .eq('event_id', id)
        .eq('status', 'DNS');
    }

    return jsonResponse(200, { ok: true });
  }

  // ── DELETE: delete event (only if pending) ─────────────────────────────────
  if (method === 'DELETE') {
    var body;
    try { body = JSON.parse(event.body || '{}'); } catch (_) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON.' });
    }

    var id = parseInt(body.id, 10);
    if (isNaN(id)) return jsonResponse(400, { ok: false, error: 'Invalid event id.' });

    var checkResult = await supabase.from('events').select('status').eq('id', id).single();
    if (checkResult.error) return jsonResponse(404, { ok: false, error: 'Event not found.' });
    if (checkResult.data.status !== 'pending') {
      return jsonResponse(400, { ok: false, error: 'Only pending events can be deleted.' });
    }

    var deleteResult = await supabase.from('events').delete().eq('id', id);
    if (deleteResult.error) return jsonResponse(500, { ok: false, error: 'Unable to delete event.' });

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
};
