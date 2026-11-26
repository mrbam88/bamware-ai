"""Offline tests of services/wallboard/collect.py; no network, no real state."""
import datetime as dt
import importlib.util
import json
import pathlib
import tempfile
import unittest
import zoneinfo
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "services" / "wallboard" / "collect.py"
NYC = zoneinfo.ZoneInfo("America/New_York")
NOW = dt.datetime(2026, 11, 26, 13, 0, tzinfo=NYC)  # a Thursday


def load():
    spec = importlib.util.spec_from_file_location("wallboard_collect", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ics(*events: str) -> str:
    return "BEGIN:VCALENDAR\r\n" + "".join(f"BEGIN:VEVENT\r\n{e}\r\nEND:VEVENT\r\n" for e in events) + "END:VCALENDAR\r\n"


class CalendarTest(unittest.TestCase):
    def setUp(self):
        self.c = load()

    def titles(self, text):
        return [row["title"] for row in self.c.upcoming(text, NOW)]

    def test_single_events_are_windowed_and_sorted(self):
        text = ics(
            "UID:a\r\nSUMMARY:Later today\r\nDTSTART:20261126T230000Z\r\nDTEND:20261127T000000Z",
            "UID:b\r\nSUMMARY:Already over\r\nDTSTART:20261126T140000Z\r\nDTEND:20261126T150000Z",
            "UID:c\r\nSUMMARY:Next month\r\nDTSTART:20261226T140000Z",
            "UID:d\r\nSUMMARY:Tomorrow\\, early\r\nDTSTART;TZID=America/New_York:20261127T080000",
        )
        self.assertEqual(self.titles(text), ["Later today", "Tomorrow, early"])

    def test_utc_times_become_local(self):
        text = ics("UID:a\r\nSUMMARY:Call\r\nDTSTART:20261126T230000Z")
        self.assertEqual(self.c.upcoming(text, NOW)[0]["start"], "2026-11-26T18:00:00-05:00")

    def test_all_day_event_today_is_kept_all_day(self):
        text = ics("UID:a\r\nSUMMARY:Thanksgiving\r\nDTSTART;VALUE=DATE:20261126\r\nDTEND;VALUE=DATE:20261127")
        rows = self.c.upcoming(text, NOW)
        self.assertEqual([(r["title"], r["allDay"]) for r in rows], [("Thanksgiving", True)])

    def test_weekly_rule_with_byday_and_exdate(self):
        text = ics(
            "UID:w\r\nSUMMARY:Standup\r\nDTSTART;TZID=America/New_York:20261005T093000\r\n"
            "RRULE:FREQ=WEEKLY;BYDAY=MO,FR\r\nEXDATE;TZID=America/New_York:20261127T093000"
        )
        starts = [row["start"][:10] for row in self.c.upcoming(text, NOW)]
        self.assertEqual(starts, ["2026-11-30"])  # Friday the 27th is excluded

    def test_rule_stops_at_until_and_count(self):
        ended = ics("UID:u\r\nSUMMARY:Ended\r\nDTSTART:20261101T150000Z\r\nRRULE:FREQ=DAILY;UNTIL=20261120T000000Z")
        counted = ics("UID:n\r\nSUMMARY:Three\r\nDTSTART:20261125T230000Z\r\nRRULE:FREQ=DAILY;COUNT=3")
        self.assertEqual(self.titles(ended), [])
        self.assertEqual(len(self.titles(counted)), 2)  # the 26th and 27th; the 25th is past

    def test_edited_instance_replaces_the_generated_one(self):
        text = ics(
            "UID:r\r\nSUMMARY:Review\r\nDTSTART;TZID=America/New_York:20261120T150000\r\nRRULE:FREQ=WEEKLY",
            "UID:r\r\nSUMMARY:Review (moved)\r\nRECURRENCE-ID;TZID=America/New_York:20261127T150000\r\n"
            "DTSTART;TZID=America/New_York:20261127T170000",
        )
        self.assertEqual(self.titles(text), ["Review (moved)"])

    def test_folded_lines_and_cancelled_events(self):
        text = ics(
            "UID:f\r\nSUMMARY:A long\r\n  title\r\nDTSTART:20261126T230000Z",
            "UID:x\r\nSUMMARY:Cancelled\r\nSTATUS:CANCELLED\r\nDTSTART:20261126T230000Z",
        )
        self.assertEqual(self.titles(text), ["A long title"])

    def test_no_feed_configured(self):
        self.assertEqual(self.c.calendar({}, NOW), {"configured": False, "events": []})


class StateTest(unittest.TestCase):
    def setUp(self):
        self.c = load()
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.state = pathlib.Path(self.dir.name)
        for name in ("STATE", "OUT_DIR"):
            patch = mock.patch.object(self.c, name, self.state if name == "STATE" else self.state / "wallboard")
            patch.start()
            self.addCleanup(patch.stop)

    def write(self, relative, content):
        path = self.state / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content if isinstance(content, str) else json.dumps(content))

    def test_board_counts_by_status(self):
        self.write("board/latest.json", {"fetched_at": "t", "items": [
            {"status": "Ready for QA", "title": "One"}, {"status": "Ready for QA", "title": "Two"},
            {"status": "In Progress", "title": "Three"}, {"status": None, "title": "Loose"}, {"status": "Done"},
        ]})
        self.assertEqual(self.c.board(), {
            "readyForQa": 2, "inProgress": 1, "todo": 0, "qaTitles": ["One", "Two"], "fetchedAt": "t"})

    def test_probe_up_and_down(self):
        self.write("brewdesk-probe/status", "up\n")
        self.write("brewdesk-probe/health.json", {"venueCount": 6952})
        self.assertEqual(self.c.probe(1000.0)["detail"], "6,952 venues")
        self.write("brewdesk-probe/status", "down\n")
        self.write("brewdesk-probe/last-ok", "400\n")
        row = self.c.probe(1000.0)
        self.assertEqual((row["level"], row["value"], row["detail"]), ("alert", "Down", "last good 10 min ago"))

    def test_allowance_skips_stale_pools(self):
        self.write("cfo/capacity.json", {"pools": [
            {"key": "claude-max:weekly", "used_pct": 11.4, "reset_at": 1000 + 31 * 3600, "level": "ok", "stale": False}]})
        self.assertEqual(self.c.allowance(1000.0)["usedOf100"], 11)
        self.assertEqual(self.c.allowance(1000.0)["resetHours"], 31)
        self.write("cfo/capacity.json", {"pools": [{"key": "claude-max:weekly", "stale": True}]})
        self.assertIsNone(self.c.allowance(1000.0))

    def test_halt_and_waiting_on_owner(self):
        self.assertIsNone(self.c.halt())
        self.write("cfo/halt.json", {"reason": "burst"})
        self.assertEqual(self.c.halt(), {"reason": "burst"})
        self.write("owner-blockers/a.json", {"status": "waiting_for_owner", "ownerAction": "Sign in"})
        self.write("owner-blockers/b.json", {"status": "resolved", "ownerAction": "Old"})
        self.assertEqual(self.c.waiting_on_owner(), ["Sign in"])

    def test_cache_survives_a_failed_fetch(self):
        self.assertEqual(self.c.cached("x", 0, lambda: {"v": 1}), {"v": 1})

        def broken():
            raise OSError("offline")

        self.assertEqual(self.c.cached("x", 0, broken), {"v": 1})
        self.assertIsNone(self.c.cached("never", 0, broken))

    def test_a_broken_source_blanks_only_its_section(self):
        with mock.patch.object(self.c, "weather", side_effect=RuntimeError), \
                mock.patch.object(self.c, "systemctl", return_value=""), \
                mock.patch.object(self.c, "read_config", return_value={}):
            document = self.c.collect(NOW)
        self.assertIsNone(document["weather"])
        self.assertIsNone(document["board"])
        self.assertEqual(document["calendar"], {"configured": False, "events": []})
        self.assertEqual(document["name"], "Bilal")


if __name__ == "__main__":
    unittest.main()
