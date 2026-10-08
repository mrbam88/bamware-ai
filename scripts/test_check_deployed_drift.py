"""Fixture-based tests for check-deployed-drift.py (#110). No real server state."""
import importlib.util
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "check-deployed-drift.py"


def load():
    spec = importlib.util.spec_from_file_location("check_deployed_drift", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


drift = load()


def run(repo, *args):
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return result.stdout.strip()


def init_repo(root: pathlib.Path):
    root.mkdir(parents=True, exist_ok=True)
    run(root, "init", "-q", "-b", "main")
    run(root, "config", "user.email", "test@example.invalid")
    run(root, "config", "user.name", "Test")
    (root / "f.txt").write_text("a")
    run(root, "add", "f.txt")
    run(root, "commit", "-q", "-m", "first")
    first = run(root, "rev-parse", "HEAD")
    (root / "f.txt").write_text("b")
    run(root, "add", "f.txt")
    run(root, "commit", "-q", "-m", "second")
    second = run(root, "rev-parse", "HEAD")
    return first, second


def set_origin_main(root: pathlib.Path, commit: str):
    run(root, "update-ref", "refs/remotes/origin/main", commit)


class ParseDirectivesTests(unittest.TestCase):
    def test_reset_then_set_clears_prior_value(self):
        text = "[Service]\nWorkingDirectory=/old\nWorkingDirectory=\nWorkingDirectory=/new\n"
        self.assertEqual(drift.parse_directives(text)["WorkingDirectory"], ["/new"])

    def test_only_service_section_is_read(self):
        text = "[Unit]\nExecStart=/should/not/appear\n[Service]\nExecStart=/real\n"
        self.assertEqual(drift.parse_directives(text)["ExecStart"], ["/real"])

    def test_comments_and_blank_lines_ignored(self):
        text = "[Service]\n# comment\n\nExecStart=/real\n"
        self.assertEqual(drift.parse_directives(text)["ExecStart"], ["/real"])


class EffectiveDirectivesTests(unittest.TestCase):
    def test_dropin_overrides_base_working_directory(self):
        tmp = pathlib.Path(tempfile.mkdtemp())
        unit = tmp / "svc.service"
        unit.write_text("[Service]\nWorkingDirectory=/base/path\nExecStart=/base/run\n")
        dropin = tmp / "svc.service.d"
        dropin.mkdir()
        (dropin / "override.conf").write_text("[Service]\nWorkingDirectory=\nWorkingDirectory=/override/path\n")
        effective = drift.effective_directives(unit)
        self.assertEqual(effective["WorkingDirectory"], ["/override/path"])
        self.assertEqual(effective["ExecStart"], ["/base/run"])

    def test_multiple_dropins_apply_in_sorted_order(self):
        tmp = pathlib.Path(tempfile.mkdtemp())
        unit = tmp / "svc.service"
        unit.write_text("[Service]\nExecStart=/base/run\n")
        dropin = tmp / "svc.service.d"
        dropin.mkdir()
        (dropin / "a-first.conf").write_text("[Service]\nExecStart=\nExecStart=/first\n")
        (dropin / "b-second.conf").write_text("[Service]\nExecStart=\nExecStart=/second\n")
        self.assertEqual(drift.effective_directives(unit)["ExecStart"], ["/second"])


class AbsolutePathsTests(unittest.TestCase):
    def test_extracts_top_level_paths_only(self):
        value = "/bin/sh -lc 'npm run --silent x && npm run --silent /inside/quotes'"
        self.assertEqual(drift.absolute_paths(value), ["/bin/sh"])

    def test_plain_interpreter_and_script(self):
        self.assertEqual(drift.absolute_paths("/usr/bin/python3 /opt/app/run.py"),
                          ["/usr/bin/python3", "/opt/app/run.py"])


class ClassifyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = pathlib.Path(self.tmp.name)

    def test_detached_at_current_main_is_ok(self):
        repo = self.base / "main-checkout"
        _, second = init_repo(repo)
        set_origin_main(repo, second)
        run(repo, "checkout", "-q", "--detach", second)
        verdict, reasons, _ = drift.classify(repo, str(repo))
        self.assertEqual(verdict, "OK")
        self.assertEqual(reasons, [])

    def test_detached_behind_main_is_ok_not_mismatch(self):
        repo = self.base / "lagging-checkout"
        first, second = init_repo(repo)
        set_origin_main(repo, second)
        run(repo, "checkout", "-q", "--detach", first)
        verdict, reasons, _ = drift.classify(repo, str(repo))
        self.assertEqual(verdict, "OK")
        self.assertTrue(any("behind" in r for r in reasons))

    def test_feature_branch_with_unmerged_commit_is_mismatch(self):
        repo = self.base / "feature-checkout"
        _, second = init_repo(repo)
        set_origin_main(repo, second)
        run(repo, "checkout", "-q", "-b", "feat/unmerged")
        (repo / "f.txt").write_text("c")
        run(repo, "add", "f.txt")
        run(repo, "commit", "-q", "-m", "unmerged work")
        verdict, reasons, _ = drift.classify(repo, str(repo))
        self.assertEqual(verdict, "MISMATCH")
        self.assertTrue(any("not main" in r for r in reasons))
        self.assertTrue(any("diverged" in r for r in reasons))

    def test_dirty_checkout_is_mismatch(self):
        repo = self.base / "dirty-checkout"
        _, second = init_repo(repo)
        set_origin_main(repo, second)
        run(repo, "checkout", "-q", "--detach", second)
        (repo / "f.txt").write_text("uncommitted")
        verdict, reasons, _ = drift.classify(repo, str(repo))
        self.assertEqual(verdict, "MISMATCH")
        self.assertTrue(any("uncommitted" in r for r in reasons))

    def test_retired_srv_path_is_mismatch_even_if_clean_and_current(self):
        repo = self.base / "srv" / "bamware-ai"
        _, second = init_repo(repo)
        set_origin_main(repo, second)
        run(repo, "checkout", "-q", "--detach", second)
        verdict, reasons, _ = drift.classify(repo, str(repo))
        self.assertEqual(verdict, "MISMATCH")
        self.assertTrue(any("retired pattern" in r for r in reasons))

    def test_no_origin_main_ref_is_unknown(self):
        repo = self.base / "no-origin"
        init_repo(repo)
        verdict, reasons, _ = drift.classify(repo, str(repo))
        self.assertEqual(verdict, "UNKNOWN")


class FindRepoRootTests(unittest.TestCase):
    def test_walks_up_to_git_root(self):
        tmp = pathlib.Path(tempfile.mkdtemp())
        repo = tmp / "repo"
        init_repo(repo)
        nested = repo / "a" / "b"
        nested.mkdir(parents=True)
        self.assertEqual(drift.find_repo_root(nested), repo)

    def test_non_repo_path_returns_none(self):
        tmp = pathlib.Path(tempfile.mkdtemp())
        self.assertIsNone(drift.find_repo_root(tmp))


class MainIntegrationTests(unittest.TestCase):
    """Builds a fake ~/.config/systemd/user and runs main() end to end."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = pathlib.Path(self.tmp.name) / "home"
        self.units = self.home / ".config/systemd/user"
        self.units.mkdir(parents=True)

    def test_clean_deployment_exits_zero(self):
        repo = self.home / "code/worktrees/bamware-ai-main"
        _, second = init_repo(repo)
        set_origin_main(repo, second)
        run(repo, "checkout", "-q", "--detach", second)
        (self.units / "good.service").write_text(
            "[Service]\nWorkingDirectory=%h/code/worktrees/bamware-ai-main\nExecStart=/usr/bin/true\n"
        )
        rc = drift.main(["--units-dir", str(self.units), "--home", str(self.home)])
        self.assertEqual(rc, 0)

    def test_srv_deployment_exits_nonzero(self):
        repo = self.home / "srv/bamware-ai"
        _, second = init_repo(repo)
        set_origin_main(repo, second)
        run(repo, "checkout", "-q", "--detach", second)
        (repo / "scripts").mkdir()
        (repo / "scripts" / "discord-digest.sh").write_text("#!/bin/sh\n")
        (self.units / "bad.service").write_text(
            "[Service]\nExecStart=%h/srv/bamware-ai/scripts/discord-digest.sh morning\n"
        )
        rc = drift.main(["--units-dir", str(self.units), "--home", str(self.home)])
        self.assertEqual(rc, 1)

    def test_dropin_override_is_what_gets_checked(self):
        """A unit whose base file points at a bad path but whose drop-in repoints it to main is OK."""
        bad = self.home / "srv/bamware-ai"
        init_repo(bad)
        good = self.home / "code/worktrees/bamware-ai-main"
        _, second = init_repo(good)
        set_origin_main(good, second)
        run(good, "checkout", "-q", "--detach", second)
        (self.units / "svc.service").write_text(
            "[Service]\nWorkingDirectory=%h/srv/bamware-ai\nExecStart=/usr/bin/true\n"
        )
        dropin = self.units / "svc.service.d"
        dropin.mkdir()
        (dropin / "override.conf").write_text(
            "[Service]\nWorkingDirectory=\nWorkingDirectory=%h/code/worktrees/bamware-ai-main\n"
        )
        rc = drift.main(["--units-dir", str(self.units), "--home", str(self.home)])
        self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main()
