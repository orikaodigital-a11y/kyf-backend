-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Self-serve Sponsored Ads (submission + wallet hold now; admin approval
-- routes will land once the admin dashboard exists to drive them).

create table if not exists sponsored_ads (
  id               uuid primary key default uuid_generate_v4(),
  requested_by_id  uuid references professors(id) on delete set null,
  advertiser       text not null,
  body             text not null,
  cta_label        text not null default 'Learn More',
  link             text not null,
  categories       text[] default '{}',
  status           text not null default 'pending',  -- pending, approved, rejected, closed
  active           boolean default false,
  started_at       timestamptz,
  duration_days    int default 7,
  impressions      bigint default 0,
  clicks           bigint default 0,
  transaction_id   uuid references transactions(id),
  admin_reply      text,
  created_at       timestamptz default now()
);
