# Betterment Mock Pack — Run the Real Interview Before the Real Interview
**Bilal Malik · built from candidate reports: the pairing round IS (or rhymes with) portfolio rebalancing · practical > clever**

How to use: these are live mocks with Claude as interviewer, run in chat. Mock B is the
centerpiece — the exercise a hired candidate described, staged the way Betterment stages,
with AI-usage practice built in per their policy. Do Mock B Saturday, Mock A Friday/Sunday.

---

## MOCK A — Systems Design sim (Phoebe, 45 min, LucidChart, no code)

**Setup:** LucidChart open, screen-share mindset, timer visible. Claude plays Phoebe: gives the
prompt, then mostly listens, and drops *hints* — the research says candidates get dinged for
missing them, so THE RULE IS: every hint is rubric. Chase it immediately and out loud.

**Prompt 1 (Friday):** "Design the portfolio home screen — balances, performance, recent
activity. Feels live, works on the subway."
**Prompt 2 (Sunday):** "Design money transfers — entry, confirmation, status tracking."

**The hint list Claude will fire (their style, per the scaling-ding report):**
- "What if the transactions list is 10,000 items?" → pagination (cursor), windowed list, cache.
- "Market open — everyone checks at 9:30. What hits our backend?" → polling vs push, staleness
  tolerance, cache TTLs, jittered refresh.
- "User's on the subway mid-transfer. Walk me through it." → offline queue, idempotency key,
  pending-state UI, reconciliation on reconnect.
- "How do you know the balance shown is *right*?" → server-authoritative money, integer
  cents/decimal, never client math for display totals, reconciliation.
- "Where do tokens live? What if the phone is stolen?" → Keychain/Keystore, biometric gate,
  session expiry, remote revocation.
- "How would you test this?" → per-layer answer, contract fixtures, the failure paths.

**Scoring (what they grade):** requirements asked before boxes drawn · hints chased ·
trade-offs stated with a pick · fintech instincts (money accuracy, security) unprompted ·
narration throughout · a V1/V2 line at the end.

---

## MOCK B — The Pairing Sim: "Rebalance" (Brandon + Josh, 2×50 min, TS, AI allowed)

Run Saturday in your editor: a bare TS file + Jest (or ts-node + assert — don't over-tool).
Claude plays the interviewer: gives ONE stage at a time, extends when you're green, drops
hints, occasionally asks "why'd you do it that way?" mid-flow. Narrate everything. TDD loop
from `betterment-pairing-practice.md` applies verbatim: clarify → first failing test →
simplest green → refactor → next stage.

### The data (given at start)

```ts
type Holding = { symbol: string; shares: number; price: number };   // price in dollars
type Target  = { symbol: string; targetPct: number };               // sums to 100

const holdings: Holding[] = [
  { symbol: 'VTI',  shares: 120, price: 260.00 },
  { symbol: 'VXUS', shares: 200, price:  62.50 },
  { symbol: 'BND',  shares: 150, price:  72.00 },
];
const targets: Target[] = [
  { symbol: 'VTI',  targetPct: 55 },
  { symbol: 'VXUS', targetPct: 25 },
  { symbol: 'BND',  targetPct: 20 },
];
```

### Stage 1 — Current allocation
"Write `currentAllocation(holdings)` → `{ symbol, value, pct }[]`. Percentages of total value."
*Traps:* money in floats (talk about it! — work in cents or accept dollars-with-comment; name
the issue either way, it's THE fintech signal) · divide-by-zero on empty portfolio (test it).

### Stage 2 — Drift
"Now `drift(holdings, targets)` → per-symbol `driftPct` (current − target). Flag anything with
absolute drift over a threshold — default 3%." *(That 3% is Betterment's real rebalance
threshold — mentioning that you know that is a mic-drop moment.)*
*Traps:* a symbol in targets but not holdings (0% current — handle, test) · sign conventions
(overweight positive — say your convention out loud).

### Stage 3 — Rebalance trades
"Generate `rebalance(holdings, targets)` → `{ symbol, action: 'BUY'|'SELL', amount }[]` —
dollar amounts to hit targets exactly."
*Traps:* buys and sells must net to ~zero (assert it in a test!) · rounding leftovers (park the
remainder in the largest position — state the policy) · don't emit zero-amount trades.

### Stage 4 — Cash-flow rebalancing (their actual product move)
"A $10,000 deposit arrives. Invest it WITHOUT selling anything — reduce drift as much as
possible using only buys."
*The insight they're fishing for:* fund the most-underweight assets first (greedy toward
targets). This is literally how Betterment's product works (deposits/dividends buy underweight
assets to avoid taxable sells) — SAY THAT. *Traps:* deposit smaller than total underweight gap
(proportional or greedy fill — pick and justify) · deposit so large everything hits target
(remainder splits per target pct).

### Stage 5 — Stretch (often discussion-only; points for naming, not building)
Min-trade threshold ($10 — dust trades) · fractional shares vs whole-share constraint ·
tax-aware ordering (prefer selling losses — tax-loss harvesting adjacency) · "how would this
change for 100k users server-side?" (it's a pure function — runs anywhere; determinism +
property tests).

### Part 2 (Josh's hour) — wire it into UI
"Build an Allocation screen in the RN app: list of holdings with target vs current bars, drift
badge past threshold, and a 'Preview rebalance' button showing the trades."
- Three-state fetch (your TS template), typed props, FlatList with stable keys, memoized rows.
- Extension they'll likely pull: pull-to-refresh · a confirm flow with optimistic pending state
  (Drill 6.3 thinking — idempotent submit, reconcile from server echo).

### AI usage — practice the policy DURING the mock (this is half the point)
Legal per their one-pager, rehearse these exact moves: scaffold the Jest test file from your
named cases ("write test stubs for these five cases: …") · generate the drift-bar component
from YOUR description of its props · ask for an edge-case list on YOUR stated algorithm in
pseudocode. Illegal moves to never do: pasting the stage prompt · "solve stage 3 for me."
Always: announce intent BEFORE prompting, review output critically OUT LOUD, fix its mistakes
on camera.

### Scoring rubric (from the research)
Practical correctness > cleverness · tests first and green at every stage · money handled like
money · stages absorbed at seams without rewrites · constant narration · hints chased ·
AI used surgically with visible judgment · consistent stories if they chat between stages.

---

## Consistency note (recurring Glassdoor complaint = your opportunity)
Different interviewers WILL ask overlapping questions ("difficult technical problem,"
disagreement, mistake). Same three stories, same framing, all day — Phoebe, Brandon, Josh, and
Conor compare notes. Rehearsed-consistent reads as solid; improvised-divergent reads as shaky.

## Domain cram (10 minutes, before Saturday's mock)
Read Betterment's help page on rebalancing methods. Vocabulary to absorb: cash-flow rebalancing
(deposits/dividends/withdrawals fix drift without selling) · sell/buy rebalancing at ~3% drift ·
tax impact of selling · allocation drift. Using their vocabulary mid-exercise is the
"knows our product" moment.
