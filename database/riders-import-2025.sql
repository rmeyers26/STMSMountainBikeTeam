-- ============================================================
-- STMS Mountain Bike Team — Rider Import (Season 2025)
-- Run this in the Supabase SQL Editor (after riders-setup.sql).
--
-- Maps each rider's category name to categories.id, then inserts into
-- riders for season_year 2025. Idempotent: re-running skips riders whose
-- (bib_number, season_year) already exists.
--
-- NOTE: the riders table has no grade/division columns. Grade is implied
-- by the category ("Boys 6th Grade" = grade 6); division is not stored.
-- ============================================================

insert into riders (first_name, last_name, bib_number, category_id, season_year)
select v.first_name, v.last_name, v.bib_number, c.id, 2025
from (values
  ('Nico',    'Bloedel',    '7037', 'Boys 6th Grade'),
  ('Jameson', 'Frogge',     '7038', 'Boys 6th Grade'),
  ('Mason',   'Lambrechts', '7040', 'Boys 6th Grade'),
  ('Calvin',  'Vickers',    '7041', 'Boys 6th Grade'),
  ('Aidan',   'Howe',       '6044', 'Boys 7th Grade'),
  ('Carson',  'Vaughn',     '6047', 'Boys 7th Grade'),
  ('Grayson', 'Bush',       '5042', 'Boys 8th Grade'),
  ('William', 'Donahoe',    '5043', 'Boys 8th Grade'),
  ('Dawson',  'Fusco',      '5044', 'Boys 8th Grade'),
  ('Garritt', 'Fusco',      '5045', 'Boys 8th Grade'),
  ('Fletcher','Lacy',       '5047', 'Boys 8th Grade'),
  ('Cooper',  'Lindeen',    '5048', 'Boys 8th Grade'),
  ('Sam',     'Rudin',      '5050', 'Boys 8th Grade'),
  ('Ryley',   'Toman',      '5051', 'Boys 8th Grade'),
  ('Thomas',  'Waage',      '5052', 'Boys 8th Grade'),
  ('Blake',   'Walker',     '5053', 'Boys 8th Grade')
) as v(first_name, last_name, bib_number, category_name)
join categories c on c.name = v.category_name
on conflict (bib_number, season_year) do nothing;

-- Verify the import (optional): list the 2025 roster with category names.
-- select r.bib_number, c.name as category, r.last_name, r.first_name
-- from riders r
-- join categories c on c.id = r.category_id
-- where r.season_year = 2025
-- order by c.sort_order, r.last_name, r.first_name;
