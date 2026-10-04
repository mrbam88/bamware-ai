# Factory cadence — rolling 24h sprints

**Status:** Active (CEO doctrine 2026-10-04)  
**Tickets:** bamware-ai#137 (cadence), bamware-ai#136 (capacity analytics)  
**Supersedes ceremony:** not two-week Scrum theater. Extends the on-demand
checkpoints in `docs/operating-cadence.md` with a **default churn rhythm**.

Bamware is a **software factory**. Engineering agents are the workhorses.
Subscriptions are **prepaid capacity** (see `docs/cfo-capacity-analytics.md`).
Win condition: keep useful WIP moving every cycle and ride close to rate limits
without thrash or idle waste.

## Roles

| Role | Owns |
|---|---|
| **CEO / Stakeholder** | Outcomes, reserved decisions, spend/store/secrets lifts only |
| **Chief of Staff** | Unblocker king; factory pace; nag CEO only for *CEO* lifts; brief status short |
| **Scrum Master** | Delivery WIP, board claim protocol, overnight commit set, evidence |
| **CFO** | Capacity headroom, burn vs caps, fill-or-throttle signal |
| **Engineering Lead** | Quality contract on PRs (`docs/engineering-operating-contract.md`) |
| **Workers / overnight** | Ship Agent-ready tickets; loud failure beats silent stall |

## Commit gate (what may enter a cycle)

A ticket is **cycle-eligible** only when all are true:

1. Spec complete (`skills/agent-ready-tickets`)
2. `definition-of-ready` passed → `Worker: Agent-ready`
3. Orthogonal to other claimed WIP (no file collisions)
4. Runtime available (Mac for Xcode; server for Node/docs/AI-ops)
5. **CFO headroom** allows another pull (or CEO explicitly overrides)

Backlog ≠ ready queue. No eligible work → idle is correct; spinning is waste.

## Rolling 24h loop (America/New_York, omarchy always-on)

1. **Fill** — SM pulls highest-priority orthogonal Agent-ready work up to CFO headroom.
2. **Claim** — board Status → In Progress + claim comment (`skills/board-ops`) before first token.
3. **Execute** — overnight/day runners churn; one session per ticket; no idle poll loops.
4. **Evidence** — non-draft PR → Ready for QA; or loud public failure. Never silent In Progress.
5. **Unblock** — CoS clears ops blockers; escalates to CEO only for reserved lifts (repeat until clear).
6. **Cycle signal** — short line to `#cron` (noise) / CoS status (action): shipped · stuck >1 cycle · capacity used vs cap.

CEO on-demand morning/afternoon/evening checkpoints (`operating-cadence.md`) still
apply when he asks — they are review lenses, not the only time work runs.

## Stuck / kill rule

No material progress in **one cycle** → SM/CoS escalate, split, reassign, or cut.
Stale In Progress with no worker is a process bug. CEO busyness is **not** a
reason to pause the factory; only missing eligibility or hard stops pause WIP.

## Discord

| Channel | Use |
|---|---|
| `#bamware-bot` | CEO ↔ CoS (decisions, short status) |
| `#cron` | Scheduled/job noise; optional CEO read |
| Status webhook / `#general` | GitHub events (unchanged) |

## Related

- Capacity: `docs/cfo-capacity-analytics.md`, `services/cfo/README.md`
- Board: `skills/board-ops`, `skills/definition-of-ready`
- Overnight: `services/overnight/README.md`, `skills/night-supervisor`
- Token/spend policy: `docs/token-diet.md`, AGENTS.md hard spend rule (new $)
