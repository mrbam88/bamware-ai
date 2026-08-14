# Betterment Pair-Programming — Practice Pack
**Bilal Malik · how to prep for the collaborative coding round**

---

## What this round actually is

Betterment gives you a **small, realistic problem** and then **extends it in stages** across the session — sometimes handing you off to a second interviewer mid-problem to see how you communicate design. You code **in your own editor, in your own language** (use whatever you're fastest and cleanest in — for you that's **Swift or TypeScript**). They pair *with* you: they'll take the keyboard, drop hints, ask "what if the input were…". 

They are grading, in their words, **software craftsmanship** and collaboration. Translation of what actually scores points:

- Clean naming and small functions
- Writing a test first, watching it fail, making it pass, then refactoring (TDD)
- Handling the *extension* gracefully without rewriting everything
- **Talking the whole time** and treating the interviewer as a teammate

This is a format that rewards a 15-year engineer who's shipped real code. It is *not* a "did you memorize the trick" test. Lean into that.

---

## The winning loop (run this on every problem)

1. **Clarify first (60 seconds).** Restate the problem back. Ask about inputs, output format, edge cases, constraints. "What should it do with an empty input?" is a *senior* question, not a stall.
2. **Write down 2–3 example cases** as your first tests. This anchors you and shows TDD instinct. `assert(sum("") == 0)`.
3. **Simplest thing that passes.** Even a hardcoded return. Get green.
4. **Add the next test → make it pass → refactor.** Small steps. Keep it green.
5. **Narrate every step.** "I'll start with the empty case, then a single number… I'm naming this `parse` because…" Silence is the only way to actually fail this round.
6. **When they extend it, don't panic — extend your design.** "Okay, now multiple delimiters. My `split` step is the seam that changes; the sum logic stays. Let me add a test for it first."
7. **When stuck, think out loud.** "Brute force is a loop; I suspect there's a cleaner map/reduce — let me get it working first, then simplify." You keep scoring even before you land it.

**Anti-patterns that lose points:** going silent, over-engineering before a single test passes, ignoring the interviewer's hints, arguing instead of collaborating, jumping straight to clever instead of correct.

---

## A fully worked example — the String Calculator (staged, in Swift)

This is the canonical "grows in stages" kata and it mirrors Betterment's style exactly. Watch how each stage is one small test → pass → refactor. Practice *saying the narration out loud*, not just reading it.

**The ask (Stage 1):** Write `add(_ numbers: String) -> Int`. An empty string returns 0.

> *Narrate:* "Let me start with the simplest case — empty string returns zero. I'll write the test first."

```swift
func test_emptyString_returnsZero() {
    XCTAssertEqual(add(""), 0)
}

func add(_ numbers: String) -> Int {
    return 0            // simplest thing that passes
}
```

**Stage 2 (they extend):** "A single number returns its value. `add("5")` is 5."

> *Narrate:* "Now I need to actually parse. I'll add the test, watch it fail, then handle the empty case and the number case."

```swift
func test_singleNumber_returnsValue() {
    XCTAssertEqual(add("5"), 5)
}

func add(_ numbers: String) -> Int {
    if numbers.isEmpty { return 0 }
    return Int(numbers) ?? 0
}
```

**Stage 3:** "Two comma-separated numbers return their sum. `add("1,2")` is 3."

> *Narrate:* "This is the real seam — I need to split on the delimiter, then sum. Let me refactor toward that, because it'll generalize to N numbers next."

```swift
func test_twoNumbers_returnsSum() {
    XCTAssertEqual(add("1,2"), 3)
}

func add(_ numbers: String) -> Int {
    if numbers.isEmpty { return 0 }
    return numbers
        .split(separator: ",")
        .compactMap { Int($0) }
        .reduce(0, +)
}
```

> *Point out:* "Nice — because I split-then-reduce, the two-number case and the N-number case are now the *same code*."

**Stage 4:** "Handle any count of numbers." — **You're already done.** Add the test to prove it. This is the payoff of designing at the seam.

```swift
func test_manyNumbers_returnsSum() {
    XCTAssertEqual(add("1,2,3,4"), 10)   // passes with no code change
}
```

**Stage 5:** "Newlines are also valid delimiters. `add("1\n2,3")` is 6."

> *Narrate:* "Only the split step changes. I'll split on a character set of comma and newline."

```swift
func add(_ numbers: String) -> Int {
    if numbers.isEmpty { return 0 }
    return numbers
        .split(whereSeparator: { $0 == "," || $0 == "\n" })
        .compactMap { Int($0) }
        .reduce(0, +)
}
```

**Stage 6:** "Negatives aren't allowed — throw with the offending numbers listed."

> *Narrate:* "I'll parse into an array first, filter negatives, and if any exist, throw. I'll make `add` throwing and add a test for the error case."

```swift
func add(_ numbers: String) throws -> Int {
    if numbers.isEmpty { return 0 }
    let parsed = numbers
        .split(whereSeparator: { $0 == "," || $0 == "\n" })
        .compactMap { Int($0) }
    let negatives = parsed.filter { $0 < 0 }
    guard negatives.isEmpty else {
        throw CalcError.negatives(negatives)     // "negatives not allowed: -2, -4"
    }
    return parsed.reduce(0, +)
}
```

**The lesson to internalize:** each extension touched *one* place because you kept refactoring toward clean seams. That "my design absorbed the change" moment is exactly what they're grading. Say it out loud when it happens.

---

## Your practice kata list (do these this week, out loud, TDD)

Start each from an empty file, write the first failing test, and build up. Time-box to ~30 min each. Do them in Swift **and** TypeScript so you can pick your fastest on the day.

**Warm-ups (get the TDD rhythm):**
1. **String Calculator** — the one above. Do it cold from scratch.
2. **FizzBuzz**, then extended: "FizzBuzz for multiples of 3/5, then add 7→Whizz, then make the rules configurable." (Watches how you handle changing requirements.)
3. **Roman numerals** — `int → roman`, then extend to `roman → int`. Classic staged kata.

**Core (OO design + extension — most Betterment-like):**
4. **Bank Account / Ledger kata** *(fintech flavor — very on-brand)* — support `deposit(amount)`, `withdraw(amount)`, then `printStatement()` showing date, amount, running balance, newest first. Then extend: reject overdrafts, then multiple currencies. This one is gold for Betterment; practice it twice.
5. **Vending machine / change-maker** — given a price and cash inserted, return correct change in fewest coins. Extend: out-of-stock, exact-change-only mode.
6. **Bowling game scorer** — score a game of ten-pin bowling. Extend: strikes, spares, the 10th-frame bonus. Great test of incremental design.
7. **Mars Rover** — rover on a grid takes commands `L/R/M`, reports position. Extend: grid wrapping, then obstacle detection. Excellent OO-design signal.

**Stretch (if you have time):**
8. **Conway's Game of Life** — next-generation grid. Extend: different board sizes, wrapping edges.
9. **Word frequency counter** — count word occurrences in text. Extend: ignore case, strip punctuation, top-N.

If you only have limited time: **String Calculator + Bank Ledger + Mars Rover.** Those three cover TDD rhythm, fintech relevance, and OO design.

---

## Where to practice

- **Swift:** a Playground in Xcode, or [swiftfiddle.com] in a browser. Use `XCTest` assertions or just `assert(...)`.
- **TypeScript/JS:** a local file with a couple `console.assert` calls, or any online editor. Fast to iterate.
- Don't over-tool it. The point is reps of *test → pass → refactor while talking*, not a perfect setup.

**The single highest-value drill:** do one kata while **narrating out loud to an empty room** (or record yourself). The talking is the muscle most people neglect and it's half your score in a collaborative round.

---

## Day-of tips for the pairing round (later in the process, not tomorrow)

- Have your editor open and a scratch file ready *before* the call.
- Restate the problem and confirm the first example before typing.
- Ask "would you like me to drive, or would you prefer to?" — collaborative framing.
- Keep them in the loop: "does this direction look right to you?"
- If you finish early, *they'll* extend it — so don't gold-plate; keep it clean and simple and wait for the next twist.

---

*You've written more production Swift and TypeScript than most people who'll interview you. Once the format stops being scary, this round is a chance to show exactly that. Reps + narration is the whole game.*
