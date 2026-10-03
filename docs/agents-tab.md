# Agents tab (V3)

One question, answered in under five seconds: **is the machine working right
now, on what, what is blocking it, and can I afford it?** Built 2026-10-03 from
the Engineering Lead's review. Code: `services/assistant-web/lib/agents-status.mjs`,
`lib/board.mjs`, `GET /api/agents`, the agents section of `public/app.js`.

| Section | Shows | Source of truth |
|---|---|---|
| Status banner | Paused / running / waiting on you / idle, in that priority | `emergency-stop.json` (plus `/proc` for which recorded sessions are still frozen), executor runs, the sections below |
| Needs you | Owner blockers waiting on the founder, unplanned batch checkpoints | `owner-blockers/*.json` (titles from the Decisions catalog when a record has none), `batches/<date>.json` |
| Now | Running and queued tasks, then recent tasks with their real state, duration, exit code and cost | Overnight executor `overnight/<run>/status.json` + `batch.json`; cost from `services/cfo/meter.py` |
| Capacity | Each pool: % used, reset, alert level, burn-rate forecast or "safe until reset" | `cfo/capacity.json`, published by the CFO burn alert every 10 min. The page never recomputes it |
| Board | Counts by status and in-progress items by priority | GitHub Projects board 2 via the server's `gh`, cached 5 min |

All paths are under `~/.local/state/bamware/` (`ASSISTANT_WEB_STATE_DIR`).
`ASSISTANT_WEB_BOARD=0` turns the board and title reads off. Rows show the
ticket's real title (GitHub, cached 6 h) or the batch task's own `title`, never a
bare number (founder, 2026-10-03). Unknown is shown as unknown;
stale CFO data (over 25 min) is labelled stale. The runner requires each batch task to
carry a `ticket` (for example `mrbam88/bamware-ai#75`) or a `title`.

Removed in V3: the work tree, the work-usage list, active agents, work vs
waiting, outcomes, model routing, demo toggles, and the hard-coded Oct 2
overnight export and issue-title cache.
