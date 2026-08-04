-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Admin accounts for the admin dashboard (separate login from professors).

create table if not exists admins (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  email          text unique not null,
  password_hash  text not null,
  role           text not null default 'super_admin',  -- super_admin, support, ads_team
  created_at     timestamptz default now()
);
