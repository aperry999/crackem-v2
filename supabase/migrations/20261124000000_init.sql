-- Crackem v2: first schema.
-- The nightly Python pipeline writes markets, venues and events with the service key.
-- The app reads them with the anon key and writes only through the functions at the bottom.

create extension if not exists postgis;

create type venue_tier as enum ('listed', 'connected', 'verified');

-- Markets ---------------------------------------------------------------

create table markets (
  id          text primary key,              -- 'orlando', matches daily/markets.csv
  name        text not null,
  center      geography(point, 4326),
  tz          text not null default 'America/New_York',
  updated_at  timestamptz not null default now()
);

-- Venues ----------------------------------------------------------------
-- id is the registry venue_id. Coordinates come from Overture (open data, fine to store).
-- From Google we keep only the place ID, per Google's terms.

create table venues (
  id               text primary key,
  market_id        text not null references markets(id),
  name             text not null,
  status           text not null default 'active',   -- registry status
  tier             venue_tier not null default 'listed',
  instagram_handle text,
  website          text,
  address          text,
  town             text,
  location         geography(point, 4326),
  google_place_id  text,
  overture_id      text,
  -- Opening hours: schema.org openingHoursSpecification from the brewery's website,
  -- or set by the brewery itself (Connected/Verified). Never from Google.
  hours            jsonb,
  hours_source     text check (hours_source in ('website', 'brewery')),
  updated_at       timestamptz not null default now()
);
create index venues_location_idx on venues using gist (location);
create index venues_market_idx on venues (market_id) where status = 'active';

-- Events ----------------------------------------------------------------

create table events (
  id          text primary key,              -- stable hash from the loader
  venue_id    text not null references venues(id) on delete cascade,
  market_id   text not null references markets(id),
  title       text not null,
  category    text,
  event_date  date not null,                 -- local date in the market's time zone
  starts_at   timestamptz,                   -- null = all day / no time posted
  ends_at     timestamptz,
  is_weekly   boolean not null default false,
  source      text,                          -- instagram | website | eventbrite
  source_url  text,
  gone_at     timestamptz,                   -- set when the event drops out of the pipeline
  updated_at  timestamptz not null default now()
);
create index events_day_idx on events (market_id, event_date) where gone_at is null;
create index events_venue_idx on events (venue_id, event_date);

-- People ----------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  home_market   text references markets(id),
  bubble_id     text unique,                 -- set by the Bubble migration
  birthdate_ok  boolean not null default false,
  created_at    timestamptz not null default now()
);

create table checkins (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  venue_id    text not null references venues(id),
  location    geography(point, 4326),
  source      text not null default 'app',   -- app | bubble_import
  created_at  timestamptz not null default now()
);
create index checkins_user_idx on checkins (user_id, venue_id);

-- Surprise rewards ------------------------------------------------------
-- No points. A check-in sometimes turns up a reward. Brewery-funded rewards stay off
-- until the attorney's tied-house opinion is in (funded_by = 'brewery').

create table rewards (
  id           bigint generated always as identity primary key,
  title        text not null,                -- 'A soft pretzel, on us tonight'
  details      text,
  funded_by    text not null default 'crackem' check (funded_by in ('crackem', 'brewery')),
  venue_id     text references venues(id),   -- null = any venue in the market
  market_id    text references markets(id),  -- null = any market
  chance       numeric not null default 0.1 check (chance between 0 and 1),
  valid_hours  int not null default 6,
  active       boolean not null default false,
  created_at   timestamptz not null default now()
);

create table reward_grants (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  reward_id   bigint not null references rewards(id),
  checkin_id  bigint references checkins(id),
  venue_id    text references venues(id),
  code        text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  opened_at   timestamptz,
  redeemed_at timestamptz
);
create index reward_grants_user_idx on reward_grants (user_id, created_at desc);

-- Server-side feature switch -------------------------------------------
-- enabled = on for everyone; otherwise on only for users listed in flag_users.

create table flags (
  key         text primary key,
  enabled     boolean not null default false,
  note        text,
  updated_at  timestamptz not null default now()
);
create table flag_users (
  key      text references flags(key) on delete cascade,
  user_id  uuid references auth.users(id) on delete cascade,
  primary key (key, user_id)
);
insert into flags (key, enabled, note) values
  ('v2_experience', false, 'New tonight feed experience; on for testers via flag_users'),
  ('surprise_rewards', false, 'Rewards after check-in');

-- Row-level security ----------------------------------------------------

alter table markets enable row level security;
alter table venues enable row level security;
alter table events enable row level security;
alter table profiles enable row level security;
alter table checkins enable row level security;
alter table rewards enable row level security;
alter table reward_grants enable row level security;
alter table flags enable row level security;
alter table flag_users enable row level security;

create policy "public read" on markets for select using (true);
create policy "public read" on venues for select using (status = 'active');
create policy "public read" on events for select using (gone_at is null);
create policy "public read" on flags for select using (true);
create policy "own flags" on flag_users for select using (user_id = auth.uid());
create policy "own profile" on profiles for select using (id = auth.uid());
create policy "own profile insert" on profiles for insert with check (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid());
create policy "own checkins" on checkins for select using (user_id = auth.uid());
create policy "own grants" on reward_grants for select using (user_id = auth.uid());
-- rewards: no client access; titles reach the user only through their grants.

-- Functions the app calls -----------------------------------------------

-- Tonight's events within p_radius_mi of the phone, still on or starting later today.
create or replace function tonight_feed(p_lat double precision, p_lon double precision,
                                        p_radius_mi double precision default 10,
                                        p_now timestamptz default now())
returns table (event_id text, title text, category text, starts_at timestamptz, ends_at timestamptz,
               is_weekly boolean, source_url text, venue_id text, venue_name text, tier venue_tier,
               miles double precision)
language sql stable as $$
  with me as (select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g)
  select e.id, e.title, e.category, e.starts_at, e.ends_at, e.is_weekly, e.source_url,
         v.id, v.name, v.tier, st_distance(v.location, me.g) / 1609.34
  from events e
  join venues v on v.id = e.venue_id and v.status = 'active'
  join markets m on m.id = e.market_id
  cross join me
  where e.gone_at is null
    and e.event_date = (p_now at time zone m.tz)::date
    and st_dwithin(v.location, me.g, p_radius_mi * 1609.34)
    and (e.ends_at is null or e.ends_at > p_now)
    and (e.starts_at is null or e.ends_at is not null or e.starts_at > p_now - interval '3 hours')
  order by e.starts_at nulls last, 11;
$$;

-- Nearest active venues: the fallback when the feed is thin.
create or replace function nearby_venues(p_lat double precision, p_lon double precision,
                                         p_limit int default 10)
returns table (venue_id text, name text, tier venue_tier, hours jsonb, hours_source text,
               town text, miles double precision)
language sql stable as $$
  select v.id, v.name, v.tier, v.hours, v.hours_source, v.town,
         st_distance(v.location, st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography) / 1609.34
  from venues v
  where v.status = 'active' and v.location is not null
  order by v.location <-> st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography
  limit p_limit;
$$;

-- "12 of 30 in Orlando"
create or replace function city_progress(p_market text)
returns table (visited int, total int)
language sql stable security definer set search_path = public as $$
  select (select count(distinct c.venue_id)::int
            from checkins c join venues v on v.id = c.venue_id
           where c.user_id = auth.uid() and v.market_id = p_market and v.status = 'active'),
         (select count(*)::int from venues where market_id = p_market and status = 'active');
$$;

create or replace function flag_on(p_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from flags where key = p_key), false)
      or exists (select 1 from flag_users where key = p_key and user_id = auth.uid());
$$;

-- Check in. Must be within 150 m of the venue; one per venue per 4 hours.
-- May grant a surprise reward. Returns what the app shows next.
create or replace function check_in(p_venue text, p_lat double precision, p_lon double precision)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v venues;
  here geography := st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;
  cid bigint;
  first_visit boolean;
  prog record;
  r rewards;
  gid bigint;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into v from venues where id = p_venue and status = 'active';
  if not found then raise exception 'unknown venue'; end if;
  if v.location is null or st_distance(v.location, here) > 150 then
    return jsonb_build_object('ok', false, 'reason', 'too_far');
  end if;
  if exists (select 1 from checkins where user_id = uid and venue_id = p_venue
             and created_at > now() - interval '4 hours') then
    return jsonb_build_object('ok', false, 'reason', 'already_checked_in');
  end if;

  first_visit := not exists (select 1 from checkins where user_id = uid and venue_id = p_venue);
  insert into checkins (user_id, venue_id, location) values (uid, p_venue, here) returning id into cid;
  select * into prog from city_progress(v.market_id);

  -- Surprise reward: at most one a week per person, only when the switch is on for them.
  if flag_on('surprise_rewards') and not exists (
       select 1 from reward_grants where user_id = uid and created_at > now() - interval '7 days') then
    select * into r from rewards
     where active and funded_by = 'crackem'
       and (venue_id is null or venue_id = p_venue)
       and (market_id is null or market_id = v.market_id)
       and random() < chance
     order by venue_id nulls last, random()
     limit 1;
    if found then
      insert into reward_grants (user_id, reward_id, checkin_id, venue_id, code, expires_at)
      values (uid, r.id, cid, p_venue,
              upper(substr(md5(gen_random_uuid()::text), 1, 7)),
              now() + make_interval(hours => r.valid_hours))
      returning id into gid;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'checkin_id', cid, 'first_visit', first_visit,
                            'visited', prog.visited, 'total', prog.total, 'reward_grant_id', gid);
end;
$$;

-- Open a sealed reward card: returns its contents.
create or replace function open_reward(p_grant bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare g reward_grants; r rewards;
begin
  update reward_grants set opened_at = coalesce(opened_at, now())
   where id = p_grant and user_id = auth.uid() returning * into g;
  if not found then raise exception 'not found'; end if;
  select * into r from rewards where id = g.reward_id;
  return jsonb_build_object('title', r.title, 'details', r.details, 'code', g.code, 'expires_at', g.expires_at);
end;
$$;

-- Used by the loader: events for this market from p_from on that weren't in tonight's batch.
create or replace function mark_events_gone(p_market text, p_from date, p_keep text[])
returns int
language sql security definer set search_path = public as $$
  with u as (
    update events set gone_at = now()
     where market_id = p_market and event_date >= p_from and gone_at is null
       and not (id = any(p_keep))
    returning 1)
  select count(*)::int from u;
$$;
revoke execute on function mark_events_gone(text, date, text[]) from public, anon, authenticated;

-- Apple requires in-app account deletion.
create or replace function delete_my_account()
returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
