-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Help & Support tickets and profile reports.

create table if not exists support_tickets (
  id           uuid primary key default uuid_generate_v4(),
  professor_id uuid not null references professors(id) on delete cascade,
  category     text not null,
  description  text not null,
  status       text not null default 'Submitted',
  created_at   timestamptz default now()
);

create table if not exists reports (
  id           uuid primary key default uuid_generate_v4(),
  reported_id  uuid not null references professors(id) on delete cascade,
  reporter_id  uuid not null references professors(id) on delete cascade,
  reason       text not null,
  details      text,
  status       text not null default 'new',
  created_at   timestamptz default now()
);
