-- Same Supabase SQL Editor as always.
-- In-app notification center (bell dropdown) + category targeting for admin
-- push notifications + welcome-notification config storage.

create table if not exists notifications (
  id            uuid primary key default uuid_generate_v4(),
  professor_id  uuid not null references professors(id) on delete cascade,
  type          text not null, -- match | incoming_like | admin_broadcast
  title         text not null,
  body          text not null,
  link_screen   text,          -- e.g. '/chat/[matchId]', '/discover'
  link_params   jsonb,
  read          boolean not null default false,
  created_at    timestamptz default now()
);
create index if not exists idx_notifications_professor on notifications(professor_id, created_at desc);

alter table sent_notifications add column if not exists categories text[];

insert into app_settings (key, value) values
  ('welcome_notification', '{"active": false, "title": "", "body": "", "promoCode": ""}')
on conflict (key) do nothing;

alter table notifications enable row level security;
alter table verification_requests enable row level security;
