#!/usr/bin/env python3
"""Does deployed code still match `main`? Deterministic answer (#110).

Reads every systemd **user** unit file on disk (base `.service` plus any
`.service.d/*.conf` drop-in, which systemd applies on top — a drop-in's
`WorkingDirectory=`/`ExecStart*=` can silently replace the base file's,
exactly how `scripts/deploy-assistant-web.sh` and the digest timers work).
Never calls `systemctl`: this is a static read of unit files, not the live
unit state.

For every absolute path referenced by `WorkingDirectory`, `ExecStart`,
`ExecStartPre` or `ExecStartPost`, resolves the nearest git checkout (walking
up to the first `.git`) and classifies it:

  OK       detached or on `main`, clean, and an ancestor of `origin/main`
           (it may be behind — that is a normal pre-cutover lag, not drift)
  MISMATCH on a named branch other than `main`, has uncommitted changes,
           has diverged from `origin/main` (not an ancestor), or lives under
           a retired path pattern (`/srv/`, `.claude/worktrees/`)
  UNKNOWN  not a git checkout, or `origin/main` is not resolvable locally
           (this script never runs `git fetch`; it is read-only)

Usage:
  python3 scripts/check-deployed-drift.py [--units-dir DIR] [--home DIR]

Exit 0 if every resolved checkout is OK or UNKNOWN; 1 if any is MISMATCH.
"""
import argparse
from pathlib import Path
import shlex
import subprocess
import sys

DIRECTIVE_KEYS = ("WorkingDirectory", "ExecStart", "ExecStartPre", "ExecStartPost")
RETIRED_PATH_PATTERNS = ("/srv/", "/.claude/worktrees/")


def parse_directives_into(text, directives):
    """Apply [Service] directives from one file onto a shared, running {key: [values]}
    dict, in file order. An empty assignment is systemd's reset: it clears whatever
    this key accumulated so far (from this file OR an earlier one), so a later
    drop-in can fully replace a base file's value rather than append to it."""
    in_service = False
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith(";"):
            continue
        if line.startswith("[") and line.endswith("]"):
            in_service = line == "[Service]"
            continue
        if not in_service or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if key not in DIRECTIVE_KEYS:
            continue
        if value == "":
            directives[key] = []  # systemd reset: clears prior assignments for this key
        else:
            directives.setdefault(key, []).append(value)
    return directives


def parse_directives(text):
    """[Service] directives in file order, as {key: [values]} (comments/blank lines skipped)."""
    return parse_directives_into(text, {})


def effective_directives(service_file: Path):
    """Base unit file, then its `<name>.service.d/*.conf` drop-ins in sorted order."""
    directives = parse_directives_into(service_file.read_text(encoding="utf-8"), {})
    dropin_dir = service_file.with_name(service_file.name + ".d")
    if dropin_dir.is_dir():
        for conf in sorted(dropin_dir.glob("*.conf")):
            parse_directives_into(conf.read_text(encoding="utf-8"), directives)
    return directives


def expand_specifiers(value: str, home: str):
    return value.replace("%h", home).replace("%H", home)


def absolute_paths(value: str):
    """Top-level absolute-path-looking tokens in an exec line (no shell recursion)."""
    try:
        tokens = shlex.split(value)
    except ValueError:
        return []
    return [t for t in tokens if t.startswith("/")]


def find_repo_root(start: Path):
    path = start if start.is_dir() else start.parent
    for candidate in (path, *path.parents):
        if (candidate / ".git").exists():
            return candidate
    return None


def git(repo_root: Path, *args):
    """stdout on success, None on any failure (never raises)."""
    result = subprocess.run(["git", "-C", str(repo_root), *args], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


def git_ok(repo_root: Path, *args):
    """True/False by exit code alone, for commands with no useful stdout."""
    return subprocess.run(["git", "-C", str(repo_root), *args], capture_output=True).returncode == 0


def repo_status(repo_root: Path):
    branch = git(repo_root, "symbolic-ref", "-q", "--short", "HEAD")  # None when detached
    commit = git(repo_root, "rev-parse", "HEAD")
    dirty = git(repo_root, "status", "--porcelain") != ""
    origin_main = git(repo_root, "rev-parse", "origin/main")
    is_ancestor = git_ok(repo_root, "merge-base", "--is-ancestor", commit, "origin/main") if commit and origin_main else None
    return {"branch": branch, "commit": commit, "dirty": dirty, "origin_main": origin_main, "is_ancestor": is_ancestor}


def classify(repo_root: Path, referenced_path: str):
    status = repo_status(repo_root)
    reasons = []
    for pattern in RETIRED_PATH_PATTERNS:
        if pattern in str(repo_root) or pattern in referenced_path:
            reasons.append(f"path matches retired pattern {pattern!r}")
    if status["commit"] is None:
        return "UNKNOWN", ["could not read HEAD"], status
    if status["dirty"]:
        reasons.append("uncommitted local changes")
    if status["branch"] and status["branch"] != "main":
        reasons.append(f"on branch '{status['branch']}', not main")
    if status["origin_main"] is None:
        if not reasons:
            return "UNKNOWN", ["origin/main not resolvable locally (read-only check; no fetch attempted)"], status
    elif status["commit"] != status["origin_main"]:
        if status["is_ancestor"]:
            reasons.append(f"behind origin/main ({status['commit'][:12]} is an ancestor, not current)")
        else:
            reasons.append("diverged from origin/main (commit is not an ancestor)")
    verdict = "MISMATCH" if any("not main" in r or "diverged" in r or "retired pattern" in r or "uncommitted" in r
                                 for r in reasons) else "OK"
    return verdict, reasons, status


def iter_checkouts(units_dir: Path, home: str):
    """Yield (unit_name, directive_key, referenced_path, repo_root) for every resolvable checkout."""
    seen = set()
    for service_file in sorted(units_dir.glob("*.service")):
        directives = effective_directives(service_file)
        for key, values in directives.items():
            for value in values:
                expanded = expand_specifiers(value, home)
                for path_str in absolute_paths(expanded):
                    path = Path(path_str)
                    if not path.exists():
                        continue
                    repo_root = find_repo_root(path)
                    if repo_root is None:
                        continue
                    dedup_key = (service_file.name, str(repo_root))
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)
                    yield service_file.name, key, path_str, repo_root


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--units-dir", type=Path, default=Path.home() / ".config/systemd/user")
    parser.add_argument("--home", default=str(Path.home()))
    args = parser.parse_args(argv)

    if not args.units_dir.is_dir():
        print(f"no such unit directory: {args.units_dir}")
        return 1

    rc = 0
    any_checkout = False
    for unit, key, path_str, repo_root in iter_checkouts(args.units_dir, args.home):
        any_checkout = True
        verdict, reasons, status = classify(repo_root, path_str)
        where = status["branch"] or (f"detached@{status['commit'][:12]}" if status["commit"] else "unknown")
        print(f"{unit} [{key}] -> {repo_root} ({where}): {verdict}")
        for reason in reasons:
            print(f"  - {reason}")
        if verdict == "MISMATCH":
            rc = 1
    if not any_checkout:
        print("no unit referenced a path inside a git checkout")
    return rc


if __name__ == "__main__":
    sys.exit(main())
