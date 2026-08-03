-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- ORCID sync.

alter table professors add column if not exists orcid_id text;
alter table professors add column if not exists orcid_verified boolean default false;
alter table professors add column if not exists publications_count int;
alter table professors add column if not exists h_index int;
