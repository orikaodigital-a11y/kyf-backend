-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Blocking another professor.

create table if not exists blocks (
  id           uuid primary key default uuid_generate_v4(),
  blocker_id   uuid not null references professors(id) on delete cascade,
  blocked_id   uuid not null references professors(id) on delete cascade,
  created_at   timestamptz default now(),
  unique (blocker_id, blocked_id)
);
