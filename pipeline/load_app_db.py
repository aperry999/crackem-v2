#!/usr/bin/env python3
"""Copy the nightly pipeline's output into the app database (Supabase).

Runs after builddata.py in the nightly run. Reads:
  <event-finder>/site_data.json            events for every market (from builddata.py)
  <event-finder>/daily/registry-venues.csv  the registry's Venues tab (one source of venues)
  <event-finder>/daily/markets.csv          the nightly cities
  <event-finder>/../<market>/<market>-venues-mapdata.csv  optional: venue_id,city,lat,lon,overture_id (city.py add)
  <event-finder>/daily/venue-coords.csv     optional overrides: venue_id,lat,lon,overture_id,source,address
  <event-finder>/daily/venue-hours.json     optional: {venue_id: openingHoursSpecification} from websites
  <event-finder>/group_fit/results/all.json optional: group-fit attributes (kids, dogs, food, drinks)

Writes with the service key (SUPABASE_URL, SUPABASE_SERVICE_KEY env vars):
  markets, venues, events (upserts), then marks events that dropped out as gone.

Google data is never stored except the place ID. Hours come only from the brewery's website
(hours_source='website'); hours a brewery set itself are never overwritten.

  python3 load_app_db.py --event-finder /mnt/project-files/event-finder [--dry-run]
"""
import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import sys
import urllib.request
from zoneinfo import ZoneInfo

DEFAULT_TZ = "America/New_York"


def read_csv(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig") as f:
        return [{k.strip(): (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(f)]


def norm(s):
    return " ".join("".join(c.lower() if c.isalnum() else " " for c in s).split())


def point(lat, lon):
    return f"SRID=4326;POINT({float(lon)} {float(lat)})"


def local_ts(day, hhmm, tz):
    if not hhmm:
        return None
    h, m = (int(x) for x in hhmm.split(":")[:2])
    extra, h = divmod(h, 24)                     # "24:00" / "25:30" = past midnight
    d = dt.date.fromisoformat(day) + dt.timedelta(days=extra)
    return dt.datetime.combine(d, dt.time(h, m), tzinfo=ZoneInfo(tz))


def event_rows(events, venue_by_name, tz_by_market):
    rows, unmatched = [], {}
    for e in events:
        market = e["city"].lower()
        vid = venue_by_name.get((market, norm(e["venue"])))
        if not vid:
            unmatched[(market, e["venue"])] = unmatched.get((market, e["venue"]), 0) + 1
            continue
        tz = tz_by_market.get(market, DEFAULT_TZ)
        start = local_ts(e["date"], e.get("time"), tz)
        end = local_ts(e["date"], e.get("end"), tz)
        if end and start and end <= start:
            end += dt.timedelta(days=1)          # runs past midnight
        if end and not start and end.hour < 6:
            end += dt.timedelta(days=1)          # "until 1am" with no start time
        key = "|".join([vid, e["date"], e.get("time") or "", e["title"].strip().lower()])
        rows.append({
            "id": hashlib.sha1(key.encode()).hexdigest()[:20],
            "venue_id": vid,
            "market_id": market,
            "title": e["title"].strip(),
            "category": e.get("cat") or None,
            "event_date": e["date"],
            "starts_at": start.isoformat() if start else None,
            "ends_at": end.isoformat() if end else None,
            "is_weekly": bool(e.get("weekly")),
            "source": e.get("src") or None,
            "source_url": e.get("link") or None,
            "gone_at": None,
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
    # the same event can appear twice (posted on two channels): keep one
    return list({r["id"]: r for r in rows}.values()), unmatched


def build(ef):
    d = os.path.join(ef, "daily")
    markets = read_csv(os.path.join(d, "markets.csv"))
    registry = read_csv(os.path.join(d, "registry-venues.csv"))
    # Pins: each city's <market>-venues-mapdata.csv (written by city.py add from Overture),
    # then daily/venue-coords.csv on top (backfills and fixes). No pin = "location unconfirmed".
    coords = {}
    for m in markets:
        mk = (m.get("market") or "").lower()
        coords.update({r["venue_id"]: r for r in read_csv(os.path.join(ef, "..", mk, f"{mk}-venues-mapdata.csv"))})
    coords.update({r["venue_id"]: r for r in read_csv(os.path.join(d, "venue-coords.csv"))})
    hours_path = os.path.join(d, "venue-hours.json")
    hours = json.load(open(hours_path)) if os.path.exists(hours_path) else {}
    site = json.load(open(os.path.join(ef, "site_data.json")))
    group_fit = load_group_fit(os.path.join(ef, "group_fit", "results", "all.json"))

    nightly = {m["market"].lower() for m in markets if m.get("market")}
    market_rows = [{
        "id": m["market"].lower(), "name": m["name"],
        "center": point(m["center_lat"], m["center_lon"]) if m.get("center_lat") else None,
        "tz": m.get("tz") or DEFAULT_TZ,
    } for m in markets if m.get("market")]
    tz_by_market = {m["id"]: m["tz"] for m in market_rows}

    venue_rows, venue_by_name, no_coords = [], {}, []
    for r in registry:
        market = r["market"].lower()
        if market not in nightly or not r.get("venue_id"):
            continue
        c = coords.get(r["venue_id"]) or ({"lat": r["lat"], "lon": r["lon"]} if r.get("lat") else None)
        row = {
            "id": r["venue_id"], "market_id": market, "name": r["venue_name"],
            "status": (r.get("status") or "active").lower(),
            "tier": (r.get("tier") or "listed").lower(),
            "instagram_handle": r.get("instagram_handle") or None,
            "website": r.get("website") or None,
            "address": r.get("address") or (c or {}).get("address") or None,
            "town": r.get("town") or (c or {}).get("city") or None,
            "google_place_id": r.get("google_place_id") or None,
            "overture_id": (c or {}).get("overture_id") or r.get("overture_id") or None,
            "location": point(c["lat"], c["lon"]) if c else None,
        }
        gf = group_fit.get((r.get("instagram_handle") or "").lower().lstrip("@"))
        row["group_fit"], row["group_fit_at"] = gf if gf else ({}, None)
        if r["venue_id"] in hours:
            row["hours"], row["hours_source"] = hours[r["venue_id"]], "website"
        venue_rows.append(row)
        venue_by_name[(market, norm(r["venue_name"]))] = r["venue_id"]
        if not c and row["status"] == "active":
            no_coords.append(r["venue_id"])

    events = [e for e in site["events"] if e["city"].lower() in nightly]
    ev_rows, unmatched = event_rows(events, venue_by_name, tz_by_market)
    return market_rows, venue_rows, ev_rows, unmatched, no_coords


def load_group_fit(path):
    """{handle: (attributes without evidence, extracted_at)}. One handle can cover several venues."""
    if not os.path.exists(path):
        return {}
    out = {}
    for item in json.load(open(path)):
        prof = item.get("profile", item)
        attrs = {k: {f: v[f] for f in ("value", "types", "until", "confidence") if f in v}
                 for k, v in (prof.get("attributes") or {}).items()}
        out[prof["brewery_handle"].lower()] = (attrs, prof.get("extracted_at"))
    return out


class Rest:
    def __init__(self, url, key):
        self.base, self.key = url.rstrip("/") + "/rest/v1", key

    def call(self, method, path, body=None, prefer=None):
        req = urllib.request.Request(self.base + path, method=method,
                                     data=json.dumps(body).encode() if body is not None else None)
        req.add_header("apikey", self.key)
        req.add_header("Authorization", "Bearer " + self.key)
        req.add_header("Content-Type", "application/json")
        if prefer:
            req.add_header("Prefer", prefer)
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else None

    def upsert(self, table, rows, chunk=500):
        for i in range(0, len(rows), chunk):
            self.call("POST", f"/{table}", rows[i:i + chunk],
                      prefer="resolution=merge-duplicates,return=minimal")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--event-finder", default="/mnt/project-files/event-finder")
    ap.add_argument("--dry-run", action="store_true", help="build the rows and print counts; write nothing")
    a = ap.parse_args()

    markets, venues, events, unmatched, no_coords = build(a.event_finder)
    print(f"markets {len(markets)}, venues {len(venues)}, events {len(events)}")
    if unmatched:
        print(f"  events with no registry venue (skipped): {sum(unmatched.values())} from "
              + ", ".join(f"{v} ({m})" for m, v in sorted(unmatched)))
    if no_coords:
        print(f"  active venues with no coordinates (not on the map or in the feed): {len(no_coords)}")
    if a.dry_run:
        return 0

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set", file=sys.stderr)
        return 2
    db = Rest(url, key)
    db.upsert("markets", markets)
    # Hours a brewery set itself (hours_source='brewery') are never overwritten by website hours.
    # PostgREST bulk upserts need the same keys on every row, so the two groups go separately.
    branded = {v["id"] for v in db.call("GET", "/venues?select=id&hours_source=eq.brewery") or []}
    plain = [{**v, "hours": v.get("hours"), "hours_source": v.get("hours_source")}
             for v in venues if v["id"] not in branded]
    managed = [{k: x for k, x in v.items() if k not in ("hours", "hours_source")}
               for v in venues if v["id"] in branded]
    db.upsert("venues", plain)
    db.upsert("venues", managed)
    db.upsert("events", events)
    today = dt.date.today().isoformat()
    for m in markets:
        keep = [e["id"] for e in events if e["market_id"] == m["id"]]
        gone = db.call("POST", "/rpc/mark_events_gone", {"p_market": m["id"], "p_from": today, "p_keep": keep})
        print(f"  {m['id']}: {len(keep)} events loaded, {gone} marked gone")
    return 0


if __name__ == "__main__":
    sys.exit(main())
