# Swift Concurrency — API Cheat Sheet
**Bilal Malik · the syntax layer for the Vol. 1/Vol. 2 drills · keep open while practicing**

The drills teach *mechanisms*; this is the *vocabulary*. Organized by job-to-be-done.
**The ☑ items are the "type-from-memory" tier** — if an interviewer watches you write code,
these must flow without hesitation. Everything else you just need to *recognize and name*.

---

## 1 · Declaring and calling async code

```swift
func loadClip(id: String) async throws -> Clip          // ☑ declaring
let clip = try await loadClip(id: "abc")                // ☑ calling
```

- `async` on the function = it can suspend. `await` at the call site = potential suspension point.
- `throws` composes: `try await` (order is always `try await`, never `await try`).
- Async property: `var thumbnail: UIImage { get async throws { … } }`
- Async closure parameter: `func retry(_ op: () async throws -> Void)`

## 2 · Creating tasks (units of work)

```swift
Task { await doWork() }                                 // ☑ inherits actor context + priority
Task(priority: .userInitiated) { … }                    //   explicit priority
Task.detached { await doWork() }                        // ☑ inherits NOTHING (context, priority)

let handle = Task { try await fetch() }                 // ☑ Task<Success, Error> handle
let value  = try await handle.value                     // ☑ await its result
handle.cancel()                                         // ☑ request cancellation
```

- Priorities: `.userInteractive`, `.userInitiated`, `.medium`, `.utility`, `.background` (≈ QoS).
- `Task {}` from a `@MainActor` context runs on the main actor; `Task.detached` never does.
- Fire-and-forget is allowed but unstructured — *you* own its lifetime (Vol. 2 pages 03/04).

## 3 · Structured parallelism

```swift
async let clips   = api.fetchClips()                    // ☑ starts immediately, in parallel
async let stories = api.fetchStories()
let page = try await (clips, stories)                   // ☑ await both together
```

```swift
// ☑ the task-group skeleton — type this until it's muscle memory
let results = try await withThrowingTaskGroup(of: Thumb.self) { group in
    for id in ids {
        group.addTask { try await self.thumbnail(for: id) }
    }
    var out: [Thumb] = []
    for try await thumb in group { out.append(thumb) }   // collect as they finish
    return out
}
```

- Non-throwing variant: `withTaskGroup(of:)`. Fire-and-forget children: `withDiscardingTaskGroup`.
- Group facts to say out loud: results arrive in **completion order**; an error thrown out of the
  scope **cancels remaining children**; scope can't exit until all children end.
- Bounded concurrency pattern: seed N tasks, then `addTask` one more each time `group.next()` returns.

## 4 · Cancellation (cooperative — the drills' favorite topic)

```swift
Task.isCancelled                                        // ☑ poll the flag
try Task.checkCancellation()                            // ☑ throw CancellationError if cancelled
try await Task.sleep(for: .seconds(1))                  // ☑ sleeps; THROWS immediately on cancel
await Task.yield()                                      //   give the scheduler a breath in hot loops

await withTaskCancellationHandler {
    try await longWork()
} onCancel: {
    legacyRequest.cancel()                              //   forward cancel across a bridge
}
```

- `try?` around `Task.sleep` **swallows cancellation** — the zombie bug (playground page 03).
- Cancellation crosses only the *structured* tree; `Task {}`/`Task.detached` are firewalls.

## 5 · Actors and isolation

```swift
actor ClipCache {                                       // ☑ serial-queue-like isolation
    private var store: [String: Clip] = [:]
    func insert(_ c: Clip) { store[c.id] = c }
    nonisolated var label: String { "cache" }           //   opt OUT of isolation (no state access)
}
let cache = ClipCache()
await cache.insert(clip)                                // ☑ crossing into an actor = await
```

```swift
@MainActor final class FeedViewModel { … }              // ☑ pin a type to the main actor
@MainActor func updateUI() { … }                        //   or a single function
await MainActor.run { progressBar.update() }            // ☑ explicit hop to main
MainActor.assertIsolated()                              //   debug: crash if not on main actor
```

- Every `await` inside an actor = **reentrancy point** (Drill 1.2 / page 02).
- `@globalActor` exists for making your own MainActor-alikes — name it, rarely write it.

## 6 · Sendable and Swift 6 vocabulary

```swift
struct Clip: Sendable { … }              // ☑ safe to cross concurrency boundaries (value types ≈ free)
final class Tracker: @unchecked Sendable // ⚠️ "trust me" — you supply the locking; document why
func onEach(_ f: @Sendable (Clip) -> Void)              //   closures that cross boundaries
@preconcurrency import LegacySDK                        //   quiet warnings from old modules
nonisolated(unsafe) var sharedFlag = false              //   escape hatch; a code review magnet
```

- The one-liner: *"Sendable is the compiler's proof that a value can cross an isolation boundary
  without smuggling shared mutable state."*

## 7 · Bridging callbacks → async (continuations)

```swift
// ☑ the bridge — exactly-once resume on EVERY path (Drill 1.1 / page 05)
func fetch(id: String) async throws -> Clip {
    try await withCheckedThrowingContinuation { cont in
        legacyFetch(id: id) { clip, error in
            if let clip { cont.resume(returning: clip) }
            else        { cont.resume(throwing: error ?? FetchError.unknown) }
        }
    }
}
```

- Family: `withCheckedContinuation` / `withCheckedThrowingContinuation` (use these;
  they trap on double-resume and warn on leaks) and `withUnsafe…` (faster, silent UB — justify it).
- `cont.resume(returning:)` · `cont.resume(throwing:)` · `cont.resume()` for Void.

## 8 · Async sequences and streams

```swift
for await event in recorder.events { handle(event) }    // ☑ consume
for try await line in url.lines { parse(line) }         //   throwing variant

// ☑ producing — bridge a delegate/callback into a stream
let (stream, cont) = AsyncStream.makeStream(of: Frame.self,
                                            bufferingPolicy: .bufferingNewest(2))
cont.yield(frame)                                       // ☑ emit
cont.finish()                                           // ☑ end
cont.onTermination = { _ in recorder.stop() }           //   cleanup when consumer walks away
```

- Policies: `.unbounded` (default — the 60fps memory bomb, page 06), `.bufferingNewest(n)`,
  `.bufferingOldest(n)`. Throwing twin: `AsyncThrowingStream`.
- **Unicast** — one consumer per stream (Drill 1.2). Operators exist lazily: `.map`, `.filter`,
  `.compactMap`, `.prefix`, `.first(where:)`, `.contains`.
- Ready-made sequences to name-drop: `URLSession.bytes(from:)`, `url.lines`,
  `NotificationCenter.default.notifications(named:)`, Combine's `publisher.values`.

## 9 · SwiftUI integration

```swift
.task { await model.load() }                            // ☑ lifecycle-tied, auto-cancels on disappear
.task(id: clipID) { await model.load(clipID) }          // ☑ cancel + restart when id changes
.refreshable { await model.reload() }                   //   pull-to-refresh, async built in
Button("Save") { Task { await model.save() } }          // ☑ async from a sync context
```

- `.task` vs `Task {}` in `onAppear` is the Vol. 1 Drill 1.1 story — always have it loaded.

## 10 · Time, clocks, measurement

```swift
try await Task.sleep(for: .milliseconds(300))           // ☑ Duration API
let clock = ContinuousClock()                           //   wall-ish time (keeps ticking in sleep)
let elapsed = await clock.measure { await work() }      //   timing (SuspendingClock = its sibling)
```

## 11 · The async system APIs you'll actually call at Medal

```swift
let (data, response) = try await URLSession.shared.data(from: url)        // ☑
let (data, response) = try await URLSession.shared.data(for: request)     // ☑
try await URLSession.shared.upload(for: request, fromFile: fileURL)       //   streams from disk
let (bytes, _) = try await URLSession.shared.bytes(from: url)             //   AsyncSequence of bytes
let duration = try await asset.load(.duration)                            //   AVFoundation's async loading
let image = try await ImageRenderer(content: view)…                       //   (and friends — the SDKs are async-first now)
```

---

## The 12-line pop quiz (cover the sheet, write these cold)

1. Declare an async throwing function and call it.
2. Start an unstructured task at `.userInitiated`, keep the handle, cancel it, await its value.
3. Two `async let`s awaited together.
4. Full throwing task-group skeleton, collecting results.
5. Sleep that respects cancellation (and say why `try?` there is a bug).
6. An actor with one mutating method; call it from outside.
7. Pin a view model to the main actor; hop to main explicitly from elsewhere.
8. Bridge a callback API with a checked throwing continuation.
9. Make an AsyncStream with `bufferingNewest(2)`, yield, finish.
10. Consume any AsyncSequence with error handling.
11. `.task(id:)` on a view, and say what changing the id does.
12. `withTaskCancellationHandler` forwarding a cancel to a legacy request.

Write all 12 without notes and the syntax layer is done — everything after that is the
mechanisms, which is what the drill docs and the playground are for.
