-- Venues with no map pin (Overture had no match and the brewery hasn't set one) stay in the
-- app as "location unconfirmed": miles is null, they rank after pinned venues, and they show
-- when the person is within 30 miles of the venue's market area.

create or replace function tonight_feed(p_lat double precision, p_lon double precision,
                                        p_radius_mi double precision default 10,
                                        p_now timestamptz default now())
returns table (event_id text, title text, category text, starts_at timestamptz, ends_at timestamptz,
               is_weekly boolean, source_url text, venue_id text, venue_name text, tier venue_tier,
               miles double precision)
language sql stable as $$
  with me as (select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g)
  select e.id, e.title, e.category, e.starts_at, e.ends_at, e.is_weekly, e.source_url,
         v.id, v.name, v.tier, st_distance(v.location, me.g) / 1609.34  -- null = location unconfirmed
  from events e
  join venues v on v.id = e.venue_id and v.status = 'active'
  join markets m on m.id = e.market_id
  cross join me
  where e.gone_at is null
    and e.event_date = (p_now at time zone m.tz)::date
    and (st_dwithin(v.location, me.g, p_radius_mi * 1609.34)
         or (v.location is null and st_dwithin(m.center, me.g, (p_radius_mi + 30) * 1609.34)))
    and (e.ends_at is null or e.ends_at > p_now)
    and (e.starts_at is null or e.ends_at is not null or e.starts_at > p_now - interval '3 hours')
  order by e.starts_at nulls last, 11;
$$;

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
    where v.status = 'active'
      and (st_dwithin(v.location, me.g, p_radius_mi * 1609.34)
           or (v.location is null and st_dwithin(m.center, me.g, (p_radius_mi + 30) * 1609.34)))
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
    (mi is null),                                                          -- no pin: after pinned
    mi
      - case when truck is not null or group_fit #>> '{kitchen,value}' = 'yes' then 0.6 else 0 end
      - case when 'yes' in (group_fit #>> '{cocktails,value}', group_fit #>> '{wine,value}',
                            group_fit #>> '{cider,value}', group_fit #>> '{seltzer,value}') then 0.4 else 0 end
      - case when 'yes' in (group_fit #>> '{na_beer,value}', group_fit #>> '{mocktails,value}') then 0.3 else 0 end
      - case when ev_title is not null then 0.3 else 0 end
  limit p_limit;
$$;
