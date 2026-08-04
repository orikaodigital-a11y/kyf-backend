-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Moves prices out of hardcoded constants in the route files into a table
-- the admin dashboard can edit live.

create table if not exists pricing (
  key           text primary key,
  label         text not null,
  description   text,
  amount_paise  bigint not null,
  unit          text not null,
  updated_at    timestamptz default now()
);

insert into pricing (key, label, description, amount_paise, unit) values
  ('priority_connect', 'Priority Connect', 'Paid super-like - instant notification, jumps the queue', 3000, 'one-time'),
  ('opportunity_post', 'Opportunity Posting', 'Post a current requirement to the Opportunities tab', 10000, 'per post / 30 days'),
  ('featured_profile', 'Featured Profile', 'Featured badge + up to 2 showcases', 19900, 'per month'),
  ('post_boost', 'Post Boost', 'Boosts a feed post to the top for 3 days', 4900, 'per boost / 3 days'),
  ('sponsored_ad', 'Self-Serve Sponsored Ad', 'Any business can market directly to professors, targeted to up to 4 categories', 100000, 'per ad / 7 days')
on conflict (key) do nothing;
