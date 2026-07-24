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

create table if not exists tmdb_id_map (
  source text not null,
  source_id text not null,
  tmdb_id integer,
  title text,
  year integer,
  updated_at timestamptz not null default now(),
  primary key (source, source_id)
);

create index if not exists tmdb_id_map_tmdb_id_idx on tmdb_id_map (tmdb_id);

alter table tmdb_id_map enable row level security;

create table if not exists letterboxd_watchlists (
  username text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists letterboxd_watchlists_fetched_at_idx
  on letterboxd_watchlists (fetched_at);

alter table letterboxd_watchlists enable row level security;
