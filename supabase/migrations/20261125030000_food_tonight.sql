-- Food on the home cards (Aubrey, Nov 25): every card says what food there is tonight, so
-- home_places returns tonight's food truck or food special with its times. The return type
-- changes, so the function is dropped first.

drop function if exists home_places(double precision, double precision, double precision, boolean, boolean, timestamptz, int);

create or replace function home_places(p_lat double precision, p_lon double precision,
                                       p_radius_mi double precision default 10,
                                       p_kids boolean default false, p_dog boolean default false,
                                       p_now timestamptz default now(), p_limit int default 30)
returns table (venue_id text, name text, tier venue_tier, town text, miles double precision,
               open_now boolean, closes_at timestamptz, hours_source text,
               fits boolean, group_fit jsonb,
               food_title text, food_starts_at timestamptz, food_ends_at timestamptz,
               event_title text, event_starts_at timestamptz, event_on_now boolean)
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
           fd.title as truck, fd.starts_at as fd_start, fd.ends_at as fd_end,
           ev.title as ev_title, ev.starts_at as ev_start,
           (ev.starts_at <= p_now and coalesce(ev.ends_at, ev.starts_at + interval '2 hours') > p_now) as ev_now
    from base b
    cross join lateral venue_open_status(b.hours, b.tz, p_now) s
    -- food tonight: a food truck or food special posted for today that hasn't ended
    left join lateral (
      select e.title, e.starts_at, e.ends_at from events e
       where e.venue_id = b.id and e.event_date = b.today and e.gone_at is null
         and e.category like 'food_truck%'
         and (e.ends_at is null or e.ends_at > p_now)
       order by e.starts_at nulls last
       limit 1) fd on true
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
         truck, fd_start, fd_end, ev_title, ev_start, coalesce(ev_now, false)
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
