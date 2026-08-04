-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Promo codes and bundle offers - admin-managed config, not yet wired into
-- the app's checkout flows (the app has no "enter a promo code" or "buy a
-- bundle" UI yet). This lands the admin management side first.

create table if not exists promo_codes (
  code          text primary key,
  applies_to    text not null,   -- priority_connect, opportunity_post, featured_profile, post_boost, sponsored_ad, all
  discount_type text not null,   -- full_waiver, percent_off
  discount_value numeric,        -- only used for percent_off, e.g. 25 for 25% off
  uses          int not null default 0,
  max_uses      int,
  active        boolean not null default true,
  created_at    timestamptz default now()
);

create table if not exists bundle_offers (
  id           uuid primary key default uuid_generate_v4(),
  feature      text not null,   -- priority_connect, opportunity_post, post_boost, featured_profile
  label        text not null,
  qty          int not null,
  unit_price_paise bigint not null,
  price_paise  bigint not null,
  active       boolean not null default true,
  created_at   timestamptz default now()
);
