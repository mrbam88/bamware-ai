"""Offline tests of scripts/ai-usage-collect.py; no network."""
import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "ai-usage-collect.py"


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


if __name__ == "__main__":
    unittest.main()
