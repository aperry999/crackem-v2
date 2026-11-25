-- Location-based home (Aubrey, Nov 25): nearby breweries ranked by the brewery decision
-- points, with tonight's event inside each card. Events-first home is a user setting.

alter table profiles
  add column home_view text not null default 'places' check (home_view in ('places', 'events'));

-- venues.hours format (normalized by the pipeline from schema.org openingHoursSpecification,
-- or set by the brewery):  {"mon": [["16:00","23:00"]], "fri": [["12:00","02:00"]], ...}
-- A close earlier than the open runs past midnight. A day missing from a non-empty object
-- means closed that day. Empty or null hours = unknown.

-- Open now? (null = unknown) and when it closes or next opens, for one venue.
create or replace function venue_open_status(p_hours jsonb, p_tz text, p_now timestamptz default now(),
                                             out open_now boolean, out closes_at timestamptz)
language plpgsql stable as $$
declare
  local_now timestamp := p_now at time zone p_tz;
  d int;
  day date;
  slot jsonb;
  o timestamp;
  c timestamp;
begin
  open_now := null;
  closes_at := null;
  if p_hours is null or p_hours = '{}'::jsonb then
    return;
  end if;
  open_now := false;
  -- yesterday's late slots can still be open after midnight
  for d in -1..0 loop
    day := local_now::date + d;
    for slot in select * from jsonb_array_elements(
        coalesce(p_hours -> (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from day)::int + 1], '[]'::jsonb))
    loop
      o := day + (slot ->> 0)::time;
      c := day + (slot ->> 1)::time;
      if c <= o then c := c + interval '1 day'; end if;
      if local_now >= o and local_now < c then
        open_now := true;
        closes_at := c at time zone p_tz;
        return;
      end if;
    end loop;
  end loop;
end;
$$;

-- The home list. Venues known to be closed, or that rule out the group, are left out.
-- Unknown hours or unknown group fit stay in, marked unconfirmed, ranked after confirmed ones.
-- Order follows the decision points: open and close, then distance adjusted for
-- food tonight, non-beer drinks, NA, and tonight's event. A venue closing within
-- 45 minutes sinks to the bottom.
create or replace function home_places(p_lat double precision, p_lon double precision,
                                       p_radius_mi double precision default 10,
                                       p_kids boolean default false, p_dog boolean default false,
                                       p_now timestamptz default now(), p_limit int default 30)
returns table (venue_id text, name text, tier venue_tier, town text, miles double precision,
               open_now boolean, closes_at timestamptz, hours_source text,
               fits boolean, group_fit jsonb,
               food_tonight text, event_title text, event_starts_at timestamptz, event_on_now boolean)
language sql stable as $$
  with me as (select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g),
  base as (
    select v.*, m.tz, st_distance(v.location, me.g) / 1609.34 as mi,
           (p_now at time zone m.tz)::date as today, (p_now at time zone m.tz)::time as now_local
    from venues v join markets m on m.id = v.market_id cross join me
    where v.status = 'active' and v.location is not null
      and st_dwithin(v.location, me.g, p_radius_mi * 1609.34)
  ),
  scored as (
    select b.*, s.open_now as is_open, s.closes_at as close_at,
           fits_group(b.group_fit, p_kids, p_dog, b.now_local) as fit,
           (select e.title from events e
             where e.venue_id = b.id and e.event_date = b.today and e.gone_at is null
               and e.category like 'food_truck%' and (e.ends_at is null or e.ends_at > p_now)
             order by e.starts_at nulls last limit 1) as truck,
           ev.title as ev_title, ev.starts_at as ev_start,
           (ev.starts_at <= p_now and coalesce(ev.ends_at, ev.starts_at + interval '2 hours') > p_now) as ev_now
    from base b
    cross join lateral venue_open_status(b.hours, b.tz, p_now) s
    left join lateral (
      select e.title, e.starts_at, e.ends_at from events e
       where e.venue_id = b.id and e.event_date = b.today and e.gone_at is null
         and coalesce(e.category, '') not like 'food_truck%'
         and (e.ends_at is null or e.ends_at > p_now)
         and (e.starts_at is null or e.ends_at is not null or e.starts_at > p_now - interval '3 hours')
       order by (e.starts_at is null), e.starts_at
       limit 1) ev on true
  )
  select id, name, tier, town, mi, is_open, close_at, hours_source, fit, group_fit,
         truck, ev_title, ev_start, coalesce(ev_now, false)
  from scored
  where is_open is distinct from false and fit is distinct from false
  order by
    (close_at is not null and close_at < p_now + interval '45 minutes'),  -- closing soon: last
    (is_open is null),                                                     -- unknown hours after open
    mi
      - case when truck is not null or group_fit #>> '{kitchen,value}' = 'yes' then 0.6 else 0 end
      - case when 'yes' in (group_fit #>> '{cocktails,value}', group_fit #>> '{wine,value}',
                            group_fit #>> '{cider,value}', group_fit #>> '{seltzer,value}') then 0.4 else 0 end
      - case when 'yes' in (group_fit #>> '{na_beer,value}', group_fit #>> '{mocktails,value}') then 0.3 else 0 end
      - case when ev_title is not null then 0.3 else 0 end
  limit p_limit;
$$;

-- Open now and today's close for one venue (venue page).
create or replace function venue_status(p_venue text, p_now timestamptz default now())
returns table (open_now boolean, closes_at timestamptz)
language sql stable as $$
  select s.open_now, s.closes_at
  from venues v join markets m on m.id = v.market_id
  cross join lateral venue_open_status(v.hours, m.tz, p_now) s
  where v.id = p_venue;
$$;
