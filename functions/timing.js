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

  // ── GET: participants + current lap data for an event ──────────────────────
  if (method === 'GET') {
    var params = event.queryStringParameters || {};
    var eventId = parseInt(params.event_id, 10);
    if (isNaN(eventId)) return jsonResponse(400, { ok: false, error: 'event_id required.' });

    var [evResult, partResult, lapResult] = await Promise.all([
      supabase.from('events').select('id, name, status, started_at, laps, lap_distance_km').eq('id', eventId).single(),
      supabase
        .from('event_participants')
        .select('rider_id, status, riders(id, first_name, last_name, bib_number, categories(name))')
        .eq('event_id', eventId),
      supabase
        .from('lap_times')
        .select('id, rider_id, lap_number, crossed_at, is_finish, voided')
        .eq('event_id', eventId)
        .eq('voided', false)
        .order('crossed_at', { ascending: true })
    ]);

    if (evResult.error) return jsonResponse(404, { ok: false, error: 'Event not found.' });
    if (partResult.error || lapResult.error) {
      return jsonResponse(500, { ok: false, error: 'Unable to load timing data.' });
    }

    // Index laps by rider
    var lapsByRider = {};
    (lapResult.data || []).forEach(function (lap) {
      if (!lapsByRider[lap.rider_id]) lapsByRider[lap.rider_id] = [];
      lapsByRider[lap.rider_id].push(lap);
    });

    var startedAt = evResult.data.started_at ? new Date(evResult.data.started_at).getTime() : null;

    var participants = (partResult.data || []).map(function (p) {
      var rider = p.riders || {};
      var laps = lapsByRider[p.rider_id] || [];
      var lapCount = laps.length;
      var lastLap = laps[laps.length - 1] || null;
      var totalMs = (startedAt && lastLap) ? new Date(lastLap.crossed_at).getTime() - startedAt : null;
      return {
        rider_id:   rider.id,
        first_name: rider.first_name,
        last_name:  rider.last_name,
        bib_number: rider.bib_number,
        category:   rider.categories ? rider.categories.name : '',
        status:     p.status,
        lap_count:  lapCount,
        is_finish:  lastLap ? lastLap.is_finish : false,
        total_ms:   totalMs,
        last_lap_id: lastLap ? lastLap.id : null
      };
    });

    return jsonResponse(200, { ok: true, event: evResult.data, participants });
  }

  // ── POST: record a lap, finish, or DNF ────────────────────────────────────
  if (method === 'POST') {
    var body;
    try { body = JSON.parse(event.body || '{}'); } catch (_) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON.' });
    }

    var eventId = parseInt(body.event_id, 10);
    var riderId = parseInt(body.rider_id, 10);
    var action = body.action; // 'lap' | 'finish' | 'dnf'

    if (isNaN(eventId) || isNaN(riderId)) {
      return jsonResponse(400, { ok: false, error: 'event_id and rider_id are required.' });
    }
    if (!['lap', 'finish', 'dnf'].includes(action)) {
      return jsonResponse(400, { ok: false, error: 'action must be lap, finish, or dnf.' });
    }

    if (action === 'dnf') {
      var dnfResult = await supabase
        .from('event_participants')
        .update({ status: 'DNF' })
        .eq('event_id', eventId)
        .eq('rider_id', riderId);
      if (dnfResult.error) return jsonResponse(500, { ok: false, error: 'Unable to mark DNF.' });
      return jsonResponse(200, { ok: true });
    }

    // Get current lap count for this rider
    var countResult = await supabase
      .from('lap_times')
      .select('id', { count: 'exact' })
      .eq('event_id', eventId)
      .eq('rider_id', riderId)
      .eq('voided', false);

    if (countResult.error) return jsonResponse(500, { ok: false, error: 'Unable to read lap data.' });

    var currentLapCount = countResult.count || 0;
    var nextLapNumber = currentLapCount + 1;
    var isFinish = action === 'finish';

    var insertResult = await supabase
      .from('lap_times')
      .insert({
        event_id:   eventId,
        rider_id:   riderId,
        lap_number: nextLapNumber,
        crossed_at: new Date().toISOString(),
        is_finish:  isFinish,
        voided:     false
      });

    if (insertResult.error) {
      console.error('timing POST lap insert error:', insertResult.error);
      return jsonResponse(500, { ok: false, error: 'Unable to record lap.' });
    }

    // Update participant status
    var newStatus = isFinish ? 'finished' : 'racing';
    await supabase
      .from('event_participants')
      .update({ status: newStatus })
      .eq('event_id', eventId)
      .eq('rider_id', riderId);

    return jsonResponse(200, { ok: true, lap_number: nextLapNumber });
  }

  // ── PATCH: void (undo) the last lap for a rider ────────────────────────────
  if (method === 'PATCH') {
    var body;
    try { body = JSON.parse(event.body || '{}'); } catch (_) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON.' });
    }

    var eventId = parseInt(body.event_id, 10);
    var riderId = parseInt(body.rider_id, 10);

    if (isNaN(eventId) || isNaN(riderId)) {
      return jsonResponse(400, { ok: false, error: 'event_id and rider_id are required.' });
    }

    // Find the last non-voided lap for this rider
    var lastLapResult = await supabase
      .from('lap_times')
      .select('id, lap_number, is_finish')
      .eq('event_id', eventId)
      .eq('rider_id', riderId)
      .eq('voided', false)
      .order('crossed_at', { ascending: false })
      .limit(1)
      .single();

    if (lastLapResult.error || !lastLapResult.data) {
      return jsonResponse(404, { ok: false, error: 'No lap to undo for this rider.' });
    }

    var voidResult = await supabase
      .from('lap_times')
      .update({ voided: true })
      .eq('id', lastLapResult.data.id);

    if (voidResult.error) return jsonResponse(500, { ok: false, error: 'Unable to void lap.' });

    // Restore participant status if we voided a finish
    if (lastLapResult.data.is_finish) {
      await supabase
        .from('event_participants')
        .update({ status: 'racing' })
        .eq('event_id', eventId)
        .eq('rider_id', riderId);
    }

    return jsonResponse(200, { ok: true, voided_lap: lastLapResult.data.lap_number });
  }

  return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
};
