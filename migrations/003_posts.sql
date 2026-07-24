create table posts (
  id            uuid primary key default uuid_generate_v4(),
  professor_id  uuid not null references professors(id),
  content       text not null,
  created_at    timestamptz default now()
);