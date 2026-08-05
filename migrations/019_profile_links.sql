-- Same Supabase SQL Editor as always.
-- Two optional research-profile links collected on the signup wizard's Basics
-- step (ORCID already has its own dedicated sync flow/columns).

alter table professors add column if not exists researchgate_url text;
alter table professors add column if not exists scholar_url text;
