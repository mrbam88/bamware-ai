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
| Deliver | `scripts/discord-post.sh` (`BAMWARE_POST_TO=assistant`, #bamware-bot) | on escalation |

State: `~/.local/state/bamware/cfo/state.json` (per-window history, sent level,
pending retries). Delivery log: `cfo/alerts.jsonl` records every attempt and
whether Discord accepted it. Accepted by Discord is not proof of a phone push.

## Policy

Reserve starts at 85% used. **Warn** at 80% used, or when the last hour's burn
rate reaches the reserve within 24 h and before the reset. **Critical** at 95%,
or when it reaches exhaustion within 6 h and before the reset. One alert per
escalation; a reset rollover starts a new trend. No fresh data for 30 min is a
"monitoring stale" alert. Nothing is switched automatically.

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

## Commands

```
python3 services/cfo/burn_alert.py --replay services/cfo/fixtures/incident-101.json   # safe replay, never posts
python3 services/cfo/burn_alert.py --dry-run     # evaluate live data, print, change no state
python3 services/cfo/burn_alert.py --calibration # forecast accuracy, learned correction, cross-checks
python3 -m unittest services/cfo/test_burn_alert.py
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
- Replay of the #101 incident fires at 43% used, 83 min before the 92% stage.
  10-min sampling cannot beat a sudden provider-side change.
- Not yet: Command Center card (owner-blockers ledger), dispatch-pause policy.
