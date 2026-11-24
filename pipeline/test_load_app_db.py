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
