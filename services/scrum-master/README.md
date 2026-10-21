# Scrum Master board sweep

A deterministic, read-only collector for the `scrum-master` Hermes profile
(#98). It reads the Projects board, plus the issue, linked PRs and PR checks
for each active item, through `gh`. It flags delivery problems and writes a
receipt. It never writes to GitHub and makes no model calls.

**Why it's a script:** Hermes cron blocks `execute_code` and `bash -c`
because no one is there to approve them. When the sweep was prompt-only, the
model wrote its own unreviewed script in `/tmp`, and it failed. This replaces
that improvisation (2026-10-03).

## Flags (most urgent first)

`failing-checks`, `merged-but-active`, `closed-but-active`, `qa-without-pr`,
`in-progress-no-worker`, `no-owner`, `stale-72h` (no update in 72 h),
`no-status`. Active means any status except Done, Backlog or Ideas.

## Run

```sh
python3 services/scrum-master/board_sweep.py --project 2 --owner mrbam88 \
  --state-dir ~/.local/state/bamware/scrum-master
python3 -m unittest discover -s services/scrum-master 
```

It writes `sweeps/<UTC>.json` and `latest.json` to the state dir. The Chief
of Staff reads `latest.json`. It prints a short JSON summary on stdout. If a
gh call fails, it's recorded under `source_failures` and the item goes in
`unknowns`; it is never silently skipped.

## Where it runs

On omarchy, from `~/code/worktrees/bamware-ai-main` (the one deployed copy).
Hermes cron job `85076cec9bb9` (09:00 and 17:00 ET) runs it through
`config/hermes/scrum-master/board-sweep.sh`, installed at
`~/.hermes/profiles/scrum-master/scripts/`. The model then only summarizes
the output, following `config/hermes/scrum-master/sweep-prompt.md`. A full run
takes about 9 s for 195 items.

## Claims and the batch lock (#117)

`claims.py` keeps ticket claims and the one-batch-per-night lock in the same
ledger the resident Scrum Master uses, `.scrum-master.json` in the
assistant-web state dir (`~/.local/state/bamware/`; override with
`--ledger` or `BAMWARE_LEDGER`). It adds `claims`, `batches` and
`claimReceipts` keys; assistant-web preserves them. It never creates the
ledger. Writes take a lock file beside the ledger and replace it atomically.

```sh
python3 services/scrum-master/claims.py status [--json]
python3 services/scrum-master/claims.py claim o/r#1 --by lead --purpose plan   # ttl 12h
python3 services/scrum-master/claims.py release o/r#1 --by lead [--force]
python3 services/scrum-master/claims.py batch begin --owner lead --tickets o/r#1,o/r#2
python3 services/scrum-master/claims.py batch approve|launch|finish <id> --by lead
python3 services/scrum-master/claims.py batch show [id]
```

A held ticket refuses with the holder and expiry. An expired claim can be
taken; the takeover (or expiry) is written to `claimReceipts`. A batch is
`planning -> approved -> launched -> finished`; `begin` claims every ticket
for `batch:<id>` all-or-nothing and is refused while another batch is
planning, approved or launched. A paused or revoked mandate blocks `claim` and
`batch begin`. Over SSH, `ssh server python3 .../claims.py status` reads the
same file as a local run. Tests: `test_claims.py`.
