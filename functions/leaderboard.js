const { createClient } = require('@supabase/supabase-js');
const { jsonResponse } = require('./admin-auth-utils');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse(500, { ok: false, error: 'Server is not configured.' });
  }

  var params = event.queryStringParameters || {};
  var eventId = parseInt(params.event_id, 10);
  if (isNaN(eventId)) return jsonResponse(400, { ok: false, error: 'event_id required.' });

  var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  var [evResult, partResult, lapResult] = await Promise.all([
    supabase.from('events').select('id, name, event_date, status, started_at, laps, lap_distance_km').eq('id', eventId).single(),
    supabase
      .from('event_participants')
      .select('rider_id, status, riders(id, first_name, last_name, bib_number, categories(name))')
      .eq('event_id', eventId),
    supabase
      .from('lap_times')
      .select('rider_id, lap_number, crossed_at, is_finish')
      .eq('event_id', eventId)
      .eq('voided', false)
      .order('crossed_at', { ascending: true })
  ]);

  if (evResult.error) return jsonResponse(404, { ok: false, error: 'Event not found.' });
  if (partResult.error || lapResult.error) {
    return jsonResponse(500, { ok: false, error: 'Unable to load leaderboard data.' });
  }

  var startedAt = evResult.data.started_at ? new Date(evResult.data.started_at).getTime() : null;

  // Index laps by rider
  var lapsByRider = {};
  (lapResult.data || []).forEach(function (lap) {
    if (!lapsByRider[lap.rider_id]) lapsByRider[lap.rider_id] = [];
    lapsByRider[lap.rider_id].push(lap);
  });

  // Build standings rows
  var rows = (partResult.data || []).map(function (p) {
    var rider = p.riders || {};
    var laps = lapsByRider[p.rider_id] || [];
    var lapCount = laps.length;
    var lastLap = laps[laps.length - 1] || null;
    var isFinish = lastLap ? lastLap.is_finish : false;
    var totalMs = (startedAt && lastLap) ? new Date(lastLap.crossed_at).getTime() - startedAt : null;

    return {
      rider_id:   rider.id,
      first_name: rider.first_name || '',
      last_name:  rider.last_name || '',
      bib_number: rider.bib_number || '',
      category:   rider.categories ? rider.categories.name : '',
      status:     p.status,
      lap_count:  lapCount,
      is_finish:  isFinish,
      total_ms:   totalMs,
      last_lap_at: lastLap ? lastLap.crossed_at : null
    };
  });

  // Sort: finished riders first (by time), then racing (by laps desc then time), then DNS/DNF
  rows.sort(function (a, b) {
    var statusOrder = function (r) {
      if (r.is_finish) return 0;
      if (r.status === 'racing') return 1;
      if (r.status === 'DNF') return 2;
      return 3; // DNS
    };

    var ao = statusOrder(a);
    var bo = statusOrder(b);
    if (ao !== bo) return ao - bo;

    // Same group: sort by laps desc, then time asc
    if (b.lap_count !== a.lap_count) return b.lap_count - a.lap_count;
    if (a.total_ms !== null && b.total_ms !== null) return a.total_ms - b.total_ms;
    if (a.total_ms !== null) return -1;
    if (b.total_ms !== null) return 1;
    return (a.last_name || '').localeCompare(b.last_name || '');
  });

  // Assign positions and gaps
  var leaderMs = null;
  var standings = rows.map(function (r, i) {
    var position = i + 1;
    var gap_ms = null;

    if (r.total_ms !== null) {
      if (leaderMs === null) leaderMs = r.total_ms;
      gap_ms = r.total_ms - leaderMs;
    }

    return Object.assign({}, r, { position, gap_ms });
  });

  return jsonResponse(200, { ok: true, event: evResult.data, standings });
};
