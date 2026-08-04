alter table professors add column if not exists push_token text;

create table if not exists sent_notifications (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  target text not null default 'all',
  recipient_count int not null default 0,
  created_at timestamptz default now()
);
