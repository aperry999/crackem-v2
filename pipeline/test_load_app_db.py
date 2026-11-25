import unittest

from load_app_db import event_rows, norm


class EventRows(unittest.TestCase):
    venues = {("orlando", norm("Gravity Taproom")): "gravity"}
    tz = {"orlando": "America/New_York"}

    def one(self, **kw):
        e = {"city": "orlando", "venue": "Gravity Taproom", "date": "2026-11-25", "title": "Comedy Night", **kw}
        rows, unmatched = event_rows([e], self.venues, self.tz)
        return rows[0] if rows else None, unmatched

    def test_local_time_to_utc(self):
        r, _ = self.one(time="20:00")
        self.assertEqual(r["starts_at"], "2026-11-25T20:00:00-05:00")
        self.assertIsNone(r["ends_at"])

    def test_end_past_midnight(self):
        r, _ = self.one(time="21:00", end="01:00")
        self.assertEqual(r["ends_at"], "2026-11-26T01:00:00-05:00")

    def test_hour_24_and_up(self):
        r, _ = self.one(time="23:00", end="25:30")
        self.assertEqual(r["ends_at"], "2026-11-26T01:30:00-05:00")

    def test_end_only_late_night(self):
        r, _ = self.one(end="01:00")
        self.assertIsNone(r["starts_at"])
        self.assertEqual(r["ends_at"], "2026-11-26T01:00:00-05:00")

    def test_unknown_venue_skipped(self):
        r, unmatched = self.one(venue="Nowhere Brewing")
        self.assertIsNone(r)
        self.assertEqual(unmatched, {("orlando", "Nowhere Brewing"): 1})

    def test_stable_id_and_dedupe(self):
        e = {"city": "orlando", "venue": "Gravity Taproom", "date": "2026-11-25", "title": "Trivia", "time": "19:00"}
        rows, _ = event_rows([e, dict(e, src="website")], self.venues, self.tz)
        self.assertEqual(len(rows), 1)
        rows2, _ = event_rows([e], self.venues, self.tz)
        self.assertEqual(rows[0]["id"], rows2[0]["id"])


if __name__ == "__main__":
    unittest.main()


class Pins(unittest.TestCase):
    def test_city_mapdata_then_override(self):
        import json, os, tempfile
        from load_app_db import build
        root = tempfile.mkdtemp()
        ef, daily, clt = os.path.join(root, "event-finder"), os.path.join(root, "event-finder", "daily"), os.path.join(root, "charlotte")
        for d in (daily, clt):
            os.makedirs(d)
        w = lambda p, s: open(p, "w").write(s)
        w(os.path.join(daily, "markets.csv"), "market,name,center_lat,center_lon\ncharlotte,\"Charlotte, NC\",35.2,-80.8\n")
        w(os.path.join(daily, "registry-venues.csv"),
          "venue_id,market,venue_name,status\nclt-a,charlotte,A Brewing,active\nclt-b,charlotte,B Brewing,active\nclt-c,charlotte,C Brewing,active\n")
        w(os.path.join(clt, "charlotte-venues-mapdata.csv"),
          "venue_id,city,lat,lon,overture_id\nclt-a,Rock Hill,35.0,-81.0,ov-a\nclt-b,Charlotte,35.1,-80.9,ov-b\n")
        w(os.path.join(daily, "venue-coords.csv"), "venue_id,lat,lon,overture_id,source,address\nclt-b,35.2,-80.7,ov-b2,overture,1 Main St\n")
        json.dump({"events": []}, open(os.path.join(ef, "site_data.json"), "w"))
        _, venues, _, _, no_coords = build(ef)
        v = {r["id"]: r for r in venues}
        self.assertEqual(v["clt-a"]["town"], "Rock Hill")
        self.assertEqual(v["clt-b"]["overture_id"], "ov-b2")
        self.assertEqual(v["clt-b"]["address"], "1 Main St")
        self.assertIsNone(v["clt-c"]["location"])
        self.assertEqual(no_coords, ["clt-c"])
