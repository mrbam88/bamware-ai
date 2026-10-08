# CFO burn alert

Deterministic quota burn-rate detection for #101. No model calls: detection
must not spend the allowance it protects. Owner: CFO (`docs/bamware-agent-operating-system-prd.md`).

## What runs where (omarchy)

| Step | Process | Cadence |
|---|---|---|
| Collect OpenAI windows | `ai-quota-sample.timer` → `collect-server-quota.py` → `~/.local/state/bamware/server-quota.json` | every 10 min |
| Collect Claude Max meters | bamware-web `ai-quota-sample.ts` (Claude Code's `/usage` endpoint) → `ai-quota-samples.jsonl` (`AI_QUOTA_SAMPLES_PATH`) | every 10 min |
| Collect Copilot premium quota | `burn_alert.py` → `gh api /copilot_internal/user` | every run |
| Evaluate, persist, alert | `bamware-cfo-burn-alert.timer` → `burn_alert.py` | every 10 min, 3 min after the collector |
| Deliver (alerts) | `scripts/discord-post.sh` (`BAMWARE_POST_TO=assistant`, #bamware-bot) | on escalation |
| CoS capacity brief | `scripts/cfo-capacity-snapshot.sh` → stdout or `#cron` (`BAMWARE_POST_TO=cron`) | on demand / optional timer |

State: `~/.local/state/bamware/cfo/state.json` (per-window history, sent level,
pending retries). Delivery log: `cfo/alerts.jsonl` records every attempt and
whether Discord accepted it. Accepted by Discord is not proof of a phone push.

## Policy

Reserve starts at 85% used. **Warn** at 80% used, or when the last hour's burn
rate reaches the reserve within 24 h and before the reset. **Critical** at 95%,
or when it reaches exhaustion within 6 h and before the reset. One alert per
escalation; a reset rollover starts a new trend. Nothing is switched
automatically.

**Monitoring itself is monitored.** No fresh data from a source for 30 min is
a "monitoring stale" warning. Still dark after 6 h, it escalates to critical:
one more message, naming how long the source has been blind, the last known
reading of each of its pools, and the command that shows why the collector
stopped. When the source reports again, one "monitoring restored" line closes
the loop. Cause: on 2026-10-03 the Claude sampler got HTTP 429 for 34 h; the
CFO warned once at 06:43 and said nothing more (#133).

## Self-verification

The detector checks its own work instead of trusting its math.

- **Forecast ledger.** Every 30 min it records the raw model's prediction for
  one hour ahead. When the API's reading for that time arrives, the forecast
  is graded (`state.json` → `calibration`). `--calibration` prints accuracy.
- **Self-correction.** After 6+ graded forecasts, if the burn consistently ran
  hotter than predicted, the rate is multiplied by the observed ratio (capped
  at ×2). It never goes below ×1: the correction can make alerts earlier, never
  later. Alerts state their own recent accuracy and the correction applied.
- **Cross-source check.** The OpenAI reading is compared with the rate limits
  Codex records in its own session logs. A gap over 5 pts raises a "self-check
  failed" alert. Readings more than 30 min apart are not compared, so this
  check only runs when Codex has been used on the server recently.

## Cost metering (#107)

`meter.py` measures what each executor task costs in **% of each pool's
window**, the real currency on subscription plans. The runner
(`services/overnight/runner.py`) calls it before and after every task; tasks
run one at a time, so the delta is that task's cost. Records land in
`~/.local/state/bamware/cfo/costs.jsonl` and on the task's `status.json` entry.

- A reset during a task makes that pool's cost unknown, never negative.
- Other Claude sessions running at the same time mark the record `shared`
  (they draw on the same Claude Max pool); otherwise `exclusive`.
- Metering never blocks work: a missing or failing meter records `unmetered`.
  `BAMWARE_METER=off` disables it.
- `meter.py`'s OpenAI collector defaults to the one main checkout
  (`~/code/worktrees/bamware-ai-main/services/assistant-web/scripts/collect-server-quota.py`,
  #110); override with `BAMWARE_OPENAI_COLLECTOR` only for local testing.

## Commands

```
python3 services/cfo/burn_alert.py --replay services/cfo/fixtures/incident-101.json   # safe replay, never posts
python3 services/cfo/burn_alert.py --dry-run     # evaluate live data, print, change no state
python3 services/cfo/burn_alert.py --status      # the CFO check: every source's health, every pool (reads capacity.json)
python3 services/cfo/burn_alert.py --calibration # forecast accuracy, learned correction, cross-checks
python3 services/cfo/meter.py summary --days 7    # cost per ticket and per day, in % of each pool
python3 -m unittest discover -s services/cfo      # from the repo root
journalctl --user -u ai-quota-sample.service -n 20  # why a collector stopped (Claude sampler + OpenAI collector)
systemctl --user list-timers bamware-cfo-burn-alert.timer
```

Install on omarchy:
```
git -C ~/code/bamware-ai worktree add --detach ~/code/worktrees/bamware-ai-main origin/main
cp ~/code/worktrees/bamware-ai-main/scripts/systemd/bamware-cfo-burn-alert.* ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now bamware-cfo-burn-alert.timer
```

## Limits and next steps

- Covered: OpenAI (Codex) windows, Claude Max (5-hour session, weekly, Fable
  weekly share) and Copilot premium requests. Not yet: Grok, Cursor, Google
  (no known usage API for those plans).
- The Claude samples file lives in a bamware-web worktree today; move it to a
  stable path with `AI_QUOTA_SAMPLES_PATH` when that service is productized.
- The Claude sampler (`ai-quota-sample.ts`) gives up on a 429 from the usage
  endpoint and does not back off or re-login; it was dark 2026-10-03 09:40 UTC
  to 2026-10-04 19:25 UTC. The CFO now escalates (above) but cannot restart it.
  Fix belongs in bamware-web.
- Stale escalation stops at critical; a source dark for days gets two
  messages, not a daily reminder.
- Replay of the #101 incident fires at 43% used, 83 min before the 92% stage.
  10-min sampling cannot beat a sudden provider-side change.
- Not yet: Command Center card (owner-blockers ledger), dispatch-pause policy.
