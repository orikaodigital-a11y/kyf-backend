-- Run this in Supabase's SQL Editor, same way as the first migration.
-- This adds what Discover/matching needs: richer profile fields, plus
-- tables to track who liked whom and who's actually matched.

alter table professors add column if not exists tags text[] default '{}';
alter table professors add column if not exists seeking text[] default '{}';
alter table professors add column if not exists bio text;
alter table professors add column if not exists photo_url text;

create table if not exists likes (
  id                  uuid primary key default uuid_generate_v4(),
  from_professor_id   uuid not null references professors(id) on delete cascade,
  to_professor_id     uuid not null references professors(id) on delete cascade,
  created_at          timestamptz default now(),
  unique (from_professor_id, to_professor_id)
);

create table if not exists matches (
  id                  uuid primary key default uuid_generate_v4(),
  professor_a_id      uuid not null references professors(id) on delete cascade,
  professor_b_id      uuid not null references professors(id) on delete cascade,
  matched_at          timestamptz default now(),
  unique (professor_a_id, professor_b_id)
);
