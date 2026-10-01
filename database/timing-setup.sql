-- ============================================================
-- STMS Mountain Bike Team — Race Timing Setup
-- Run AFTER riders-setup.sql in the Supabase SQL Editor
-- ============================================================

-- Events table
create table if not exists events (
  id               bigint generated always as identity primary key,
  name             text not null,
  event_date       date not null,
  laps             integer not null default 3,
  lap_distance_km  numeric(5,2),
  started_at       timestamptz,
  status           text not null default 'pending',
  created_at       timestamptz default now(),
  constraint events_status_check check (status in ('pending', 'active', 'finished'))
);

-- Event participants — riders entered in a specific event
create table if not exists event_participants (
  id        bigint generated always as identity primary key,
  event_id  bigint not null references events(id) on delete cascade,
  rider_id  bigint not null references riders(id) on delete cascade,
  status    text not null default 'DNS',
  constraint event_participants_unique unique (event_id, rider_id),
  constraint event_participants_status_check check (status in ('DNS', 'racing', 'DNF', 'finished'))
);

-- Lap times — one row per crossing
create table if not exists lap_times (
  id          bigint generated always as identity primary key,
  event_id    bigint not null references events(id) on delete cascade,
  rider_id    bigint not null references riders(id) on delete cascade,
  lap_number  integer not null,
  crossed_at  timestamptz not null default now(),
  is_finish   boolean not null default false,
  voided      boolean not null default false,
  created_at  timestamptz default now()
);

create index if not exists lap_times_event_rider on lap_times(event_id, rider_id);
create index if not exists lap_times_event       on lap_times(event_id);
