-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Featured Profile subscription + showcases.
-- Showcases are title+link only for now, not title+images+link - real image
-- uploads need S3 + signed URLs (see kyf_backend_architecture.md), not built yet.

alter table professors add column if not exists featured_active boolean default false;
alter table professors add column if not exists featured_expires_at timestamptz;

create table if not exists feature_showcases (
  id           uuid primary key default uuid_generate_v4(),
  professor_id uuid not null references professors(id) on delete cascade,
  title        text not null,
  link         text,
  created_at   timestamptz default now()
);
