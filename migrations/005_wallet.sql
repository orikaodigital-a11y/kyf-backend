-- Run this in Supabase's SQL Editor, same way as the earlier migrations.
-- Wallet top-ups and every paid feature's transaction log.

create table if not exists transactions (
  id                  uuid primary key default uuid_generate_v4(),
  professor_id        uuid not null references professors(id) on delete cascade,
  type                text not null,   -- wallet_topup, priority_connect, opportunity_post, post_boost, featured_profile, sponsored_ad
  amount_paise        bigint not null,
  status              text not null default 'completed',  -- held, completed, refunded, failed
  detail              text,
  razorpay_payment_id text,
  created_at          timestamptz default now()
);

create index if not exists transactions_professor_id_idx on transactions(professor_id, created_at desc);
