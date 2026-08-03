-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Paid Post Boost.

alter table posts add column if not exists boosted boolean default false;
alter table posts add column if not exists boost_expires_at timestamptz;
