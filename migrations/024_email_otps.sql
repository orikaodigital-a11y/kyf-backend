-- Same Supabase SQL Editor as always.
-- Server-side email OTP codes (replaces the old client-only demo OTP, which
-- never touched the backend and could be read straight off the screen).

create table if not exists email_otps (
  email       text primary key,
  code        text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);
