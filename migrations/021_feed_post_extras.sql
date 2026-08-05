-- Same Supabase SQL Editor as always.
-- Supports the Feed composer's link, categories, and image attachment options.

alter table posts add column if not exists link_url text;
alter table posts add column if not exists categories text[] default '{}';
alter table posts add column if not exists image_url text;
