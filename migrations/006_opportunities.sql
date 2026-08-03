-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- The Opportunities board — paid postings, auto-expire after 30 days.

create table if not exists opportunities (
  id           uuid primary key default uuid_generate_v4(),
  author_id    uuid not null references professors(id) on delete cascade,
  title        text not null,
  description  text not null,
  category     text not null,
  seeking      text[] default '{}',
  created_at   timestamptz default now(),
  expires_at   timestamptz not null default (now() + interval '30 days')
);

create index if not exists opportunities_expires_at_idx on opportunities(expires_at);
