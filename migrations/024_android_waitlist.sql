-- Same Supabase SQL Editor as always.
-- Public Android "notify me at launch" waitlist, captured from the
-- marketing website - replaces the direct-download button until the app
-- is actually on the Play Store.

create table if not exists android_waitlist (
  id         uuid primary key default uuid_generate_v4(),
  email      text not null unique,
  created_at timestamptz default now()
);
