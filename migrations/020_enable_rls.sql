-- Fixes Supabase's "Table publicly accessible" security alert. Our backend
-- connects as the postgres superuser via a direct pg connection, which always
-- bypasses RLS - so this has zero effect on the app. What it does fix: right
-- now, anyone with the project's anon/public API key could read, edit, or
-- delete every row in every table directly through Supabase's REST API,
-- completely bypassing our backend's auth checks. Enabling RLS with no
-- policies blocks that API path entirely, closing the hole.

alter table admins enable row level security;
alter table app_settings enable row level security;
alter table blocks enable row level security;
alter table bundle_offers enable row level security;
alter table collab_score_weights enable row level security;
alter table feature_showcases enable row level security;
alter table legal_pages enable row level security;
alter table likes enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table opportunities enable row level security;
alter table posts enable row level security;
alter table pricing enable row level security;
alter table professors enable row level security;
alter table promo_codes enable row level security;
alter table reports enable row level security;
alter table sent_notifications enable row level security;
alter table sponsored_ads enable row level security;
alter table support_tickets enable row level security;
alter table transactions enable row level security;
