-- Same Supabase SQL Editor as always.
-- Public iOS interest waitlist, captured from the marketing website.

create table if not exists ios_waitlist (
  id         uuid primary key default uuid_generate_v4(),
  email      text not null unique,
  created_at timestamptz default now()
);
