"""Offline tests of Bamware's Hermes adapter; no model or paid API calls."""
import importlib.util
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "hermes-context.py"


def bridge():
    spec = importlib.util.spec_from_file_location("hermes_context", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ContextTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base = pathlib.Path(self.tmp.name)
        self.origin = base / "origin"
        self.origin.mkdir()
        self.git(self.origin, "init", "-b", "main")
        self.git(self.origin, "config", "user.email", "test@example.invalid")
        self.git(self.origin, "config", "user.name", "Test")
        (self.origin / "skills").mkdir()
        for name, content in {
            "CONTEXT_VERSION": "test-context-v1\n",
            "AGENTS.md": "# Canonical rules\nKeep Git canonical.\n",
            "STATE.md": "# State\n\n## Latest\nVerified milestone.\n",
            "skills/INDEX.md": "# Skills\nRead the correct skill.\n",
        }.items():
            (self.origin / name).write_text(content)
        self.git(self.origin, "add", ".")
        self.git(self.origin, "commit", "-m", "fixture")
        self.repo = base / "bamware-ai"
        self.git(base, "clone", str(self.origin), str(self.repo))

    @staticmethod
    def git(path, *args):
        return subprocess.run(["git", "-C", str(path), *args],
                              check=True, capture_output=True, text=True).stdout.strip()

    def test_fresh_bamware_session_loads_pinned_remote_context(self):
        payload = {"cwd": str(self.repo), "extra": {"is_first_turn": True}}
        result = bridge().handle(payload, self.repo)
        self.assertIn("test-context-v1", result.get("context", ""))
        self.assertIn("Keep Git canonical", result["context"])
        self.assertIn(self.git(self.origin, "rev-parse", "HEAD"), result["context"])
        self.assertIn("Verified milestone", result["context"])

    def test_stale_checkout_is_reported_not_merged(self):
        old_head = self.git(self.repo, "rev-parse", "HEAD")
        (self.origin / "CONTEXT_VERSION").write_text("test-context-v2\n")
        self.git(self.origin, "commit", "-am", "new context")
        result = bridge().handle({"cwd": str(self.repo)}, self.repo)["context"]
        self.assertIn("test-context-v2", result)
        self.assertIn("CHECKOUT_DIFFERS", result)
        self.assertEqual(self.git(self.repo, "rev-parse", "HEAD"), old_head)

    def test_dirty_worktree_is_reported_not_overwritten(self):
        (self.repo / "AGENTS.md").write_text("local work in progress")
        result = bridge().handle({"cwd": str(self.repo)}, self.repo)["context"]
        self.assertIn("LOCAL_EDITS_UNPUBLISHED", result)
        self.assertEqual((self.repo / "AGENTS.md").read_text(), "local work in progress")

    def test_failed_fetch_returns_explicit_stop_without_cached_facts(self):
        self.git(self.repo, "remote", "set-url", "origin", str(self.repo / "missing"))
        result = bridge().handle({"cwd": str(self.repo)}, self.repo)
        self.assertIn("BAMWARE_CONTEXT_BLOCKED", result["context"])
        self.assertNotIn("Keep Git canonical", result["context"])

    def test_repeated_turn_does_not_reload_successful_bootstrap(self):
        payload = {"cwd": str(self.repo), "extra": {
            "is_first_turn": False,
            "conversation_history": [{"role": "user", "content": "[BAMWARE_CONTEXT_CHECK] verified"}]}}
        self.assertEqual(bridge().handle(payload, self.repo), {})

    def test_desktop_session_bootstraps_even_when_server_cwd_is_not_project(self):
        payload = {"cwd": "/tmp/hermes-server", "extra": {
            "platform": "desktop", "is_first_turn": True, "user_message": "Where did we leave off?"}}
        self.assertIn("test-context-v1", bridge().handle(payload, self.repo).get("context", ""))

    def test_bamware_mention_outside_repo_bootstraps(self):
        payload = {"cwd": "/tmp/other", "extra": {"user_message": "Help with Bamware"}}
        self.assertIn("test-context-v1", bridge().handle(payload, self.repo).get("context", ""))

    def test_sibling_repo_bootstraps(self):
        sibling = self.repo.parent / "bamware-web" / "src"
        sibling.mkdir(parents=True)
        self.assertIn("test-context-v1", bridge().handle({"cwd": str(sibling)}, self.repo).get("context", ""))

    def test_unrelated_session_is_noop(self):
        self.assertTrue(SCRIPT.exists(), "context adapter has not been implemented")
        result = bridge().handle({"cwd": "/tmp/other", "extra": {
            "is_first_turn": True, "user_message": "explain photosynthesis"}}, ROOT)
        self.assertEqual(result, {})


class InstallTests(unittest.TestCase):
    def test_configuration_plan_preserves_existing_entries_and_is_idempotent(self):
        path = ROOT / "scripts" / "install-hermes.py"
        self.assertTrue(path.exists(), "reproducible installer missing")
        spec = importlib.util.spec_from_file_location("install_hermes", path)
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        current = {"skills.external_dirs": ["/existing/skills"],
                   "hooks.pre_llm_call": [{"command": "/existing/hook", "timeout": 3}]}
        plan = module.settings(current, ROOT)
        self.assertEqual(plan["skills.external_dirs"], ["/existing/skills", str(ROOT / "skills")])
        self.assertEqual(plan["hooks.pre_llm_call"][0], current["hooks.pre_llm_call"][0])
        self.assertEqual(len(plan["hooks.pre_llm_call"]), 2)
        self.assertEqual(module.settings(plan, ROOT), plan)
        self.assertNotIn("approvals.mode", plan)
        self.assertNotIn("hooks_auto_accept", plan)


if __name__ == "__main__":
    unittest.main()
