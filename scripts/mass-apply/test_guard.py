#!/usr/bin/env python3
"""Tests for guard.py. Run: python3 scripts/mass-apply/test_guard.py
Company names are the ones from the 2026-10-10 incident; no private data."""
import datetime, json, pathlib, sys, tempfile, unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import guard

TODAY = datetime.date(2026, 10, 10)
GUSTO = "https://job-boards.greenhouse.io/gusto/jobs/8192093"
NECTAR = "https://jobs.ashbyhq.com/nectar-social/81462c5a-84f4-406b-9ceb-e34c6cc10b4b/application"
CLOAKED = "https://jobs.ashbyhq.com/cloaked/b84cb659-8ada-4c42-83e0-52dff08308cd/application"
NEW = "https://jobs.lever.co/newco/11111111-2222-3333-4444-555555555555/apply"


def row(company, status, link=None, applied=None, role="Role"):
    return {"company": company, "role": role, "status": status, "job_link": link, "applied": applied}


def verdict(url, ledger=(), history=None, **kw):
    return guard.check([(url, "mobile-ios")], list(ledger), history or {}, today=TODAY, **kw)[0]


class JobKey(unittest.TestCase):
    def test_greenhouse_urls_of_one_job_share_a_key(self):
        keys = {guard.job_key(u)[0] for u in [
            "https://job-boards.greenhouse.io/embed/job_app?for=pinterest&token=8001913",
            "https://www.pinterestcareers.com/jobs/?gh_jid=8001913",
            "https://job-boards.greenhouse.io/pinterest/jobs/8001913"]}
        self.assertEqual(keys, {("greenhouse", "8001913")})

    def test_ashby_and_lever_ignore_the_apply_suffix(self):
        self.assertEqual(guard.job_key(NECTAR), guard.job_key(NECTAR.replace("/application", "")))
        self.assertEqual(guard.job_key(NEW), guard.job_key(NEW.replace("/apply", "")))
        self.assertEqual(guard.job_key(NECTAR)[1], "nectar-social")


class Check(unittest.TestCase):
    def test_new_job_is_filled(self):
        self.assertTrue(verdict(NEW)["ok"])

    def test_applied_posting_is_blocked_even_with_overrides(self):
        v = verdict(GUSTO, [row("Gusto", "Applied", GUSTO, "2026-10-08")], refill=["gusto"], allow_company=["gusto"])
        self.assertFalse(v["ok"]); self.assertIn("ALREADY APPLIED", v["reason"])

    def test_filled_before_is_blocked_until_refill(self):
        # The incident: tracker still said Ready to submit, but the form had been filled two days earlier.
        ledger = [row("Nectar Social", "Ready to submit", NECTAR)]
        history = {guard.job_key(NECTAR)[0]: "run 20261008-1758 #5"}
        v = verdict(NECTAR, ledger, history)
        self.assertFalse(v["ok"]); self.assertIn("FILLED BEFORE", v["reason"])
        self.assertTrue(verdict(NECTAR, ledger, history, refill=["nectar-social"])["ok"])

    def test_second_role_at_a_company_is_blocked_until_allowed(self):
        other = "https://job-boards.greenhouse.io/gusto/jobs/999"
        ledger = [row("Gusto", "Applied", GUSTO, "2026-10-08")]
        v = verdict(other, ledger)
        self.assertFalse(v["ok"]); self.assertIn("COMPANY ALREADY IN TRACKER", v["reason"])
        self.assertTrue(verdict(other, ledger, allow_company=["gusto"])["ok"])

    def test_recent_rejection_blocks_company_old_or_undated_does_not(self):
        other = "https://job-boards.greenhouse.io/gusto/jobs/999"
        self.assertFalse(verdict(other, [row("Gusto", "Rejected", None, "2026-09-20")])["ok"])
        self.assertTrue(verdict(other, [row("Gusto", "Rejected", None, "2023-12-08")])["ok"])
        self.assertTrue(verdict(other, [row("Gusto", "Rejected", None, None)])["ok"])

    def test_withdrawn_sibling_role_does_not_block_the_kept_one(self):
        ledger = [row("WW", "Withdrawn", "https://job-boards.greenhouse.io/ww/jobs/5226133008"),
                  row("WW", "Ready to submit", "https://job-boards.greenhouse.io/ww/jobs/5124361008")]
        kept = "https://job-boards.greenhouse.io/ww/jobs/5124361008"
        self.assertIn("FILLED BEFORE", verdict(kept, ledger)["reason"])        # Ready to submit = already filled
        self.assertTrue(verdict(kept, ledger, refill=["ww/jobs/5124361008"])["ok"])
        self.assertFalse(verdict("https://job-boards.greenhouse.io/ww/jobs/5226133008", ledger)["ok"])

    def test_ready_to_submit_row_counts_as_filled_even_without_run_history(self):
        # Twilio, ServiceTrade, Flowcode, Brigit: filled 2026-10-08 through the Chrome
        # extension, so no run.json; the tracker row is the only trace.
        twilio = "https://job-boards.greenhouse.io/twilio/jobs/8067027"
        ledger = [row("Twilio (Stytch)", "Ready to submit", twilio)]
        self.assertIn("FILLED BEFORE", verdict(twilio, ledger)["reason"])
        self.assertTrue(verdict(twilio, ledger, refill=["twilio"])["ok"])
        # another posting at a company with a filled, unsubmitted form (Brigit remote vs NYC)
        ledger = [row("Brigit", "Ready to submit", "https://jobs.ashbyhq.com/brigit/70b71c70/application")]
        v = verdict("https://jobs.ashbyhq.com/brigit/dadfe50a/application", ledger)
        self.assertIn("COMPANY ALREADY IN TRACKER", v["reason"])

    def test_company_match_survives_slug_differences(self):
        ledger = [row("Gametime", "Applied", "https://job-boards.greenhouse.io/gametimeunited/jobs/1", "2026-10-10")]
        self.assertFalse(verdict("https://job-boards.greenhouse.io/gametimeunited/jobs/2", ledger)["ok"])
        self.assertFalse(verdict("https://jobs.lever.co/gametime/aaaa/apply", ledger)["ok"])

    def test_same_posting_twice_in_one_queue(self):
        vs = guard.check([(CLOAKED, "mobile-ios"), (CLOAKED.replace("/application", ""), "mobile-ios")], [], {}, today=TODAY)
        self.assertEqual([v["ok"] for v in vs], [True, False])


class Ledger(unittest.TestCase):
    def write(self, exported_at):
        p = pathlib.Path(tempfile.mkdtemp()) / "tracker-ledger.json"
        p.write_text(json.dumps({"exported_at": exported_at.isoformat(), "rows": [row("Gusto", "Applied", GUSTO)]}))
        return p

    def test_fresh_ledger_loads(self):
        now = datetime.datetime(2026, 10, 10, 14, 0)
        self.assertEqual(len(guard.load_ledger(self.write(now - datetime.timedelta(minutes=30)), now=now)), 1)

    def test_stale_or_missing_ledger_stops_the_run(self):
        now = datetime.datetime(2026, 10, 10, 14, 0)
        with self.assertRaises(SystemExit):
            guard.load_ledger(self.write(now - datetime.timedelta(hours=5)), now=now)
        with self.assertRaises(SystemExit):
            guard.load_ledger("/nonexistent/tracker-ledger.json", now=now)

    def test_history_skips_blocked_records(self):
        d = pathlib.Path(tempfile.mkdtemp()); (d / "20261008-1758").mkdir()
        (d / "20261008-1758" / "run.json").write_text(json.dumps([
            {"n": 1, "url": GUSTO}, {"n": 2, "url": NECTAR, "skipped": "ALREADY APPLIED"}]))
        h = guard.load_history(d)
        self.assertEqual(h, {("greenhouse", "8192093"): "run 20261008-1758 #1"})


if __name__ == "__main__":
    unittest.main()
