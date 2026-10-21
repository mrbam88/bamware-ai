"""Offline tests of scripts/ai-usage-collect.py; no network."""
import datetime as dt
import decimal
import http.server
import importlib.util
import json
import os
import pathlib
import tempfile
import threading
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "ai-usage-collect.py"
FIXTURES = ROOT / "tests" / "ai-usage-fixtures"
CAPACITY_FIXTURE = FIXTURES / "capacity.json"  # real shape of the CFO's publish_capacity output


def collector():
    spec = importlib.util.spec_from_file_location("ai_usage_collect", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def line(ts, msg_id, req, model="claude-opus-5-5", **usage):
    u = {"input_tokens": 1, "output_tokens": 10, "cache_read_input_tokens": 100,
         "cache_creation_input_tokens": 50,
         "cache_creation": {"ephemeral_1h_input_tokens": 50, "ephemeral_5m_input_tokens": 0}}
    u.update(usage)
    return json.dumps({
        "type": "assistant", "timestamp": ts, "requestId": req, "sessionId": "s1",
        "cwd": "/home/b/code/bamware-web/.claude/worktrees/ai-usage", "gitBranch": "feat/12-dash",
        "message": {"id": msg_id, "model": model, "usage": u},
    })


class CollectTests(unittest.TestCase):
    def setUp(self):
        self.c = collector()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def write(self, name, lines):
        p = pathlib.Path(self.tmp.name) / name
        p.write_text("\n".join(lines) + "\n")
        return p

    def test_dedupes_content_blocks_and_buckets_by_hour(self):
        p = self.write("s1.jsonl", [
            line("2026-09-30T14:05:00.000Z", "m1", "r1"),
            line("2026-09-30T14:05:01.000Z", "m1", "r1"),  # same message, next content block
            line("2026-09-30T14:50:00.000Z", "m2", "r2"),
            line("2026-09-30T15:01:00.000Z", "m3", "r3"),
            '{"type": "user", "message": {}}',
            '{"type": "assistant", "trunc',  # a line still being written
        ])
        rows = sorted(self.c.rollups_for(p, "thinkpad"), key=lambda r: r["hourStart"])
        self.assertEqual([r["hourStart"] for r in rows], ["2026-09-30T14:00:00.000Z", "2026-09-30T15:00:00.000Z"])
        first = rows[0]
        self.assertEqual(first["messages"], 2)
        self.assertEqual(first["output"], 20)
        self.assertEqual(first["cacheWrite1h"], 100)
        self.assertEqual(first["cacheWrite5m"], 0)
        self.assertEqual(first["cacheRead"], 200)
        self.assertEqual(first["firstTs"], "2026-09-30T14:05:01.000Z")
        self.assertEqual(first["lastTs"], "2026-09-30T14:50:00.000Z")
        self.assertEqual((first["repo"], first["ticket"], first["stream"]), ("bamware-web", "web#12", "s1"))

    def test_older_usage_without_ttl_split_counts_as_5m(self):
        p = self.write("s2.jsonl", [line("2026-09-30T14:05:00Z", "m1", "r1", cache_creation=None)])
        (row,) = self.c.rollups_for(p, "h")
        self.assertEqual((row["cacheWrite5m"], row["cacheWrite1h"]), (50, 0))

    def test_skips_synthetic_models_and_splits_models(self):
        p = self.write("s3.jsonl", [
            line("2026-09-30T14:05:00Z", "m1", "r1"),
            line("2026-09-30T14:06:00Z", "m2", "r2", model="claude-haiku-4-5"),
            line("2026-09-30T14:07:00Z", "m3", "r3", model="<synthetic>"),
        ])
        self.assertEqual(sorted(r["model"] for r in self.c.rollups_for(p, "h")), ["claude-haiku-4-5", "claude-opus-5-5"])

    def test_ticket_parsing(self):
        t = self.c.ticket_of
        self.assertEqual(t("bamware-web", "feat/12-dash"), "web#12")
        self.assertEqual(t("bamware-brewdesk", "fix/bd-97-crash"), "brewdesk#97")
        self.assertEqual(t("bamware-ai", "issue-41"), "ai#41")
        self.assertEqual(t("bamware-web", "feat/ai-usage-dashboard"), "")
        self.assertEqual(t("bamware-web", "chore/2026-09-30-cleanup"), "")
        self.assertEqual(t("bamware-web", "main"), "")

    def test_repo_of_worktree_and_plain_dir(self):
        self.assertEqual(self.c.repo_of("/home/b/code/bamware-ai/.claude/worktrees/x"), "bamware-ai")
        self.assertEqual(self.c.repo_of("/home/b/code/Practice"), "Practice")
        self.assertEqual(self.c.repo_of(""), "")


def expected_iso(epoch):
    """Independent of the collector: exact decimal of the epoch, to the millisecond."""
    d = decimal.Decimal(repr(epoch)).quantize(decimal.Decimal("0.001"), rounding=decimal.ROUND_HALF_EVEN)
    whole = int(d)
    ms = int((d - whole) * 1000)
    t = dt.datetime.fromtimestamp(whole, dt.timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms:03d}Z"


class VendorReadingTests(unittest.TestCase):
    def setUp(self):
        self.c = collector()
        self.doc = json.loads(CAPACITY_FIXTURE.read_text())

    def test_every_pool_becomes_a_reading_with_the_cfos_numbers_verbatim(self):
        readings, skipped = self.c.vendor_readings(self.doc, "omarchy")
        self.assertEqual(skipped, [])
        self.assertEqual(len(readings), len(self.doc["pools"]))
        for pool, r in zip(self.doc["pools"], readings):
            self.assertEqual(r["type"], "vendor_reading")
            self.assertEqual(r["poolKey"], pool["key"])
            self.assertEqual(r["label"], pool["label"])
            self.assertEqual(r["usedPct"], pool["used_pct"])
            self.assertEqual(r["windowMin"], pool["window_min"])
            self.assertEqual(r["level"], pool["level"])
            self.assertEqual(r["stale"], pool["stale"])
            self.assertEqual(r["observedAt"], expected_iso(pool["observed_at"]))
            self.assertEqual(r["resetAt"], expected_iso(pool["reset_at"]))
            self.assertEqual(r["capacityGeneratedAt"], expected_iso(self.doc["generated_at"]))

    def test_iso_ms_is_exact_at_millisecond_boundaries(self):
        self.assertEqual(self.c.iso_ms(0), "1970-01-01T00:00:00.000Z")
        self.assertEqual(self.c.iso_ms(1.001), "1970-01-01T00:00:01.001Z")
        self.assertEqual(self.c.iso_ms(1792615897.497), expected_iso(1792615897.497))

    def test_pool_missing_a_number_is_skipped_and_named_never_guessed(self):
        doc = {"generated_at": 1792615988.6, "pools": [
            {"key": "good", "label": "Good", "window_min": 300, "used_pct": 5.0, "observed_at": 1792615897.4, "reset_at": 1792628999.6},
            {"key": "no-used", "label": "Bad", "window_min": 300, "observed_at": 1792615897.4, "reset_at": 1792628999.6},
            {"key": "no-observed", "label": "Bad2", "window_min": 300, "used_pct": 5.0, "reset_at": 1792628999.6},
        ]}
        readings, skipped = self.c.vendor_readings(doc, "h")
        self.assertEqual([r["poolKey"] for r in readings], ["good"])
        self.assertEqual(skipped, ["no-used", "no-observed"])
        self.assertFalse(readings[0]["stale"])  # absent flag means not flagged

    def test_stale_flag_passes_through(self):
        doc = json.loads(CAPACITY_FIXTURE.read_text())
        doc["pools"][0]["stale"] = True
        readings, _ = self.c.vendor_readings(doc, "h")
        self.assertTrue(readings[0]["stale"])

    def test_payload_matches_the_golden_ingest_fixture(self):
        """The web repo's accuracy test feeds this same payload through ingest and the page."""
        readings, _ = self.c.vendor_readings(self.doc, "omarchy")
        golden = json.loads((FIXTURES / "ingest-payload.json").read_text())
        self.assertEqual({"rollups": [], "vendorReadings": readings}, golden)


class RunTests(unittest.TestCase):
    """Whole collector run against a local stand-in for the ingest endpoint."""

    def test_run_posts_every_pool_even_with_no_transcripts(self):
        c = collector()
        received = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                received.append((self.path, self.headers["Authorization"], body))
                out = json.dumps({"written": len(body["rollups"]), "vendorWritten": len(body["vendorReadings"])}).encode()
                self.send_response(200)
                self.send_header("Content-Length", str(len(out)))
                self.end_headers()
                self.wfile.write(out)

            def log_message(self, *a):
                pass

        server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        with tempfile.TemporaryDirectory() as tmp:
            env = {"AI_USAGE_URL": f"http://127.0.0.1:{server.server_port}", "AI_USAGE_INGEST_TOKEN": "t", "AI_USAGE_HOST": "omarchy"}
            with mock.patch.dict(os.environ, env), \
                    mock.patch.object(c, "CAPACITY", CAPACITY_FIXTURE), \
                    mock.patch.object(c, "PROJECTS", pathlib.Path(tmp) / "none"), \
                    mock.patch.object(c, "STATE", pathlib.Path(tmp) / "state.json"), \
                    mock.patch.object(c, "CONFIG", pathlib.Path(tmp) / "no.env"), \
                    mock.patch("sys.argv", ["ai-usage-collect.py"]):
                c.main()
        self.assertEqual(len(received), 1)
        path, auth, body = received[0]
        self.assertEqual((path, auth), ("/api/ai-usage/ingest", "Bearer t"))
        self.assertEqual(body, json.loads((FIXTURES / "ingest-payload.json").read_text()))

    def test_missing_capacity_file_does_not_stop_transcripts(self):
        c = collector()
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(c, "CAPACITY", pathlib.Path(tmp) / "nope.json"):
            self.assertIsNone(c.load_capacity())


if __name__ == "__main__":
    unittest.main()
