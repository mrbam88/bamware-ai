# Medal Deep Dive — Debrief & Answer Key
**Bilal Malik · technical deep dive, week of 2026-08-03 · captured from post-interview notes**

This doc exists for two reasons: (1) Medal's actual question bank, with the answer you want next
time for every item; (2) the process fixes so the two mistakes never happen again. If Medal
advances you, next-round prep starts HERE.

---

## The two mistakes (process, not knowledge — both permanently fixable)

**1. Didn't know the company's app.** At a consumer company this is the most expensive kind of
miss — it reads as low interest, not low skill. Standing rule from now on, for every company:
**use the product for 20+ minutes before any round.** For Medal: install the iOS app, record,
clip something in the editor, browse the feed/Stories, share to Discord. If there's a next round,
open with an observation from actually using it — that flips the miss into a point.

**2. Didn't prepare questions.** They were written (drill doc Vol. 1, Appendix C — seven of them)
but not *loaded*. Lesson: owning prep docs ≠ running them. The fix is the ritual below.

## The morning-of ritual (print this, run it, every interview)

- [ ] 20 min in the company's actual product (or re-visit if already done). One observation noted.
- [ ] 4–5 questions for them WRITTEN ON PAPER next to the keyboard.
- [ ] Reread the company cheat sheet (drills Appendix B) — 60 seconds.
- [ ] Skim the ★ answers in the senior cheat sheet.
- [ ] One warm-up drill out loud (any playground page).
- [ ] Names of interviewers from the invite; the JD open in a tab.

---

## Rapid-fire questions they asked — the answer key

**What is inheritance?** Class-based is-a subclassing: a subclass gets and can `override` its
superclass's interface/behavior; single inheritance in Swift. The senior add-on: Swift leans away
from it — final by habit, composition and protocols over subclassing (see POP below).

**What is ARC?** Compile-time reference counting: the compiler inserts retain/release for
reference types; count hits zero → deinit. Deterministic, no GC pauses — but cycles are your
problem, which is why `weak`/`unowned` exist.

**Weak / strong / unowned?** Strong = default, owning (+1). Weak = non-owning, optional,
auto-nils when the target dies — for uncertain lifetimes (delegates, async callbacks). Unowned =
non-owning, NON-optional, crashes if outlived — only for provably-tied lifetimes. When in doubt: weak.

**What is actor isolation?** An actor's mutable state is reachable only through the actor itself,
which serializes access — compile-time-checked mutual exclusion. Crossing the boundary requires
`await`. The senior asterisk: isolation ≠ atomicity across a whole method — actors are reentrant
at every internal `await`.

**Class vs struct?** Semantics first: struct = value (copies independent, no shared mutation, free
Sendable), class = reference (identity, shared state, deinit, ObjC interop). Default struct;
class when identity or lifecycle is the point; actor when it's shared *mutable* state.

**Why are Views structs?** They're cheap, disposable *descriptions* — SwiftUI recreates them
constantly, diffs, and updates the real UI. Value semantics is what makes the diffing model work;
persistent state lives in the property-wrapper storage (@State etc.), not the struct.

**Why protocol-oriented?** Composition over fragile base-class inheritance: value types can
conform, types can conform to many protocols, retroactive conformance, default implementations via
extensions, and protocols make natural seams for testing/DI. Generics + protocols give static
dispatch where class hierarchies force dynamic.

**The "eraser" thing = AnyView (type erasure).** Wraps any view, hides the concrete type — for
heterogeneous collections or impossible return types. Cost: erases the type identity SwiftUI
diffs by, hurting update performance. Prefer `some View`/`@ViewBuilder`/`Group`; AnyView is last
resort. Family: `AnyPublisher` (`eraseToAnyPublisher`), `AnyHashable`. The term to say: **type erasure**.

**Biggest challenge (told: Photobucket auto-backup).** Keep STAR tight: hard constraints (media at
scale, background execution, reliability on flaky networks), what YOU decided, shipped outcome.
Polish this into a 90-second version with one concrete number before any next round.

**Biggest mistake (told: FreedomCare UI bug).** Formula: the mistake plainly, the impact honestly,
the FIX, and the SYSTEM you changed so it can't recur (test, review step, monitoring). The system
change is what makes a mistake story senior.

**"Do you regret using SwiftUI at FreedomCare?"** The shape of a great answer: "No — but I'd
scope it differently knowing what I know now." Name a real cost you ate (early-SwiftUI rough
edges, one specific), the payoff (velocity, declarative state), and the judgment: today the
calculus is easy (SwiftUI default, UIKit where it earns it), then it was a bet, and bets are
evaluated on information available at the time. No regret, no defensiveness — a trade-off audit.

---

## Coding exercises they gave — mapped to the prep

| They asked | It was | Where it lives |
|---|---|---|
| Increment-counter class, "any bugs? what about tasks?" | Data race on `count += 1` from concurrent tasks → actor / @MainActor / parent-loop aggregation | Playground p.01 · Vol. 2 Drill 1.3 |
| Network calls in parallel | `async let` for fixed N, task group for dynamic N; error = siblings cancelled | API cheat sheet §3 · Vol. 2 Drill 1.4-adjacent |
| `Task.detached`, `Task` priority, `isMainThread` prints | Inheritance of context: `Task {}` inherits actor/priority, detached inherits nothing | Playground p.07 |
| Toggle/badge/like count not updating UI | Ownership/observation bug: missing `@Observable`/`@Published`, or `@ObservedObject` inline-init recreation, or mutation off main | Vol. 1 Drill 4.1 · refresher §2 |
| Actor-shared `likeCount` | Wrap count in actor (or @MainActor), await access; mention chunky API + UI-side coalescing | Vol. 2 Drills 1.5/6.2 |

**Read:** the prep bank covered essentially every coding item. Gaps were retrieval-under-pressure,
not coverage → the fix is out-loud reps (playground + self-test protocol), not more material.

## Next actions
1. Install and USE the Medal app (tonight — before any follow-up contact).
2. Polish the three story answers above into 90-second versions.
3. If next round lands: run the morning-of ritual, questions on paper.
4. Log the outcome in the tracker when Medal replies.
