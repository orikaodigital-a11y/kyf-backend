-- Run this in Supabase's SQL Editor to create the first table.
-- We'll add more tables (matches, messages, transactions, etc.) in later steps
-- as we build the features that need them — not all at once.

create extension if not exists "uuid-ossp";

create table professors (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  university          text not null,
  department          text,
  category            text not null,
  email               text unique not null,
  email_verified      boolean default false,
  username            text unique not null,
  password_hash       text not null,
  wallet_balance_paise bigint default 0,
  created_at          timestamptz default now()
);
