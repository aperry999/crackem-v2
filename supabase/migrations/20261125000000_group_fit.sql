-- Brewery decision points (Aubrey's "Brewery decision points for the Crackem app", Nov 25):
-- food, non-beer drinks, NA/low-ABV, seating, kids and dogs, plus a saved group for filtering.

-- Group-fit attributes per venue, as the group-fit extraction writes them:
-- {"kids": {"value": "welcome", "until": "19:00"}, "dogs": {"value": "patio_only"},
--  "kitchen": {"value": "yes"}, "cocktails": {"value": "yes", "types": ["frozen"]}, ...}
-- A missing key or "unknown" means unconfirmed, never "no".
alter table venues
  add column group_fit jsonb not null default '{}'::jsonb,
  add column group_fit_at timestamptz;

-- Answers people give after a check-in ("Do they serve NA beer?") and hours flags.
-- A second source for the fields Instagram rarely shows. Read by people, not merged automatically.
create table attribute_reports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  venue_id    text not null references venues(id),
  checkin_id  bigint references checkins(id),
  attribute   text not null,          -- na_beer | mocktails | kitchen | hours_wrong | ...
  value       text not null,          -- yes | no | not_sure | free text for hours
  created_at  timestamptz not null default now()
);
create index attribute_reports_venue_idx on attribute_reports (venue_id, attribute);
alter table attribute_reports enable row level security;
create policy "own reports" on attribute_reports for select using (user_id = auth.uid());
create policy "report after check-in" on attribute_reports for insert with check (
  user_id = auth.uid()
  and exists (select 1 from checkins c where c.id = checkin_id and c.user_id = auth.uid()
              and c.venue_id = attribute_reports.venue_id and c.created_at > now() - interval '12 hours'));

-- The saved group: set once, applied to Tonight, Nearby and trips.
alter table profiles
  add column with_kids boolean not null default false,
  add column with_dog boolean not null default false;

-- Does a venue fit the group right now? true = fits, false = rules it out, null = unconfirmed.
-- Unknown never counts as no: callers keep null rows and mark them unconfirmed.
create or replace function fits_group(gf jsonb, p_kids boolean, p_dog boolean, p_local_time time)
returns boolean
language sql immutable as $$
  select case
    when p_kids and gf #>> '{kids,value}' = 'adults_only' then false
    when p_kids and gf #>> '{kids,until}' is not null
         and p_local_time >= (gf #>> '{kids,until}')::time then false
    when p_dog and gf #>> '{dogs,value}' = 'not_allowed' then false
    when (p_kids and coalesce(gf #>> '{kids,value}', 'unknown') = 'unknown')
      or (p_dog and coalesce(gf #>> '{dogs,value}', 'unknown') = 'unknown') then null
    else true
  end;
$$;
