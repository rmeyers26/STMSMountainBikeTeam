-- ============================================================
-- STMS Mountain Bike Team — Add "goals" column to rider_scorecards
-- Run this in the Supabase SQL Editor ONLY if you already created the
-- rider_scorecards table before the goals field existed. Fresh installs
-- get this column from scorecards-setup.sql and don't need this file.
-- Idempotent — safe to re-run.
-- ============================================================

alter table rider_scorecards
  add column if not exists goals text default '';
