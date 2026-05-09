-- ============================================================
-- STMS Mountain Bike Team — Rider Registration Setup
-- Run this in the Supabase SQL Editor (once, in order)
-- ============================================================

-- Categories table
create table if not exists categories (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  sort_order  smallint default 0,
  created_at  timestamp with time zone default now()
);

-- Riders table
create table if not exists riders (
  id           bigint generated always as identity primary key,
  first_name   text not null,
  last_name    text not null,
  bib_number   text,
  category_id  bigint references categories(id),
  season_year  integer not null default extract(year from now()),
  created_at   timestamp with time zone default now(),
  unique (bib_number, season_year)
);

-- Seed categories (skip if already present)
insert into categories (name, sort_order) values
  ('Boys 6th Grade',          1),
  ('Boys 7th Grade',          2),
  ('Boys 8th Grade',          3),
  ('Girls 6th Grade',         4),
  ('Girls 7th Grade',         5),
  ('Girls 8th Grade',         6),
  ('Boys Varsity',            7),
  ('Boys JV1 – Division 1',   8),
  ('Boys JV1 – Division 2',   9),
  ('Boys JV2 – Division 1',  10),
  ('Boys JV2 – Division 2',  11),
  ('Boys Freshman – Division 1', 12),
  ('Boys Freshman – Division 2', 13),
  ('Girls Varsity',           14),
  ('Girls Junior Varsity 1',  15),
  ('Girls Junior Varsity 2',  16),
  ('Girls Freshman',          17),
  ('Coach',                   18)
on conflict (name) do nothing;
