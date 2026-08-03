-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Real chat between two matched professors.

create table if not exists messages (
  id           uuid primary key default uuid_generate_v4(),
  match_id     uuid not null references matches(id) on delete cascade,
  sender_id    uuid not null references professors(id) on delete cascade,
  body         text not null,
  created_at   timestamptz default now(),
  read_at      timestamptz
);

create index if not exists messages_match_id_idx on messages(match_id, created_at);
