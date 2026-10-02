# Overnight Mode

A small server-owned executor for an explicitly selected, authorized batch.
It reuses systemd user services and the existing engineering runtimes. It is
not Hermes, a new model provider, or an automatic source of work authorization.

## Handoff contract

Say **“Ready, good night.”** only when the approved batch has passed preflight,
the verified Intel server has linger enabled, its detached systemd service is
active, and the service records an actual child-process pickup. A ticket label,
PR, or approved plan alone is never pickup. A synthetic batch prints a different
message and does not authorize real work. This is evidence of readiness, not a
guarantee that no new blocker will appear.

The user selects the tickets. Before generating the manifest, the coordinator
resolves scope, dependencies, acceptance checks, permissible actions, model
budget and missing decisions. Inspect actual runtime authentication and its
noninteractive permission policy. Do not weaken safeguards or assume a read-only
command proves permission for a later merge. GitHub has no universal safe dry-run
for creating or merging a PR; unresolved authorization must remain unresolved.
Never mark `approved: true` merely because a ticket has the `night` label.

## Manifest and use

Run on the server with Python 3 (standard library only):

```sh
python3 services/overnight/runner.py start /absolute/path/batch.json
python3 services/overnight/runner.py status /absolute/path/to/run-directory
```

A manifest uses `schema: 1`, `unresolved_decisions: []`, and a nonempty `tasks`
array. Each task requires:

- `id`: stable ticket reference; `approved`: explicit true after review.
- `cwd`: existing absolute path to an isolated worktree.
- `argv`: argv array for the existing runtime/adapter; no implicit shell.
- `preflight`: nonempty list of argv arrays checking that task's capabilities.
- `verify`: nonempty list of independent acceptance-check argv arrays.
- `timeout_seconds`: bounded wall time (1–14,400 seconds).
- `depends_on`: optional earlier task ids. Only verified dependencies unblock.

Use `smoke_test: true` for synthetic tests. Commands are trusted coordinator
inputs, never raw instructions imported from email or issue comments. Supply no
credentials in argv or the manifest. Configure worker output to exclude secrets,
private email and transcripts; local logs are private but not automatically
redacted. Do not publish them to GitHub, Discord or Langfuse.

All preflights must pass before launch. Workers get EOF on stdin, so they cannot
hold an interactive permission prompt open indefinitely. Each task has a hard
timeout; its process group is terminated on expiry. Failed, timed-out and
verification-failed work is recorded, dependent work is skipped, and independent
work continues. Exit zero alone does not mean completion. Verification commands
must assert actual acceptance criteria; `true` is only suitable for synthetic
fixtures. QA/merge permissions still follow the existing qa-engineer rules.

A host-wide lock prevents overlapping batches. There is no automatic retry of
permission denials, unbounded model loop, or automatic restart after reboot.
Private state is under `~/.local/state/bamware/overnight/<run>/`: the frozen
manifest, launch receipt, worker pickup, per-task state and logs, and final
`report.txt`. `status` also checks the systemd unit, so a crashed worker isn't
mistaken for a live one. RuntimeMaxSec bounds the whole batch. Stopping the unit
kills its descendants. Inspect partial work before any manual rerun.

## First implementation verification, 2026-10-02

Four automated tests cover failed preflight, unresolved approval, timeout/failure
continuation and rejection of exit-zero without acceptance evidence.
A server smoke test is separate from a real engineering batch. A successful
smoke test does not prove model authentication, review/merge permissions,
provider quotas, dashboard deployment or scheduled morning reporting.

Pending integration: select the first real tickets and verified runtime adapter,
then connect this local report to the existing morning briefing. The executor
currently provides a report file, not automatic Discord delivery or dashboard UI.
Rate-limit recovery/rotation and provider-reset detection are not implemented.

Server smoke evidence: unit `bamware-overnight-1790919163361036513` on
MacBookPro16,4 (62 GiB), linger enabled. After the launching SSH connection
closed, a synthetic failing task exited 3, a hung task timed out, and independent
work wrote an artifact that a separate command checked. Reconnection showed
`phase=finished`, task states failed/timed_out/verified and systemd Result=success.
No real engineering agent was launched; no production work was claimed complete.
