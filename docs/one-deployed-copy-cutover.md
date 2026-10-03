# One deployed copy: morning cutover checklist (#110)

**Status:** not executed. Written by the overnight worker for Bilal/the
Engineering Lead to run by hand on `omarchy`. Nothing in this document has
been run; every command below is a recommendation, not a completed action.

Read `docs/engineering-operating-contract.md` → "One deployed copy" first.
Run `python3 scripts/check-deployed-drift.py` before and after every step —
its output is the source of truth, not this checklist's assumptions.

## What tonight's drift check actually found (2026-10-03, read-only)

Two collisions beyond the five in `docs/incidents.md` are **currently live**,
not just historical:

1. `bamware-digest-morning.service` and `bamware-digest-evening.service` run
   `discord-digest.sh` from `~/srv/bamware-ai` (branch
   `worktree-assistant-web-slice`, 5 commits behind `origin/main` but merged —
   not divergent, just stale and on the wrong path).
2. `ai-quota-sample.service`'s `ExecStartPre` runs `collect-server-quota.py`
   from the same `~/srv/bamware-ai` path (CFO's OpenAI/Codex collector).

Both exist only in a systemd drop-in (`*.service.d/*.conf`), **not** the base
`.service` file — `grep`-ing the base files alone misses them. This is why
the drift checker reads drop-ins too.

`assistant-web.service` and `bamware-cfo-burn-alert.service` already run from
`~/code/worktrees/bamware-ai-main`, detached, an ancestor of `origin/main`
(a few commits behind — normal lag, not drift). No action needed for those
two tonight.

`ai-quota-sample.service`'s own `WorkingDirectory`/`ExecStart` (not the
`ExecStartPre` above) still runs from
`~/code/bamware-web/.claude/worktrees/ai-spend-dashboard` on a branch that has
**diverged** from `bamware-web`'s `origin/main` (not just behind — real
unmerged commits). That is collision 5/item 3, owned by a separate overnight
task in `bamware-web` (worktree `overnight/110-quota-sampler` already exists
for it on this host). Do not repoint it from this checklist; coordinate with
that PR.

## Order

Each step: make the change, reload/restart only what that step touched,
verify, then move on. Do not batch steps — a half-done batch is harder to
diagnose than one slow step at a time.

### 1. Repoint the Discord digest units off `~/srv/bamware-ai`

```sh
cp ~/.config/systemd/user/bamware-digest-morning.service.d/override.conf \
   ~/.config/systemd/user/bamware-digest-morning.service.d/override.conf.bak
cp ~/.config/systemd/user/bamware-digest-evening.service.d/override.conf \
   ~/.config/systemd/user/bamware-digest-evening.service.d/override.conf.bak
```

Edit both `override.conf` files: replace
`ExecStart=%h/srv/bamware-ai/scripts/discord-digest.sh <morning|evening>`
with `ExecStart=%h/code/worktrees/bamware-ai-main/scripts/discord-digest.sh <morning|evening>`.

```sh
systemctl --user daemon-reload
systemctl --user start bamware-digest-morning.service   # fires one digest now; confirm it posts
python3 ~/code/worktrees/bamware-ai-main/scripts/check-deployed-drift.py   # the two MISMATCH lines for these units should be gone
```

**Rollback:** restore the `.bak` files over the edited ones, `systemctl --user daemon-reload`.

### 2. Repoint the OpenAI/Codex collector off `~/srv/bamware-ai`

```sh
cp ~/.config/systemd/user/ai-quota-sample.service.d/server-quota.conf \
   ~/.config/systemd/user/ai-quota-sample.service.d/server-quota.conf.bak
```

Edit `server-quota.conf`: replace
`ExecStartPre=-/usr/bin/python3 %h/srv/bamware-ai/services/assistant-web/scripts/collect-server-quota.py`
with
`ExecStartPre=-/usr/bin/python3 %h/code/worktrees/bamware-ai-main/services/assistant-web/scripts/collect-server-quota.py`.

```sh
systemctl --user daemon-reload
systemctl --user start ai-quota-sample.service
cat ~/.local/state/bamware/server-quota.json   # confirm a fresh observed_at
```

This PR already repoints `services/cfo/meter.py`'s `BAMWARE_OPENAI_COLLECTOR`
default to the same `bamware-ai-main` path (`scripts/collect-server-quota.py`
itself is kept — `meter.py` and the CFO's OpenAI source both depend on it).
After this step, the systemd override and the Python default agree; the
override can stay (explicit) or be deleted to let the code default take over
— either is fine, deleting it is not required tonight.

**Rollback:** restore `server-quota.conf.bak`, `systemctl --user daemon-reload`.

### 3. Remove the two parallel worktrees (item 2)

Both `~/srv/quota-coverage-81` (`feat/quota-coverage-81`) and
`~/srv/admin-migration-82` (`feat/admin-migration-82`) were checked tonight:
**every commit on both branches is already an ancestor of `origin/main`**,
and both working trees are clean. There is nothing to port — confirm with
`git -C ~/srv/bamware-ai log <branch> --not origin/main` (empty output) before
deleting, in case new commits land on either branch between now and cutover.

```sh
git -C ~/srv/bamware-ai worktree remove ~/srv/quota-coverage-81
git -C ~/srv/bamware-ai worktree remove ~/srv/admin-migration-82
git -C ~/srv/bamware-ai worktree list   # confirm only the main checkout remains
```

**Rollback:** `git -C ~/srv/bamware-ai worktree add ~/srv/quota-coverage-81 feat/quota-coverage-81`
(same for admin-migration-82) — the branches still exist on `origin` either way.

### 4. Archive `~/srv/bamware-ai` itself

Only after steps 1–3: confirm nothing still references it.

```sh
python3 ~/code/worktrees/bamware-ai-main/scripts/check-deployed-drift.py   # expect zero MISMATCH lines under /srv/
grep -rl 'srv/bamware-ai' ~/.config/systemd/user   # expect no output
```

Then move it aside rather than deleting outright (reversible for a few days):

```sh
mv ~/srv/bamware-ai ~/srv/bamware-ai.archived-2026-10-03
```

**Rollback:** `mv ~/srv/bamware-ai.archived-2026-10-03 ~/srv/bamware-ai`.

### 5. `~/srv/overnight-mode`

Not found on this host tonight (checked read-only; no such directory). Either
it was already archived when collision 1 was fixed, or it never existed
under that name on this machine. No action — just confirm with `ls ~/srv`
before assuming step 5 of the original ticket is done.

### 6. `bamware-web`'s sampler cutover (coordinate with the other overnight task; do not run from here)

When `bamware-web`'s `overnight/110-quota-sampler` work lands on `bamware-web`
`main` and a `bamware-web-main` checkout exists on omarchy:

1. Repoint `ai-quota-sample.service`'s base `WorkingDirectory`/`ExecStart`
   from `~/code/bamware-web/.claude/worktrees/ai-spend-dashboard` to that
   main checkout.
2. Set `AI_QUOTA_SAMPLES_PATH=~/.local/state/bamware/ai-quota-samples.jsonl`
   in **both** `ai-quota-sample.service` (or its drop-in) **and**
   `~/.config/systemd/user/bamware-cfo-burn-alert.service`, in the same step.
3. `systemctl --user daemon-reload && systemctl --user restart ai-quota-sample.service bamware-cfo-burn-alert.service`.
4. Verify a fresh sample is read by the CFO (`burn_alert.py --dry-run`, check
   `claude-max` is not "monitoring stale").
5. Only then, in a follow-up PR, change `services/cfo/burn_alert.py`'s
   `CLAUDE_SAMPLES` default and `services/cfo/README.md` to match. Changing
   the code default before steps 2–4 makes the CFO report claude-max
   monitoring stale after ~30 minutes (coordinator correction, 2026-10-03).

**Rollback:** revert the unit env var and the override, restart both units;
the old `.claude/worktrees` path still exists until its own archive step.

### 7. Final check

```sh
python3 ~/code/worktrees/bamware-ai-main/scripts/check-deployed-drift.py
```

Expect exit 0 with no `MISMATCH` lines under `bamware-ai`'s units. Any
remaining `bamware-web` mismatch belongs to the other ticket, not this one.

## Not in this checklist (separate decision, flagged for Bilal)

- `~/code/bamware-ai` (the non-worktree clone other worktrees attach to) is
  currently on branch `spike/video-gen` with one uncommitted file. Nothing
  found tonight executes service code from it, but `assistant-web.service`'s
  `HERMES_CWD` environment variable points there so `hermes-context.py` can
  recognize a Bamware directory — it reads only for context detection, not
  for code. Worth a decision on whether `HERMES_CWD` should instead point at
  a stable `main` checkout so Hermes context doesn't depend on whatever
  branch this clone happens to be on; not required for this ticket's
  acceptance criteria.
- `~/srv/bamware-web-admin-82` is a **separate repo** (`bamware-web`, branch
  `feat/private-admin-82`, 1 commit behind its `origin/main`, clean). It is
  not a `bamware-ai` collision; leave it to whatever `bamware-web` ticket
  owns that migration.
