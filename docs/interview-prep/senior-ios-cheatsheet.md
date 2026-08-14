# Senior iOS / Swift — The Everything Cheat Sheet
**Bilal Malik · the answers you know but forget · skim daily, cram the ★ the morning of**

Format: the question as they ask it → the senior answer, compressed. Not for learning — for
*reloading*. Deep coverage lives in your other docs: concurrency mechanisms → Drill Vols. 1–2 +
playground · concurrency syntax → API cheat sheet · SwiftUI fingers → refresher. This doc is
everything *around* those, plus one-paragraph condensations so it works standalone.

The meta-rule for every answer here: **senior = trade-offs + "it depends" resolved by context +
how you'd verify.** Mid-level recites; senior chooses.

---

## 1 · Swift Language Core

**★ "Struct or class — how do you choose?"**
Default to struct: value semantics, no shared mutable state, free `Sendable`, stack-friendly.
Choose a class for: identity (two references to *the same thing*), lifecycle/deinit, Objective-C
interop, or genuinely shared mutable state (then consider an actor instead). The trap answer to
avoid: "structs are faster" — copying big structs isn't free; the real reason is *semantics*.

**★ "Explain copy-on-write."**
Swift's collections (Array/Dictionary/String) are structs wrapping heap storage; copies share
storage until a *mutation*, which first checks `isKnownUniquelyReferenced` and clones only if
shared. Your own struct wrapping a class does NOT get this automatically — it silently shares
(Vol. 2 Drill 3.3). You can hand-roll CoW with the same check.

**"Value semantics vs reference semantics in one line?"**
Value: copies are independent; mutation is local. Reference: copies are aliases; mutation is
visible to everyone holding one. A struct containing a class field has value semantics only skin-deep.

**★ "`some` vs `any`?"**
`some P` = opaque type: ONE concrete type the compiler knows (static dispatch, no boxing) — the
caller just can't name it. `any P` = existential box: can hold *different* conforming types
(dynamic dispatch, boxing cost). Prefer `some`/generics in APIs; use `any` for heterogeneous
storage (`[any Renderer]`). Post-5.7, protocols with associated types work in `any` via primary
associated types (`any Collection<Int>`).

**"Generics vs protocols — when which?"**
They're partners: generics constrain (`func f<T: Codable>(­_ t: T)`), protocols describe.
Generic = compile-time specialization, fast, homogeneous. Existential = runtime flexibility,
heterogeneous. Associated-type protocols push you toward generics; `some` sugar covers most of it.

**★ "How does method dispatch work in Swift?"**
Four tiers: **static** (structs, `final`/`private` class methods, protocol-*extension* methods
that aren't requirements — your "prints software not metal" mini), **vtable** (class methods),
**witness table** (protocol *requirements* called through the protocol), **message send**
(`@objc dynamic` — enables KVO, method swizzling). Senior flavor: `final` isn't style, it's a
dispatch optimization and an inheritance-intent statement.

**"Closures — what do I need to say about capture?"**
Closures capture *variables by reference* by default (they see later mutations); a capture list
copies values at creation — `[weak self]` is a capture-list entry changing *how* self is held.
`@escaping` = outlives the call, must be heap-stored, forces explicit `self.` — that requirement
exists to make you *think about the retain*.

**★ "Error handling — the senior tour."**
`throws`/`do-catch` for recoverable; `Result` for storing/passing outcomes; `try?` when null is
an acceptable answer (but it *eats cancellation* — drill lesson); `try!`/`fatalError` for
programmer-error invariants. Recency flex: Swift 6 **typed throws** — `func load() throws(NetworkError)`
— for closed error domains; still prefer untyped at public API boundaries that will evolve.

**"Optionals, beyond the basics?"**
They're `enum Optional { case none, some(Wrapped) }` — pattern-matchable. Senior kit:
`map`/`flatMap` on optionals to avoid pyramid unwrapping, `??` with lazy rhs, `guard let` for
early-exit shape, `if let shorthand` (`if let user` — 5.7). Double optionals (`String??`) show up
from optional-chaining + dictionary lookups; `flatMap` flattens.

**"Enums — what makes them senior?"**
Associated values as lightweight sum types (model state machines: `.loading/.loaded([Post])/.failed(Error)`),
exhaustive `switch` as a *compiler-enforced TODO list* when cases are added, `indirect` for
recursion, `CaseIterable`, raw-value vs associated-value distinction, and the resilient-decoding
`.unknown` case pattern (Vol. 2 Drill 6.1).

**"Property wrappers / result builders — one-liner each?"**
Property wrapper = a type that intercepts get/set with storage (`@State`, `@Published`, `@AppStorage`
are all this one mechanism). Result builder = compile-time DSL transform on a closure's statements —
it's what makes `VStack { … }` legal. Being able to *name the mechanism* is the senior signal.

**"== vs === ?"** `==` value equality via `Equatable`; `===` reference identity (same instance).
Classes can have both, and they can disagree — that's a feature.

**"Any vs AnyObject?"** `Any` = anything including values and functions; `AnyObject` = class
instances only (it's the constraint class-bound protocols use).

---

## 2 · Memory & ARC (condensed — mechanisms live in the drills)

**★ "Explain ARC like a senior."**
Compile-time-inserted retain/release on *reference types* — deterministic, not a GC, no pauses,
but cycles are YOUR problem. `weak` = optional, auto-nils, safe across uncertain lifetimes;
`unowned` = non-optional, crashes if outlived — only for provably-tied lifetimes. The five cycle
nests to name: closures capturing self (stored by self), delegates (make them `weak` — except
URLSession, which *retains* its delegate until invalidated), repeating Timers/CADisplayLink,
NotificationCenter block observers, and long-lived `Task`s capturing self (the modern one).

**"Why did memory spike in my loop even though nothing's retained?"**
Autorelease: ObjC-backed frameworks (AVFoundation/ImageIO/UIKit) queue objects to the pool, which
drains per run-loop tick — a tight loop never ticks. Wrap iterations in `autoreleasepool { }`
(Vol. 2 Drill 3.2). Pure Swift rarely autoreleases, which is why everyone forgot the tool.

**"How do you actually find a leak/cycle?"**
Memory Graph Debugger (see the cycle as arrows), Instruments Leaks + Allocations ("created &
persistent" filter), `deinit` print breadcrumbs while developing. Saying the *tools* is half the answer.

**"Stack vs heap?"** Value types stack-allocated when size/lifetime is static; escape to heap when
boxed (existentials, closures capturing them, class fields). Classes always heap. Don't overclaim —
the optimizer decides; the *semantics* are what you control.

---

## 3 · Concurrency (one-screen condensation — full depth in your dedicated docs)

**★ The GCD two-axes summary.** Axis 1, queue kind: **serial** (one at a time — default for
custom queues), **concurrent** (`.concurrent` attr), **main** (special serial, main thread),
**global** (system concurrent, per-QoS). Axis 2, submission: **async** (enqueue, move on) vs
**sync** (block until done — never onto your own queue: `main.sync` from main = deadlock).
Extras: `.barrier` on concurrent = reader-writer lock; `concurrentPerform` = parallel-for.

**★ The old→new mapping sentence.** "Tasks replace dispatched blocks, the cooperative pool
replaces the global queues, actors replace serial queues — *minus atomicity across awaits* —
and `@MainActor` replaces `main.async`." Plus the asterisk that makes it senior: actors are
**reentrant at every await** (serial queues run blocks to completion; actors don't run methods
atomically across suspension points).

**★ The six mechanisms to have loaded** (each is a drill): cancellation is cooperative and
`try?` swallows it · `Task {}` inherits context/priority but NOT cancellation; `Task.detached`
inherits nothing · continuations resume exactly once, every path · AsyncStream is unicast and
its buffering policy is the design decision · stale-response races need cancel + post-await gate ·
chunky-not-chatty actor APIs.

**"@MainActor vs DispatchQueue.main.async?"** Same destination, different guarantee model:
`@MainActor` is *compile-time* isolation (checked, composable, inherited by `Task {}`);
`main.async` is a runtime hop the compiler can't verify. Migration direction is always toward the former.

---

## 4 · SwiftUI (condensed — fingers live in the refresher)

**★ Ownership table, four lines.** Own value state: `@State`. Child read/write parent's value:
`@Binding` (pass `$`). Own a reference model: `@State` + `@Observable` (modern) / `@StateObject`
(legacy). Passed-in model: plain `let` (modern — observation still tracks) / `@ObservedObject`
(legacy, and NEVER inline-initialize it — the recreate bug).

**★ "What actually makes SwiftUI re-render?"**
`body` re-evaluates when state it *reads* changes — `@Observable` tracks per-property (read in
body = dependency), `ObservableObject` invalidates on any `@Published` (coarser). Body must be a
cheap pure read: no formatters, no O(n), no side effects (Drill 4.3). Diffing is identity-driven.

**★ "Explain view identity."**
Two kinds: **structural** (position in the type tree — `if/else` branches are *different*
identities, so branch-switching resets `@State`; branch modifiers instead) and **explicit**
(`.id()`, `ForEach` ids — stable server IDs, never `\.self` on mutating data). Identity controls
state lifetime, animations, and `task(id:)` restarts. Most "SwiftUI is broken" bugs are identity bugs.

**"@State init gotcha?"** `State(initialValue:)` in an `init` only takes effect on FIRST
appearance of that identity — later re-inits are ignored (storage belongs to the identity).
Reset via `.id()`, sync via `onChange`, or don't copy the source of truth in the first place.

**"UIKit interop?"** `UIViewRepresentable`/`UIViewControllerRepresentable` (make/update split —
update must be idempotent; `Coordinator` for delegates) to host UIKit in SwiftUI;
`UIHostingController` for the reverse. Senior line: incremental adoption is the norm, not a rewrite.

**"Navigation, modern answer?"** `NavigationStack` + value-based `NavigationLink(value:)` +
`.navigationDestination(for:)`; programmatic control and deep links via a bound `NavigationPath`.
`NavigationView` is deprecated — correct yourself out loud if you type it.

---

## 5 · UIKit — still asked, still shipped

**★ "View controller lifecycle, in order."**
`init` → `loadView` → `viewDidLoad` (view exists, bounds NOT final — don't do geometry here) →
`viewWillAppear` → `viewWillLayoutSubviews` → `viewDidLayoutSubviews` (geometry is real HERE) →
`viewDidAppear`. Mirror pair on the way out: `viewWillDisappear` → `viewDidDisappear`.
`viewDidLoad` runs once; the appear/layout family can run many times — idempotency matters.

**★ "frame vs bounds?"**
`frame` = position+size in the *superview's* coordinate space; `bounds` = the view's *own* space
(origin usually .zero — and a `UIScrollView` scrolls precisely by moving `bounds.origin`).
They diverge under transforms: rotate a view and `frame` becomes the bounding box, `bounds` is unchanged.

**"setNeedsLayout vs layoutIfNeeded vs layoutSubviews?"**
`setNeedsLayout` = mark dirty, coalesced, layout happens next run-loop pass (cheap, call freely).
`layoutIfNeeded` = force the pending pass NOW (needed before animating constraint changes).
`layoutSubviews` = the override where layout actually happens — never call it directly.
Same trio exists for display: `setNeedsDisplay` → `draw(_:)`.

**★ "Auto Layout: hugging vs compression resistance?"**
Content hugging = resistance to *growing* beyond intrinsic size ("don't stretch me");
compression resistance = resistance to *shrinking* ("don't squish me"). Ties break by priority —
the classic two-labels-in-an-HStack question is answered by raising one label's hugging or CR
priority. Also name: constraint priorities (999 vs required for breakable), `systemLayoutSizeFitting`.

**"Cell reuse — the two bugs."**
(1) Stale async content landing on a recycled cell → validate identity at delivery + cancel in
`prepareForReuse` (Vol. 1 Drill 5.3). (2) Doing sync work (image decode, formatters) in
`cellForRowAt` → scroll jank; decode off-main, downsample to target size, cache. Modern layer to
name: diffable data sources + compositional layout — identity-driven updates instead of
`performBatchUpdates` crash roulette.

**"Responder chain / hit testing?"**
Touch finds its view via `hitTest(_:with:)` (deepest eligible subview; overridable for
enlarging tap targets); events then bubble UP the responder chain (view → superview → VC → window →
app) — the mechanism behind `becomeFirstResponder` and menu actions.

---

## 6 · App & System

**★ "App lifecycle states?"**
Not running → inactive → active → background (brief execution) → suspended (in RAM, no CPU) →
possibly terminated by the system (no callback! — plan via state restoration, not goodbyes).
SwiftUI dialect: `scenePhase` (`.active/.inactive/.background`); UIKit dialect: scene delegates.
Watchdog trivia that lands: hangs at launch get you killed with `0x8badf00d` ("ate bad food").

**★ "How does background work actually work?"**
Four honest lanes: (1) short task completion — `beginBackgroundTask` (~30s grace);
(2) **BGTaskScheduler** — `BGAppRefreshTask` (frequent, tiny) and `BGProcessingTask` (rare,
minutes, may require power/Wi-Fi) — both *discretionary*, the OS decides when, design for "maybe
never"; (3) **background URLSession** — transfers continue even after termination, app relaunched
via `handleEventsForBackgroundURLSession` (the upload-queue design, Vol. 2 Drill 5.4);
(4) declared modes (audio, location, VoIP) only if you genuinely are one.

**"Push notifications, end to end?"**
App registers → APNs issues device token → your server stores it → server pushes via APNs.
Rich media = Notification Service Extension (mutates payload, tight memory/time budget).
Silent push = `content-available: 1`, *not guaranteed delivery* — a hint, never a transport.
Actionable = categories. Provisional auth = quiet delivery without the permission prompt.

**"Universal links vs custom schemes?"**
Universal links (https + apple-app-site-association file, verified domain) — secure, fall back to
web, the right answer. Custom schemes (`medal://`) — trivially hijackable, fine for app-to-app on
your own devices. Handle both through the same router; cold-launch routing must wait for app state
to be ready (the race everyone ships).

---

## 7 · Architecture & Patterns

**★ "MVVM vs MVC vs TCA vs VIPER — which do you use?"**
The senior answer is a decision, not a tour: "MVVM-shaped — views thin, an observable model per
screen owning state+logic, services injected behind protocols — because it matches SwiftUI's
data flow and stays testable. MVC is fine for tiny scope; TCA buys rigorous unidirectional state
and exhaustive testing at the cost of ceremony and onboarding; VIPER mostly survives in legacy.
I match the codebase and push toward testability at the seams."

**"Coordinator pattern — still a thing?"**
Its *problem* is still a thing: view controllers/views shouldn't know navigation graphs. In UIKit,
coordinator objects own flows; in SwiftUI the same role is played by router objects owning a
`NavigationPath`/enum of routes. Name the principle, not the dogma.

**★ "How do you do dependency injection without a framework?"**
Initializer injection behind protocols, compose in one place (the app/scene root). Environment
for SwiftUI-native cross-cutting values. Avoid singletons-as-hidden-globals — `URLSession.shared`
is fine *accessed through an injected abstraction* so tests can substitute. A DI framework is
rarely worth it in Swift; the language's defaults (inits, protocols, generics) are the framework.

**"Delegation vs closure vs Combine vs AsyncSequence — how do you pick?"**
One-shot response → closure or `async` return. 1:1 ongoing relationship → delegate (or its modern
skin, a small protocol). Multicast/streams over time → Combine or AsyncSequence, matching the
codebase's dialect. The anti-pattern is mixing three of them across one boundary.

**"How do you modularize?"**
Local SPM packages by layer/feature: `Models`, `Networking`, `DesignSystem`, feature packages.
Wins: enforced dependency direction, parallel builds, testable in isolation, preview speed.
The senior caveat: modularize along *stable* seams; premature feature-splitting creates
import spaghetti.

---

## 8 · Persistence

**★ The decision ladder (memorize as a ladder, not a list):**
flags/prefs → **UserDefaults** (not secure, not for blobs) · secrets → **Keychain** (encrypted,
survives reinstall, the ONLY place for tokens) · documents/media → **files** (with
`FileProtection` levels; caches dir for evictables) · structured queryable data →
**SwiftData** (`@Model`, `@Query` — iOS 17+, SwiftUI-native) or **Core Data** (mature,
`NSPersistentContainer`) · heavy/relational/cross-platform control → **SQLite/GRDB**.

**"Core Data senior gotchas?"**
Contexts are not thread-safe: one per queue, touch objects only via `perform`/`performAndWait`;
background work in a background context, UI on `viewContext` with
`automaticallyMergesChangesFromParent = true`. Lightweight migrations are automatic for additive
changes — but *test* migrations with real prior-version stores. `NSFetchedResultsController` /
`@FetchRequest` for change-driven UI.

**"Where do access tokens go?"** Keychain. Never UserDefaults (backed up, plaintext-adjacent),
never files without protection classes. Refresh tokens: Keychain + `kSecAttrAccessible` chosen
deliberately (e.g. `afterFirstUnlock` for background refresh).

---

## 9 · Networking

**★ "Design a networking layer."**
Thin: an injected client behind a protocol (`func send<T: Decodable>(_ endpoint: Endpoint) async throws -> T`),
endpoints as data (path/method/body), decode OFF the main actor, errors mapped into a small typed
domain (network vs server vs decode vs auth). No Alamofire by default — `URLSession` async APIs
cover 95%; adding a dependency is a decision, not a reflex.

**★ "How do you handle token refresh with concurrent requests?"**
The trap: five 401s → five simultaneous refreshes → server invalidates tokens → logout storm.
Serialize refresh through an **actor** holding the in-flight refresh `Task` (the memoized-task
pattern from the reentrancy drill, wearing an auth costume): first 401 starts the refresh, the
other four `await` the *same* task, all retry once with the new token.

**"Caching?"**
`URLCache` honors HTTP semantics (ETag/If-None-Match → 304, Cache-Control) — free wins if the
backend cooperates. Above it: stale-while-revalidate at the app layer (show cached, refresh
quietly). Explicit `cachePolicy` per request when correctness demands freshness.

**"Do you check reachability before requests?"**
No — preflighting is a race (reachable ≠ will succeed). Just try, fail fast with good errors, and
use `NWPathMonitor` to *react* (auto-retry queued work when the path returns — the upload-queue
pattern). Also name: `waitsForConnectivity` on the session config.

**"Certificate pinning?"**
`URLSessionDelegate` challenge handling comparing to pinned SPKI hashes (pin the key, not the
cert, so rotation survives). Trade-off to state: pinning breaks on cert changes you don't
control — ship with a kill switch/backup pins.

---

## 10 · Testing

**★ "What's your testing philosophy?"**
Pyramid, honestly applied: fast unit tests on models/logic (the bulk), integration tests on the
seams (decode real fixtures, DB migrations), a thin crust of UI tests for critical flows only
(they're slow and flaky — schemes with retry ≠ quality). Design FOR testing: protocol seams +
initializer injection; if it's hard to test, the design is telling you something.

**"Swift Testing or XCTest?"**
Swift Testing (`@Test`, `#expect`, `#require`, parameterized tests, suites as structs) for new
work — async tests just `await`, no expectation dance. XCTest fluency retained for existing
suites (`XCTestCase`, `XCTAssertEqual`, `fulfillment(of:)`). Same both-eras posture as
`@Observable` vs `ObservableObject`.

**"How do you test async code / actors?"**
Make the test `async` and await the real thing; `@MainActor` test types when the subject is.
Inject clocks/schedulers for time-based logic (`ContinuousClock` behind a protocol) instead of
`sleep`-and-pray. For streams: collect into an array with a bounded `prefix` and assert.

**"How do you test networking without the network?"**
Two levels: stub the client protocol (fast, most tests — the `StubClient` move), or register a
custom `URLProtocol` on an ephemeral session config to test the *real* client's
request-building/decoding against canned responses. Fixtures = real captured JSON, including the
ugly ones (unknown enum cases — Drill 6.1's regression test).

---

## 11 · Security & Privacy

**★ Rapid checklist:** secrets in **Keychain** (never UserDefaults/plist/source) · **ATS** stays
on, exceptions documented · file **Data Protection** classes chosen per file · biometrics via
`LocalAuthentication` gating Keychain items (`.biometryCurrentSet` for "enrolled fingers changed
= re-auth") · **privacy manifests** (`PrivacyInfo.xcprivacy` — required-reason APIs, tracking
domains) · **ATT** prompt only when actually tracking · no PII in logs/analytics/crash breadcrumbs ·
jailbreak/debugger checks = speed bumps, say so honestly · pin only with a rotation story (§9).

**"App Groups?"** Shared container + UserDefaults(suiteName:) between app and extensions —
how the broadcast-extension recording reaches the main app (Vol. 2 Drill 5.4's handoff).

---

## 12 · Tooling, Release, Performance

**★ "Walk me through code signing like I'm smart but rusty."**
Certificate = *who* (your identity, signs the binary). Provisioning profile = *what may run where*
(app ID + entitlements + devices + which cert). Most "signing hell" is a stale profile not
containing the cert/device/entitlement you're using. Automatic signing is fine until CI; CI wants
explicit (fastlane match or Xcode Cloud managing it).

**"CI/CD for iOS?"**
Fastlane (or Xcode Cloud) lanes: test → build → TestFlight; GitHub Actions/CircleCI as the runner
(Medal's stack lists both). Release hygiene: phased release, crash-rate gates, dSYM upload for
symbolication, feature flags so shipping ≠ launching.

**★ "App is slow/janky — go."**
The tool list IS the answer: Time Profiler (main-thread work), SwiftUI template (body counts),
Allocations/Leaks, Core Animation FPS, hitch metrics, MetricKit in prod. Usual suspects in order:
main-thread I/O or decode, images at full resolution (downsample!), body/`cellForRow` doing work,
over-invalidation (coarse `ObservableObject`), layout thrash. Then the launch-time flavor:
dyld + static initializers + `didFinishLaunching` doing too much; measure with app launch
Instrument, fix by deferring.

**"SPM vs CocoaPods?"** SPM: first-party, in-Xcode, the default and the direction of travel.
CocoaPods: legacy reach, maintenance mode. Binary targets/XCFrameworks for closed-source deps.

---

## 13 · Rapid-Fire Traps (the ones that catch seniors being rusty)

- **`DispatchQueue.main.sync` from main** → deadlock (serial queue waiting on itself).
- **Protocol extension method not in the protocol** → static dispatch: `let p: P = Impl(); p.m()`
  runs the *extension* body. Requirement in protocol → witness dispatch → the impl's.
- **`"👨‍👩‍👧‍👦".count == 1`** — grapheme clusters; no integer subscripting; UTF-16 counts differ (truncation bugs).
- **Dictionary/Set iteration order** — unspecified, per-run seeded. Sort before display.
- **`Int8.max + 1`** traps (overflow is loud); `&+` wraps. Floats: `0.1 + 0.2 != 0.3` — compare
  with tolerance; media time uses rational `CMTime` for exactly this reason.
- **`lazy var`** — not thread-safe; `static let` IS (dispatch_once semantics).
- **`defer`** — LIFO, runs on every exit including throws; load-bearing for `isLoading = false`.
- **Value captured vs referenced** — `{ print(x) }` sees later mutations; `{ [x] in print(x) }` froze it.
- **`@ObservedObject var m = Model()`** — recreated every parent render. Own with `@StateObject`/`@State`.
- **`ForEach(items, id: \.self)`** on non-unique/mutating data — identity chaos.
- **`try?` around `Task.sleep`** — swallows `CancellationError`; the zombie speeds up.
- **Struct containing a class** — value semantics ends at the reference (shared mutation).
- **`main.async` inside `viewDidLoad`** — runs after the current run-loop pass, hence "why does
  my print come last" (A, C, B ordering).

---

## 14 · Senior Framing Lines (the answers behind the answers)

- **"It depends" + the two branches + your pick for THIS context.** Never just "it depends."
- **"Measure first"** — before optimizing, before refactoring, before believing a bug report.
- **"Both eras"** — modern API as default, legacy named fluently, "I match the codebase."
- **"Cancellation, identity, isolation, idempotency, memory-at-scale"** — the five questions that
  find most mobile bugs (your drill themes; they generalize to any code shown to you).
- **"Product first"** — perceived performance over benchmark performance; degrade honestly;
  telemetry on the failure paths. You're interviewing at a consumer company — this register wins.

*Skim daily. ★ the morning of. Everything here is a headline — if any answer surprises you,
the deep version lives in your drill docs. You've shipped all of this; this sheet just puts the
words back within reach.*
