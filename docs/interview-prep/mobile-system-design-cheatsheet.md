# Mobile System Design — Cheat Sheet + Model Answer
**Bilal Malik · Betterment round (45 min, LucidChart, no code) · study this, then run the mock**

Two parts. Part 1 is the reusable script + the answer bank — for every standard sub-problem,
the *correct default answer* so you never spin wheels. Part 2 is the portfolio home screen
prompt fully worked, zone by zone, exactly as a strong candidate would run it — including the
right responses to every hint. Your mock afterward uses the OTHER prompt (transfers), unseen.

---

# PART 1 — THE CHEAT SHEET

## The 45-minute script (timeboxed — write these 5 zones on the canvas immediately)

| Min | Zone | What you're doing |
|---|---|---|
| 0–7 | **1. Requirements** | Restate. Ask functional + non-functional questions. Write them in a corner — they're your referee for every trade-off. |
| 7–17 | **2. API + data model** | Entities → the contract → pagination → error/money shapes. |
| 17–28 | **3. Client architecture** | The layer diagram. State split. Caching. Offline story. |
| 28–38 | **4. Cross-cutting (fintech wins here)** | Security, accuracy, performance, observability, a11y, testing. |
| 38–45 | **5. Trade-offs + close** | "V1 ships X; the seam for V2 is Y. Checking back against requirements…" + your questions. |

**The three rules:** narrate every box · every interviewer hint is rubric — chase it instantly
and out loud · state trade-offs as "A vs B, I pick A here *because* [requirement]."

## The requirements questions (ask 4–6 of these, always)

Who's the user and what's the core loop? · What must work **offline**, and what's acceptable
degraded? · How **fresh** is fresh (ms / seconds / minutes)? Real-time or feels-live? · Scale —
users, items per list, request spikes? · Security/compliance sensitivity? · Platforms + min OS? ·
What does success look like (metric)? · What's explicitly OUT of scope?

## The answer bank — standard sub-problem → correct default answer

**Huge list (10k+ items)?** Cursor pagination from the server; windowed rendering client-side
(FlashList/FlatList — only visible rows exist); prefetch next page at ~70% scroll; cache pages;
stable IDs for keys. Never offset pagination (dupes/gaps when data shifts — say why).

**"Feels live" freshness?** The tiered answer, cheapest first: (1) refetch on screen focus +
pull-to-refresh, (2) foreground polling with a sane TTL (30–60s), (3) push/silent-notification
nudges for *events*, (4) WebSocket/SSE ONLY if sub-second matters (chat, live trading — not a
retail portfolio). Always render cached data instantly with an "as of" timestamp and refresh
behind — stale-while-revalidate. Users experience blank screens, not milliseconds.

**Offline?** Reads: cache-first from local store (MMKV for small KV, SQLite for big/queryable),
show last-known + honest "as of" label. Writes: **outbox queue** — persist locally, send when
connectivity returns, **idempotency key per mutation** so retries can't double-apply, pending
states in UI, reconcile from server echo. `NWPathMonitor`-equivalent to react, never preflight.

**Money?** Server-authoritative always; integers in cents (or decimal strings) end-to-end —
NEVER float; client does formatting only, no arithmetic for anything that matters; totals come
from the server, not client summing; currency code travels with every amount.

**API shape?** They use GraphQL — reach for it and justify: one mobile-shaped query per screen,
no over/under-fetching on cellular, typed schema shared with backend. (REST answer if pushed:
a BFF endpoint per screen.) Plus: consistent error envelope, retries with exponential backoff +
jitter on idempotent ops only, timeouts, request cancellation on screen exit.

**State management?** The split, named out loud: **server state** in a cache layer (React
Query/Apollo: caching, dedup, invalidation, retries) vs **client/UI state** (useState/Context/
Zustand — small). Cache normalized by entity ID. "Most 'state management problems' are actually
server-cache problems."

**Auth/security?** Tokens in Keychain/Keystore (never AsyncStorage) · short-lived access token +
refresh rotation · **serialize the refresh** (one refresh flight, others await it) · biometric
gate re-entry · session revocation server-side · TLS + pinning only with a rotation story ·
no PII in logs/analytics/crash reports · jailbreak checks = speed bumps, say so honestly.

**Performance?** Measure first (React DevTools profiler, Perf monitor, startup metrics).
Standard wins: memoized rows + stable callbacks, image sizing/caching, Hermes, lazy screens,
downsampled chart data (server sends ≤ ~100 points per range, not every tick).

**Observability?** Crash reporting (symbolicated), analytics events on the funnel, perf metrics
(TTI, stall rate), **feature flags + kill switch** for risky features, staged rollout.

**Testing?** Per layer: pure logic = unit (fast, most tests) · API contract = fixtures/mocked
transport · UI = behavior tests (RNTL: "user sees balance") · one happy-path E2E (Detox) ·
the failure paths (offline, error, empty) get tests too — fintech = test the sad paths.

**Accessibility (JD names it — say it unprompted):** labels on interactive elements, Dynamic
Type without truncation, contrast, focus order, "a screen reader user can hear their balance."

## Trade-off phrases that score
"Cheapest thing that meets the requirement — polling here; the seam to upgrade to push is the
data layer, UI never knows." · "I'm optimizing for perceived performance: cached-instantly
beats fresh-but-blank." · "This is reversible, so optimistic UI is fine; money movement isn't,
so it gets pending-state honesty instead." · "V1 ships without X; here's the seam where X lands."

## Anti-patterns (auto-deductions)
Boxes before requirements · silent drawing · WebSockets-for-everything (complexity flex) ·
float money · hand-waved security at a fiduciary · no trade-off stated all session · ignoring
a hint · never checking back against requirements.

---

# PART 2 — MODEL ANSWER: "Design the portfolio home screen"
*(Balances, performance chart, recent activity. Feels live. Works on the subway.)*

### Zone 1 — Requirements (what you SAY, ~5 min)
"Let me pin scope. Functional: current total balance + per-account balances, a performance
chart with range switching (1D/1M/1Y/All), recent transactions, and this is the landing screen
— first thing after login. Non-functional, let me ask: **how fresh is 'live' — is minute-level
staleness with clear labeling acceptable?** (assume yes — retail investing, not trading) ·
**offline: read-only last-known is fine?** (yes) · **scale: hundreds of thousands DAU, spike at
market open** · **accuracy is non-negotiable — this is people's money** · iOS+Android, RN.
Success metric: time-to-balance on cold open, crash-free rate."
→ Write in the corner: `feels-live ≥ accurate ≥ fast ≥ offline-readable`.

### Zone 2 — API + data model (~10 min)
Entities: `Account { id, name, type, balanceCents, currency }` ·
`PerformanceSeries { range, points[{ts, valueCents}] }` · `Transaction { id, accountId, type,
amountCents, status, occurredAt, cursor }` · `PortfolioSummary { totalCents, asOf }`.

The contract — **one GraphQL query for the screen** (justify: one round trip on cellular, typed,
mobile-shaped): summary + accounts + performance(range) + transactions(first: 20, after: cursor).
Say: "**Money is integer cents with a currency code, totals computed server-side** — the client
never sums money. Timestamps and ordering are server-issued. Transactions paginate by
**cursor**, not offset — new transactions at the head would shift offsets and duplicate rows.
Chart data comes **downsampled per range** — ~100 points, never raw ticks."

### Zone 3 — Client architecture (~10 min) — the diagram
```
[Portfolio Screen]
   ├─ header: TotalBalance (+ "as of 9:41" when stale)
   ├─ PerformanceChart (range tabs)
   └─ ActivityList (windowed, paginated)
        │
[hooks: usePortfolio(), useTransactions()]        ← UI reads state, no fetch logic in views
        │
[Server-state cache — React Query/Apollo]         ← caching, dedup, retry, invalidation
        │                    │
[GraphQL client]      [Local persistence: MMKV/SQLite]  ← cache survives launch: instant paint
        │
[Betterment API]
```
Narrate the flow: "Cold open → render **persisted cache instantly** with the as-of label →
fire the query → reconcile → label disappears. First paint is never blank and never wrong —
it's honest. This screen is read-only, so no outbox needed; the transfer flow would add one."

**Freshness (the heart of this prompt):** "Tiered: refetch on focus, pull-to-refresh, and a
60-second foreground poll during market hours. I'm deliberately NOT reaching for WebSockets —
retail portfolio values don't need tick-level, and sockets cost battery, reconnection logic,
and server fan-out at spike. The seam: freshness lives entirely in the data layer, so upgrading
to push later touches zero UI."

### Zone 4 — Cross-cutting (~8 min, fintech flex)
Security: tokens in Keychain/Keystore, biometric gate on app-open (it's a finance app),
refresh-token rotation with serialized refresh, no balances in logs/analytics, screenshot
blur in app switcher (nice detail). Perf: memoized rows, chart virtualization, TTI measured.
Observability: crash-free rate, TTI metric, analytics on range switches (product signal),
feature flag on the chart rewrite. A11y: balance readable by screen reader, Dynamic Type,
chart has a text alternative ("up 3.2% this month"). Testing: money formatting + drift logic
unit-tested, contract fixtures for the query, RNTL for the three states, one Detox happy path.

### Zone 5 — Close (~3 min)
"V1: this, polling, read-only offline. V2 seams: push-nudged refresh, per-holding drill-in,
widget/watch surfaces reading the same cache. Checking the corner: feels-live ✓ (SWR + poll +
as-of honesty), accurate ✓ (server-authoritative cents), subway ✓ (persisted cache read path).
What does your team do today for freshness here — poll or push?"

### The hint gauntlet — correct responses when Phoebe pushes
- **"10,000 transactions?"** → "Cursor pagination server-side, windowed list client-side, so
  memory is O(visible). Prefetch at 70% scroll. The cache stores pages; jumping to a date range
  becomes a fresh cursor query, not a scroll-through."
- **"Market open — everyone opens the app at 9:30."** → "Client: jittered poll (60s ± random) so
  we don't synchronize a thundering herd; focus-refetch has natural jitter. Server side helps
  with a short CDN/cache TTL on summary — 15s staleness is invisible to users but collapses the
  spike. And stale-while-revalidate means users see *something* instantly regardless."
- **"Is the balance ever wrong?"** → "Client never computes it — it renders the server's number
  with the server's as-of timestamp. Worst case is *stale and labeled*, never wrong. That's the
  invariant: honest staleness over invented freshness."
- **"Phone stolen?"** → "Biometric gate, short-lived access token, server-side session
  revocation from web, Keychain items non-exportable. Damage window is minutes, and read-only."
- **"How do you test the freshness logic?"** → "It's a pure policy over (lastFetched, appState,
  marketHours) — unit-test the policy with a fake clock; integration-test that focus triggers
  refetch; the UI just renders whatever state says."

---

**How to study this:** read Part 1 twice. Then read Part 2 once as prose, then RE-DRAW the
Zone 3 diagram + the five zones from memory on LucidChart (20 min). When you can reproduce the
skeleton and the freshness answer without looking, say **"start mock A"** — you'll get the
money-transfer prompt, unseen, and the hint gauntlet live.
