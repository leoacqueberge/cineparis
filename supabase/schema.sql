-- Run this once in the Supabase SQL editor.

create table if not exists movie_snapshots (
  brand text not null,
  day date not null,
  payload jsonb not null,
  scraped_at timestamptz not null default now(),
  primary key (brand, day)
);

create index if not exists movie_snapshots_day_idx on movie_snapshots (day);
create index if not exists movie_snapshots_scraped_at_idx on movie_snapshots (scraped_at);

alter table movie_snapshots enable row level security;

-- Server uses the service role key (bypasses RLS).
-- No public policies: the browser never talks to Supabase directly.
