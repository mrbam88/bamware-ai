# CFO capacity analytics — prepaid subscription efficiency

**Status:** Active (CEO doctrine 2026-10-04)  
**Ticket:** bamware-ai#136  
**Implementation owner:** CFO service (`services/cfo/`)

## Business model (why this exists)

Bamware AI access is mostly **subscription / rate-limit pools**, not pure
pay-as-you-go. Cash is already committed for the cycle. Efficiency means:

- **Use as much prepaid capacity as practical each reset window** (day / 5h /
  week / month) on *real shipping work*
- **Stay under hard rate limits** (no thrash, no surprise lockouts)
- **Do not burn tokens on spin** (idle polls, duplicate workers, ceremony)

New cash spend still follows AGENTS.md (**>$20 stop**; quote-and-confirm under).
This doc optimizes **already-paid** pools.

## Metrics (the factory currency)

Per pool, every snapshot:

| Field | Meaning |
|---|---|
| `used_pct` | Provider-reported utilization of the window |
| `level` | ok / warn / critical (policy thresholds) |
| `to_reset_h` | Hours until window reset |
| `rate_pct_h` | Recent burn rate |
| `eta_reserve_h` / `eta_exhaust_h` | Forecast to reserve / empty |
| `reserve_before_reset` | Will we hit reserve before reset? |

**Default policy** (`services/cfo/burn_alert.py`): reserve 85% · warn 80% · critical 95%.

**Steer signal for SM/CoS**

| Headroom | Action |
|---|---|
| Plenty (ok, low used%, long to reset) | **Fill** — pull more Agent-ready WIP |
| Approaching warn | Prefer cheap/deterministic work; bound concurrency |
| Critical / exhaust-before-reset | **Throttle** heavy models; finish in-flight; no new large pulls |
| Stale data >30m | Fix collectors first — flying blind is not headroom |

## Live sources (omarchy)

Authoritative machine state (private, never commit):

| Path | Source |
|---|---|
| `~/.local/state/bamware/cfo/capacity.json` | Published every burn-alert run |
| `~/.local/state/bamware/server-quota.json` | OpenAI/Codex collector |
| `~/.local/state/bamware/cfo/costs.jsonl` | Per-task % cost (`meter.py`) |
| `~/.local/state/bamware/cfo/alerts.jsonl` | Alert delivery log |

Collectors + timers: see `services/cfo/README.md`.

Covered today: OpenAI Codex windows, Claude Max (session/weekly/Fable share),
Copilot premium. **Gaps (stub):** Grok/xAI, Cursor, Google — no stable usage API yet.

## CoS snapshot (human brief)

```bash
# print only — no Discord
scripts/cfo-capacity-snapshot.sh

# also post to #cron (bot); CoS still owns CEO-facing status
BAMWARE_POST_TO=cron scripts/cfo-capacity-snapshot.sh --post
```

Output is headroom + steer, not raw tables. CEO status never includes Meet links
or chore dumps unless asked.

## Operating loop

1. CFO keeps capacity.json fresh (10 min timers).
2. SM asks: “headroom to pull more Agent-ready this cycle?”
3. CoS unblocks and keeps churn on; escalates CEO only for reserved lifts.
4. Overnight runner meters tasks (`services/overnight` + `meter.py`).

## Related

- Factory rhythm: `docs/factory-cadence.md`
- Token diet (waste levers): `docs/token-diet.md`
- Burn alert detail: `services/cfo/README.md`
