-- Same Supabase SQL Editor as always.
-- Manual identity verification for professors without an institutional
-- (.ac.in / .edu) email - they submit an explanation + optional proof link,
-- an admin reviews it in the dashboard, and approving sets email_verified.

create table if not exists verification_requests (
  id            uuid primary key default uuid_generate_v4(),
  professor_id  uuid not null references professors(id) on delete cascade,
  message       text not null,
  proof_url     text,
  status        text not null default 'pending', -- pending | approved | rejected
  admin_note    text,
  created_at    timestamptz default now(),
  reviewed_at   timestamptz
);
