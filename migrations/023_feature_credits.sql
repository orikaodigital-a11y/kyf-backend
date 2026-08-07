-- Same Supabase SQL Editor as always.
-- Tracks bundle-offer credits a professor has bought in advance (e.g. "5
-- Priority Connects for Rs120") - each paid feature checks here first and
-- only charges the wallet if there's no credit to use instead.

create table if not exists feature_credits (
  professor_id  uuid not null references professors(id) on delete cascade,
  feature       text not null,
  remaining     int not null default 0,
  primary key (professor_id, feature)
);
