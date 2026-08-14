# Betterment — Sr. Mobile Engineer (React Native) · Technical Loop, Tue Aug 11
**Bilal Malik · confirmed schedule + their own one-pager decoded · setup deadline MONDAY 1PM**

---

## The schedule (all ET, Zoom)

| Time | Round | Interviewer |
|---|---|---|
| 1:00–1:45 | **Systems Design** (LucidChart, NO code) | Phoebe Stierhoff |
| 2:00–3:00 | **Technical 1** — RN pairing, their app, YOUR machine | Brandon Trautmann |
| 3:00–4:00 | **Technical 2** — RN pairing continues | Josh DePonte |
| 4:00–4:15 | **Recruiter wrap** | Conor Wilson |

Role reality check: **React Native / TypeScript** senior IC ("familiarity with underlying iOS/Android" — your native depth is the differentiator, not the exam). GraphQL a plus. Base band **$170–195k NYC** + bonus + equity — below your $230–280 target; say nothing Tuesday, evaluate total comp if an offer comes. Hybrid 4 days/week in NYC office.

Intel worth having: Betterment famously went **all-in on Flutter** (their engineering blog + the Very Good Ventures case study, "Flutter Revitalized Our Codebase") — and this JD is RN-first with "Flutter nice to have." Something shifted. Brandon Trautmann writes on their engineering blog as a senior mobile engineer from the Flutter era. This is BOTH useful context and your best informed question (see Questions section — phrase it curious, never gotcha).

---

## ⚠️ HARD SETUP CHECKLIST — complete by MONDAY 1:00 PM (their 24-hour rule)

- [ ] **Download + extract their zip** (attached to the recruiter email), follow the README.
- [ ] **RN app runs locally** — one platform is enough; use iOS sim (your home turf).
- [ ] **Navigate every screen** of their app — you're learning the codebase layout for free. Skim: folder structure, state management choice, navigation lib, how they fetch data, test setup. Knowing where things live before the clock starts is a massive edge.
- [ ] **Screen share test** on Zoom (share the whole screen — their AI policy requires visible tool use anyway).
- [ ] **LucidChart account created** + 10 minutes doodling boxes/arrows so the tool is muscle memory, not friction, during the design round.
- [ ] **AI tool chosen and open**: whatever you drive fastest — the point is fluency on camera.
- [ ] Editor comfortable: font size up for sharing, terminal ready, simulator snappy.
- [ ] Any setup issue → email the recruiter IMMEDIATELY (they explicitly invited it).
- [ ] Use the **Betterment app** as a customer for 20 min (Medal lesson — never again).
- [ ] Questions ON PAPER, per-round (below). Second Medal lesson — never again.

---

## The AI policy — your home-field advantage, played correctly

Their rules: screen shared while using it · AI for **components, not complete solutions** · no pasting product requirements as prompts · pseudocode/plain-English algorithm prompts are fine.

How to play it (practice this weekend — this exact skill):
1. **Narrate intent BEFORE prompting.** "I'll have AI scaffold the list item component while I wire the data hook myself." The decomposition is the senior signal — you're showing them what you delegate vs. own.
2. **Small, surgical prompts.** A component, a test file, a tricky type. You design; it types.
3. **Review the output out loud, critically.** "Good, but I'd memoize this and the key extraction is wrong — fixing." Catching AI's mistakes on camera is the strongest possible flex of AI-native seniority.
4. **Never let it think for you on the architecture** — that's what they're actually interviewing.
5. If in doubt whether a use is in-bounds: ask the interviewer first. Asking reads as integrity, not weakness.

You build with agents daily at bamware; most candidates will fumble this policy or avoid AI entirely. Used your way, it's a differentiator no cheat sheet can give them.

---

## Round 1 — Systems Design, 45 min, Phoebe (LucidChart, no code)

Open-ended mobile-flavored prompt; they diagram along with you. The framework — draw these as five zones on the canvas, left to right, and timebox:

1. **Requirements (5–7 min).** Functional: core flows, who uses it. Non-functional — ASK these, it's fintech: offline behavior? real-time freshness? scale? security/compliance sensitivity? platforms? "What does success look like for this feature?" Write them in a corner; return to them when making trade-offs.
2. **API + data model (10 min).** Entities first, then the contract: REST vs GraphQL (they use GraphQL — reach for it and say why: mobile-shaped queries, no over-fetching on cellular), pagination (cursor — you know the drill), error shape, idempotency for anything money-shaped.
3. **Client architecture (10 min).** Layers: UI → state → data. Server state vs client state split (React Query-style caching layer vs local UI state), navigation, dependency seams for testing. Offline story: cache-first reads, queued writes (your upload-queue design from the drills transfers verbatim), source-of-truth discipline.
4. **Fintech cross-cutting (10 min) — where you win.** Security: tokens in Keychain/Keystore, biometric gate, session expiry, no PII in logs/analytics; accuracy: money is decimal/integer-cents, server-authoritative, optimistic UI only where reversible; observability: crash reporting, perf metrics, analytics events; accessibility (JD names it); testing strategy per layer.
5. **Trade-offs + evolution (5 min).** "V1 ships X; the seam for V2 is Y." Name what you're NOT building and why. End by checking back against the requirements corner.

Rehearsal prompts (run both this weekend, 35 min each, actually diagramming):
- "Design the portfolio/home screen: balances, performance chart, recent activity — feels live, works on the subway."
- "Design money transfer between accounts: entry → confirm → status, with failure handling." (Idempotency keys, pending states, server truth — your Vol. 1 Drill 6.3 scaled up.)

Anti-patterns: jumping to boxes before requirements · silent diagramming (narrate every box) · hand-waving security at a fiduciary company · never stating a trade-off.

---

## Rounds 2–3 — RN pairing on THEIR app (2 hours total, two interviewers)

Expect: a working app + a feature to build or extend, staged like the katas in `betterment-pairing-practice.md` — possibly a handoff mid-problem (Technical 1 → Technical 2 may continue the same work; ask at 3pm: "want me to keep going or start fresh?"). Everything in that pairing doc applies: clarify → first test → simplest green → extend at the seams → narrate always.

**RN/TS rapid refresher — the senior hit-list (skim Sunday):**
- **Hooks discipline:** `useEffect` deps honesty (exhaustive deps, cleanup functions), `useMemo`/`useCallback` for referential stability — not decoration; custom hooks to extract logic (`useAccounts()`).
- **State split:** server state (React Query/TanStack: caching, retries, invalidation) vs client state (useState/Context/Zustand) — naming this split out loud is a senior marker.
- **Lists:** FlatList/FlashList — `keyExtractor` (stable IDs — same identity lesson as ForEach), memoized `renderItem`, no inline lambdas per row, `getItemLayout` when possible.
- **Re-render control:** React.memo + stable props; "lift state down"; profile before optimizing (React DevTools).
- **TypeScript:** typed props, discriminated unions for view state (`{status:'loading'} | {status:'loaded', data} | {status:'error', message}`) — the enum-state pattern from your Swift template, JS dialect; typed navigation params.
- **Async:** the stale-closure trap in effects, AbortController/query cancellation (your Drill 1.4 in JS clothes), optimistic updates with rollback (Drill 6.3 — React Query has it built in).
- **Error/loading UX:** error boundaries, the three-state render, skeletons.
- **Native side (your edge):** bridging/native modules (you've SHIPPED custom Swift modules under RN at Photobucket — the exact "familiarity with underlying platforms" they want), New Architecture awareness (Fabric/TurboModules/JSI, Hermes) — one sentence each is plenty.
- **Testing:** Jest + React Native Testing Library — test behavior ("user sees balance") not implementation; your TDD loop from the pairing doc, in TS.

**The three-state fetch template, TS dialect (type it once before Tuesday):**
```tsx
type FeedState =
  | { status: 'loading' }
  | { status: 'loaded'; items: Item[] }
  | { status: 'error'; message: string };

function useFeed(): FeedState { /* fetch in effect or React Query; return the union */ }

function FeedScreen() {
  const state = useFeed();
  switch (state.status) {
    case 'loading': return <Spinner />;
    case 'error':   return <ErrorView message={state.message} onRetry={...} />;
    case 'loaded':  return <FlatList data={state.items} keyExtractor={i => i.id} renderItem={renderItem} />;
  }
}
```

---

## Questions to ask (write on paper; 1–2 per round — every session invites them)

**Phoebe (systems design):** "What does the mobile architecture look like today, and what's the next big evolution you're planning?" · "How do mobile and the GraphQL/backend teams split ownership of the contract?"
**Brandon (Technical 1):** "You all went famously deep on Flutter — I'd love the story of how React Native fits the picture now. What drove the direction?" *(curious tone — it's a great story and he lived it)* · "What's the testing culture like on mobile day to day?"
**Josh (Technical 2):** "What separates the engineers who thrive here from the ones who just do fine?" · "What's the gnarliest mobile problem the team's hit this year?"
**Conor (wrap):** process/timeline questions only; express strong interest plainly. If comp comes up: "focused on fit this week — happy to talk numbers if we get to that stage." Do NOT negotiate Tuesday.

---

## Revised plan to Tuesday

- **Fri:** LucidChart account + doodle · systems-design mock #1 with Claude (portfolio screen prompt, outline-level) · 20 min in the Betterment app.
- **Sat:** RN pairing mock with Claude — staged feature in TS, editor open, **AI-in-the-loop per their policy** (practice the narrate-prompt-review rhythm) · polish the three story answers (debrief doc) — they land here too ("lead initiatives," "mentor," "pragmatic tradeoffs").
- **Sun:** systems-design mock #2 (money transfer, full 35-min sim on LucidChart) · RN hit-list skim · one kata from the pairing pack in TS with tests.
- **Mon:** ⚠️ **1 PM: setup checklist DONE** · explore their codebase · light dress rehearsal (rapid-fire + one staged extension) · questions on paper · early night.
- **Tue:** morning ritual only. 12:40 seated, water, simulator warm, LucidChart tab open. Calm, curious, collaborative — this loop is built for exactly the engineer you are.
