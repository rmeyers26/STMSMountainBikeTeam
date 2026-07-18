-- ============================================================
-- STMS Mountain Bike Team — Rider Scorecards Setup
-- Run this in the Supabase SQL Editor (once).
-- Requires the `riders` table from riders-setup.sql.
-- ============================================================

-- One scorecard per rider, per season. Scores are stored as a JSONB
-- object keyed by category then month index (0 = Jan … 11 = Dec):
--   { "handling": {"0": 4, "1": 3}, "skills": {"5": 5}, ... }
-- Only scored months are present; values are integers 1–5.
create table if not exists rider_scorecards (
  id            bigint generated always as identity primary key,
  rider_id      bigint not null references riders(id) on delete cascade,
  season_year   integer not null,
  scores        jsonb not null default '{}'::jsonb,
  race_category text default '',
  notes         text default '',
  evaluator     text default '',
  updated_at    timestamp with time zone default now(),
  unique (rider_id, season_year)
);

-- Fast lookups by rider + season (matches the unique key, but explicit
-- for the GET query path).
create index if not exists rider_scorecards_rider_season_idx
  on rider_scorecards (rider_id, season_year);
