# CFO burst policy — dynamic intelligence (CEO 2026-10-05)

**Problem:** Always-frontier burns the pool. Always-cheap fails hard spikes (e.g. marketing game plan).  
**Fix:** Default steady · temporary **burst** · Chief of Staff holds the quality bar.

## Roles

| Who | Owns |
|---|---|
| **CFO** | Tier table, live headroom, caps, this doc |
| **Chief of Staff** | When to recommend/start/end burst; write sharp briefs for cheap workers |
| **CEO** | Override; new spend; “burst everything” never default |
| **Workers** | Execute assigned tier; do not self-upgrade |

## Modes

### Steady (default)
- CoS chat: mid (Grok 4.5 or best mid with headroom)
- Marketing / Scrum Master profiles: small (gpt-5-mini)
- Overnight builders: mid (Claude Sonnet on Max)
- Timers/scripts: no model

### Burst (temporary)
CEO or CoS says one of:
- `burst marketing` / `burst eng` / `burst cos` / `burst <ticket>`
- `burst off` / `steady`

**Burst means:** next session(s) on that lane use **top** candidates until:
- CEO says off, or
- CoS ends after deliverable, or
- **60 minutes** wall clock, or
- pool hits CFO critical (auto demote)

## Top / mid / small (live preference order)

CFO reorders by headroom. **As of 2026-10-05:**

| Tier | Prefer now | Avoid now |
|---|---|---|
| **top** (burst) | Claude Max **Fable/Opus** (headroom); Grok 4.5 | **Codex/Astra** (~95% critical) until reset |
| **mid** | Claude Sonnet (Max or Copilot path); Grok 4.5 | Codex heavy |
| **small** | gpt-5-mini; Haiku | Premium burn for chatter |

“Fable” / “Astra” in CEO speech map to **top** tier (Claude Fable family / OpenAI Codex Astra family per routing file).

## Cascade (the real savings)

1. **Burst CoS or human** sets taste: goal, constraints, examples, reject bar.  
2. **Steady worker** executes the brief.  
3. **One top pass** only if output fails the bar.

Intelligence is the **brief + one review**, not 8 hours of frontier chat.

## Caps (soft)

- Max **2 concurrent** bursts  
- Max **3 burst-hours / day** across all lanes unless CEO overrides  
- At pool **warn (80%)**: burst needs CoS confirm  
- At pool **critical (95%)**: no new burst on that pool; shift provider or steady only  

## Commands (Discord / CoS)

| You say | Effect |
|---|---|
| `burst marketing` | Marketing lane → top for ≤60m |
| `burst eng` | Next eng/overnight ticket → top |
| `burst cos` | This CoS session prefers top |
| `burst off` | All lanes steady |
| `burst status` | CoS reports active bursts + headroom |

State file: `~/.local/state/bamware/cfo/bursts.json` (private).

## Department defaults

| Lane | Steady | Burst when |
|---|---|---|
| CoS | mid/strong | Ambiguous org/strategy; CEO deep work |
| Marketing | small | Game plan, creative direction, “impress me” |
| Scrum Master | small | Never need top for sweeps |
| Overnight eng | mid | Hard ticket flagged burst |
| Interview kits | mid CoS | Drills generation can burst once |

## Evidence
CEO 2026-10-05: mini marketing felt too dumb for hard problem; frontier spoiled/burned; wants hyperintelligence at top + temporary departmental burst.
