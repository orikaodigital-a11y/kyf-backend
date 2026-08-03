-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Nearby Faculty - opt-in location sharing.

alter table professors add column if not exists location_enabled boolean default false;
alter table professors add column if not exists lat double precision;
alter table professors add column if not exists lng double precision;
