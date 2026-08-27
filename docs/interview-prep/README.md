# Interview prep — index

20 docs, ~63,000 words. This file is the map: what each one is for, which are
evergreen, which are dead, and what to actually run before an interview.

**Filenames lie about value.** Seven docs are named after Betterment and Medal.
Two of those (`medal-code-reasoning-drills` Vols. 1–2, ~100KB, the largest asset
here) are almost entirely company-neutral and are the highest-value material in
the folder. Read the tables, not the file list.

---

## The finding that should change how you prep

From the Medal debrief, after the only two real interviews so far:

> The prep bank covered essentially every coding item. Gaps were
> **retrieval-under-pressure, not coverage** → the fix is out-loud reps, not
> more material.

Both rounds probed fundamentals **spoken aloud**, not algorithms on a whiteboard.
So:

- **Do not add more docs.** There is enough here. Adding is avoidance.
- **Reps beat reading.** Cover the answer, say the mechanism out loud, then check.
- **LeetCode is the lowest-yield material in this folder** (34KB across two docs).
  Neither real interview went there. Keep them for a company that screens that
  way; don't grind them by default.

---

## Evergreen — the reusable core

Company-neutral. This is what you study for *any* role.

| Doc | What it's for | Size |
|---|---|---|
| [`senior-ios-cheatsheet.md`](senior-ios-cheatsheet.md) | **The reload sheet.** 14 sections, question-as-asked → senior answer. Not for learning — for reloading the morning of. Skim daily, cram the ★ items. | 3.4k words |
| [`medal-code-reasoning-drills.md`](medal-code-reasoning-drills.md) | **Vol. 1 — the "read this code, what's wrong" muscle.** Swift concurrency, Combine, ARC, SwiftUI, video, real-time. ★ track = 10 drills / ~2 hrs. Appendix A is the 5-step routine to keep open live. | 7.0k words |
| [`medal-code-reasoning-drills-vol2.md`](medal-code-reasoning-drills-vol2.md) | **Vol. 2 — boss level.** Where cancellation stops propagating, where value semantics end. Nothing repeats Vol. 1. ★ track = 10 drills / ~2 hrs. Appendix B is a self-test protocol. | 7.1k words |
| [`swiftui-combine-refresher.md`](swiftui-combine-refresher.md) | **Fingers, not theory.** 2-day live-coding refresher; type every drill cold in a Playground. Modern `@Observable` as default, legacy flagged. §10 is a live-coding checklist. | 3.6k words |
| [`swift-concurrency-api-cheatsheet.md`](swift-concurrency-api-cheatsheet.md) | **The syntax layer** for the drills. ☑ items are type-from-memory tier. Keep open while practicing. Ends in a 12-line cold pop quiz. | 1.2k words |
| [`mobile-system-design-cheatsheet.md`](mobile-system-design-cheatsheet.md) | **45-min design script + answer bank.** Standard sub-problem → correct default answer, trade-off phrases that score, auto-deduct anti-patterns, plus one fully worked prompt. | 1.7k words |
| [`ts-react-crash-course.md`](ts-react-crash-course.md) | **TS + React senior basics.** ★ = highest probability. Discriminated unions, narrowing, utility types; the React identity trilogy, keys, derived state. | 1.7k words |
| [`ts-react-senior-challenges.md`](ts-react-senior-challenges.md) | **Level 2: predict → check → narrate.** Implement `Partial`, `satisfies` vs `as`, batching, stale interval, StrictMode double-run, the race. CoderPad-legal, no packages. | 1.8k words |

### Lower yield — keep, don't default to

| Doc | Note |
|---|---|
| [`leetcode-top20-swift.md`](leetcode-top20-swift.md) | 20 problems, 8 patterns, complete solutions. Pattern-first, which is the right framing — but see the finding above. | 2.9k words |
| [`leetcode-top20-javascript.md`](leetcode-top20-javascript.md) | Same 20 problems, JS idioms and traps. Pick **one** language per day; never interleave. | 2.4k words |

---

## Company-specific — archive

Kept for the reusable parts and the process lessons. Do not study these as-is
for a new company.

| Doc | Status | Still worth mining for |
|---|---|---|
| [`medal-deepdive-debrief.md`](medal-deepdive-debrief.md) | Medal rejected | **The morning-of ritual** (top of the doc — the single most reusable page in the folder) and the answer key for questions asked live. |
| [`betterment-onsite-prep.md`](betterment-onsite-prep.md) | Onsite done 2026-08-11, decision pending | The RN/TS senior hit-list and how to play an AI-allowed policy correctly. |
| [`betterment-interview-prep.md`](betterment-interview-prep.md) | Round passed | The 90-second background pitch shape, and §5 — handling the tough questions cleanly and moving on. Reusable at every company. |
| [`betterment-mock-pack.md`](betterment-mock-pack.md) | Spent | The format: run a live mock with Claude as interviewer. Re-stage it for any company. |
| [`betterment-pairing-practice.md`](betterment-pairing-practice.md) | Spent | The winning loop for any staged pairing round, a worked String Calculator, and a kata list. |

---

## Take-home assessments — new category (added 2026-08-25)

A timed build-it-yourself round is a different animal from a live round: the
artifact is a repo, graded in 5–20 minutes by peer engineers who run it first.
The **procedure** is the `take-home-assessment` skill (agents execute it, and it
ships a run-prompt template for Claude Code). The **study material** is here.

| Doc | What it's for | Size |
|---|---|---|
| [`ai-basics-for-mobile-devs.md`](ai-basics-for-mobile-devs.md) | **Evergreen.** The modern AI-app stack in plain words — model, prompts, tool calling and agents, RAG vs tools, guardrails, evals, model routing — with an RN/Node analogy per piece and a table of what a 4-hour build actually needs. The one exception to "the bank is closed": no existing doc covered the topic, and the AI-native pivot depends on it. | 2.3k words |
| [`instalily-case-study-playbook.md`](instalily-case-study-playbook.md) | Company archive, ~80% reusable. Plain-English guide to a 4-hour agent take-home: the assessment as candidates received it, the four grading criteria, what a great answer looks like, the traps (the trick question), an hour-by-hour reconstruction of a real timed build, verified seed data, the 4-hour plan, the mobile twist, the presentation round. | 5.5k words |
| [`instalily-case-study-research.md`](instalily-case-study-research.md) | The raw research behind the playbook: 14 public solutions mined, Glassdoor accounts, Instalily's own vocabulary (contracts, capabilities, eval gate), reviewer profiles, take-home craft sources. Read when you need a citation, not to study. | 6k words |
| [`instalily-mock-a-partselect.md`](instalily-mock-a-partselect.md) | Practice assessment A (PartSelect chat agent — the most likely real shape) + grader packet + a full Claude Code prompt with real seed data. | 5k words |
| [`instalily-mock-b-field-tech.md`](instalily-mock-b-field-tech.md) | Practice assessment B (Expo field-technician assistant, offline-first, confirm-gated action) + grader packet + Claude Code prompt. | 5k words |

## Routes — what to run, when

**Any interview, morning of** → the ritual at the top of
[`medal-deepdive-debrief.md`](medal-deepdive-debrief.md). 20 min in their actual
product, questions written on paper, skim the ★ items in the senior cheatsheet,
one warm-up drill out loud. *Not knowing the company's product was the most
expensive mistake made so far.*

**iOS / Swift role, ~1 week** → senior cheatsheet (skim) → Vol. 1 ★ track out
loud → Vol. 2 ★ track out loud → concurrency API sheet as vocabulary alongside →
SwiftUI refresher drills typed cold → Vol. 2 Appendix B self-test. Score 4/5 with
clean mechanisms and you're ready.

**React Native / TS role, ~3 days** → crash course ★ items → senior challenges,
predicting out loud before reading → system design script → one mock.

**System design round** → the cheatsheet's Part 1 script, then run Part 2's
worked prompt, then do an unseen prompt cold.

**Timed take-home, any company** → playbook "Your 4 hours" and "The traps" →
the `take-home-assessment` skill procedure → fill its run-prompt template →
practice once on mock A with a real timer before the real link is opened.

**Live, in the room** → Vol. 1 Appendix A (the 5-step routine + stalling lines
that still sound senior) and the refresher's §10 checklist.

---

## Rules for this folder

- **The bank is closed.** Don't generate new prep docs. If something's missing,
  it's a section in an existing doc, not a new file.
- **New company = a new archive doc**, named `<company>-*`, plus any durable
  lesson lifted up into the evergreen docs and this index.
- **After every real interview, write the debrief** — what they asked, the answer
  you want next time, the process fix. `medal-deepdive-debrief.md` is the template.
- Application history lives in `mrbam88/interviews` → `tracker/applications/`
  (one file per application; `tracker/INDEX.md` is generated), not here. This
  folder is study material only.
