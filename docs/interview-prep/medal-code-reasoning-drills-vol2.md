# Medal / General Intuition — Code-Reasoning Drills, Vol. 2 (Boss Level)
**Bilal Malik · Senior iOS Engineer deep dive · harder companion to Vol. 1**

Vol. 1 covered the bugs every senior candidate should catch. This volume is the tier above: the bugs that make *the interviewers* raise their eyebrows when you catch them. Same rules — cover the answer, reason **out loud**, mechanism over vibes. Nothing here repeats Vol. 1; everything builds on it.

**★ priority track (~2 hours):** 1.1, 1.2, 1.4, 2.2, 2.3, 3.3, 4.3, 5.2, 5.3, 6.1.

A theme to notice as you go: Vol. 1 bugs were mostly *lifetime* and *identity*. Vol. 2 bugs are mostly **boundaries** — where cancellation stops propagating, where value semantics quietly end, where an abstraction (seek, decode, append) has a tolerance you didn't know you'd accepted. Senior engineers are people who know where the boundaries are.

---

## Section 1 — Swift Concurrency, the sharp edges

### Drill 1.1 ★ — The await that never returns

```swift
func fetchClip(id: String) async throws -> Clip {
    try await withCheckedThrowingContinuation { continuation in
        legacyAPI.fetchClip(id: id) { clip, error in
            if let clip {
                continuation.resume(returning: clip)
            }
            // TODO: handle error
        }
    }
}
```

**Prompt:** This bridges an old callback API. On success it works. On failure, there's no crash, no error, no log — the caller just… never continues. Later you fix the error path, and now you get a rare hard crash instead. Explain both behaviors.

**Answer:** Two distinct continuation crimes.

1. **The hang:** if `clip` is nil, the continuation is **never resumed** — the suspended task waits forever. It's not cancelled, not failed; it's parked eternally, holding its captures. (`withCheckedThrowingContinuation` will at least log "leaked its continuation" at runtime — worth saying you know that.) The iron rule: **every path resumes exactly once.**

2. **The rare crash after "fixing" it:** if the fix resumes on both branches but `legacyAPI` occasionally calls its completion **twice** (retry logic, cached + network callback — legacy APIs do this), a checked continuation **traps on double-resume**. That's actually the checked variant doing its job — `withUnsafeContinuation` would be silent undefined behavior instead.

Hardened bridge:

```swift
try await withCheckedThrowingContinuation { continuation in
    legacyAPI.fetchClip(id: id) { clip, error in
        if let clip { continuation.resume(returning: clip) }
        else { continuation.resume(throwing: error ?? ClipError.unknown) }
    }
}
```

**Senior extensions:** if the callback can genuinely fire twice, guard with a "resumed" flag (or nil-out an optional continuation). And this bridge ignores **cancellation** — the legacy request keeps running even if the task is cancelled; `withTaskCancellationHandler` wrapping the bridge lets you cancel the underlying request too.

**Say this out loud:** *"Continuations are a contract: exactly-once resume, every path, including the paths the legacy API takes on its worst day. And bridging is where cancellation silently falls on the floor unless I forward it myself."*

---

### Drill 1.2 ★ — Two listeners, half the messages

```swift
final class ChatService {
    let messages: AsyncStream<Message>   // yields from the socket

    // Consumer A — the conversation screen:
    // for await message in chatService.messages { render(message) }

    // Consumer B — the unread-badge counter:
    // for await message in chatService.messages { incrementBadge() }
}
```

**Prompt:** The conversation screen misses messages, but only when the badge counter is running. Each message shows up in exactly one place — sometimes the screen, sometimes the badge. What's going on?

**Answer:** **`AsyncStream` is unicast** — it's designed for a *single* consumer. With two concurrent `for await` loops on the same stream, each yielded value is delivered to **one** of the waiting iterators, not both. You're not observing a broadcast; you're *competing for elements*. The symptom — values split between consumers — is exactly the diagnostic signature.

Fixes, in order of preference:
1. **One consumer, fan out yourself:** a single loop owns the stream and dispatches to N registered handlers (or updates one `@Observable` model that both screens read — often the *right* architecture anyway).
2. **Multiple streams:** the service holds an array of continuations and yields into each — a hand-rolled broadcast.
3. **Name the real tool:** `swift-async-algorithms` has channel/share-style primitives for multi-consumer scenarios; Combine's `share()` solves this in its dialect (ties to Vol. 1 Drill 2.4 — same disease, different framework).

**Say this out loud:** *"Unicast vs broadcast is a property I check for every stream abstraction — AsyncStream is unicast, `@Published`/`share()` is broadcast, delegates are unicast, NotificationCenter is broadcast. Half of 'events go missing' bugs are a unicast primitive used as a broadcast one."*

---

### Drill 1.3 — The cancellation that stopped at the border

```swift
struct EditorView: View {
    var body: some View {
        TimelineView()
            .task {
                await model.generateFilmstrip()   // cancelled on disappear ✓
            }
    }
}

// in the model:
func generateFilmstrip() async {
    await Task.detached(priority: .userInitiated) {   // "keep it off the UI thread"
        await self.renderThumbnails()                  // 30s of CPU work
    }.value
}
```

**Prompt:** You verified `.task` cancels on disappear — yet closing the editor mid-generation leaves CPU pinned for 30 more seconds and the battery complaint stands. Why didn't the cancellation work?

**Answer:** **Cancellation only propagates through structured concurrency.** `Task.detached` (and plain `Task { }`) starts a **new unstructured root** — it inherits *nothing*: not cancellation, and for `detached`, not even priority or actor context. The outer task gets cancelled and is now just… awaiting the `.value` of a task that no one told to stop. The detached work happily finishes.

Also worth saying: the detached hop is probably **unnecessary** — `await self.renderThumbnails()` doesn't block the UI thread just because it was *called* from a view-adjacent context; suspension isn't blocking, and the work runs wherever its own isolation says. "Hop off the main thread" instincts from GCD produce detached-task cargo culting in async/await.

If you genuinely need an unstructured task, forward cancellation manually:

```swift
func generateFilmstrip() async {
    let work = Task.detached(priority: .userInitiated) { await self.renderThumbnails() }
    await withTaskCancellationHandler {
        _ = await work.value
    } onCancel: {
        work.cancel()
    }
}
```

…but the minimal fix is deleting the detached wrapper entirely and keeping the call structured.

**Say this out loud:** *"Every `Task { }` and `Task.detached` is a cancellation firewall. My code review question is always: who cancels this, and did we mean to opt out of the structured tree?"*

---

### Drill 1.4 ★ — switchToLatest, async edition

```swift
@MainActor @Observable
final class ProfileModel {
    var clips: [Clip] = []

    func tabChanged(to tab: ProfileTab) {
        Task {
            clips = (try? await api.fetchClips(for: tab)) ?? []
        }
    }
}
```

**Prompt:** User taps Clips → Likes → Clips quickly. Sometimes the Clips tab ends up showing Likes. You fixed this exact race in Combine with `switchToLatest` (Vol. 1, Drill 2.1). Write the async/await version of the cure — and name the subtlety that makes cancellation alone insufficient.

**Answer:** Same stale-response race: three unstructured tasks in flight, **last to finish wins**, and finish order isn't start order. The async cure is "cancel the previous, and *verify before commit*":

```swift
private var loadTask: Task<Void, Never>?

func tabChanged(to tab: ProfileTab) {
    loadTask?.cancel()
    loadTask = Task {
        guard let result = try? await api.fetchClips(for: tab) else { return }
        guard !Task.isCancelled else { return }   // ← the subtlety
        clips = result
    }
}
```

**The subtlety:** cancellation is cooperative, so `cancel()` doesn't stop a task that's already past its last suspension point — a response that arrived *just* before the cancel can still be sitting there about to assign. The **post-await `isCancelled` check** is the commit gate: "I have the data, but am I still the request the UI wants?" (Belt-and-braces alternative: capture `tab` and compare against current selection before assigning — a generation/epoch guard that works even where cancellation can't reach.)

Also name the freebie: `URLSession`'s async methods check cancellation *for* you mid-flight and throw `CancellationError`, so cancelled requests usually die at the network layer — the gate is for the window after.

**Say this out loud:** *"Combine gave us switchToLatest as a word; in async/await I have to build it — cancel the predecessor, then gate the commit. Any 'latest request wins' UI needs both halves."*

---

### Drill 1.5 — The actor you're pelting with pebbles

```swift
actor SessionRecorder {
    private var events: [InputEvent] = []
    func record(_ event: InputEvent) { events.append(event) }
}

// consumer, on a burst of controller input:
for event in inputBatch {          // ~5,000 events
    await recorder.record(event)   // ⚠️
}
```

**Prompt:** Thread Sanitizer is clean, the logic is right, and yet Instruments shows this loop is slow and the recorder's event ordering interleaves oddly with another producer. This one isn't a correctness bug — what is it?

**Answer:** **Chatty actor traffic.** Every `await recorder.record(event)` is a potential executor hop plus suspension bookkeeping — five thousand of them, serialized through the actor's mailbox. Worse for ordering: because the loop suspends *between* elements, **another producer can interleave its events mid-batch** — the actor guarantees each call is atomic, not that your loop is.

Fix: **chunky APIs, not chatty ones** —

```swift
extension SessionRecorder {
    func record(contentsOf batch: [InputEvent]) { events.append(contentsOf: batch) }
}
await recorder.record(contentsOf: inputBatch)   // one hop, one atomic append
```

One suspension, one mailbox entry, batch-atomic ordering. If the producer is a live stream rather than an array, buffer locally and flush at an interval (this is Drill 6.2's coalescing idea, one layer down).

**Say this out loud:** *"Actors protect state, but the await between calls is where both performance and atomicity leak. I design actor APIs the way I design network APIs — batch endpoints, because every call has a boundary cost and no two calls are atomic together."*

---

## Section 2 — Combine, beyond the classics

### Drill 2.1 — The heavy work that teleported to the main thread

```swift
URLSession.shared.dataTaskPublisher(for: feedURL)
    .receive(on: DispatchQueue.main)
    .map { parseAndDiffFeed($0.data) }     // ~80ms of decode + diff
    .sink { [weak self] feed in self?.apply(feed) }
    .store(in: &cancellables)
```

**Prompt:** The author put `receive(on: .main)` there because "UI updates must be on main" — correct instinct, and yet scrolling hitches every refresh. Where does each line of this pipeline actually run?

**Answer:** **Operator position is thread position.** `receive(on:)` moves everything *downstream* of it to the given scheduler — so the 80ms `parseAndDiffFeed` now runs **on the main thread**, right before the sink. The network callback arrived on a background queue (URLSession's own), which is exactly where the parsing *should* have stayed.

```swift
URLSession.shared.dataTaskPublisher(for: feedURL)
    .map { parseAndDiffFeed($0.data) }     // stays on URLSession's queue
    .receive(on: DispatchQueue.main)       // hop AFTER the heavy lifting
    .sink { [weak self] feed in self?.apply(feed) }
```

And complete the picture: `subscribe(on:)` is the other half people confuse — it moves the *subscription/upstream work* (where the publisher starts its job), not downstream delivery. Rule of thumb: `subscribe(on:)` places the work's origin, `receive(on:)` places everything after that line.

**How you'd catch it:** Time Profiler shows the parse on the main thread; or a `.print()`/`.handleEvents` breadcrumb logging `Thread.current` at each stage while debugging.

---

### Drill 2.2 ★ — The leak hiding in `assign`

```swift
final class SearchModel: ObservableObject {
    @Published var query = ""
    @Published var results: [Clip] = []
    private var cancellables = Set<AnyCancellable>()

    init() {
        $query
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .map { Self.localMatches(for: $0) }
            .assign(to: \.results, on: self)     // ⚠️ no closure, no [weak self]… no problem?
            .store(in: &cancellables)
    }
}
```

**Prompt:** There's no closure capturing `self` anywhere — the usual retain-cycle suspect is absent. The model still never deallocates. Find the cycle.

**Answer:** **`assign(to:on:)` retains its object parameter.** The subscriber holds a strong reference to `self` for as long as the subscription lives; self holds `cancellables`, which holds the subscription. Cycle complete — no closure required. This is the documented, famous trap in an API that *looks* capture-free.

The purpose-built fix — assign into the `@Published` property's projected publisher instead:

```swift
.assign(to: &$results)
```

This variant **doesn't return a cancellable at all** — the subscription's lifetime is tied to the `$results` publisher (i.e., to self) with no strong loop, and it cancels itself when the object dies. Alternative: `sink { [weak self] ... }` where you need logic anyway.

**Say this out loud:** *"Retain cycles don't require closures — they require strong references arranged in a loop. `assign(to:on: self)` builds one silently, which is why `assign(to: &$published)` exists. When a Combine object leaks and I see no closures, this is the first API I grep for."*

---

### Drill 2.3 ★ — The search bar that dies after one bad request

```swift
$query
    .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
    .map { text in api.searchClips(matching: text) }   // AnyPublisher<[Clip], URLError>
    .switchToLatest()                                   // Vol. 1 lesson applied ✓
    .replaceError(with: [])                             // "and errors are handled" …?
    .receive(on: DispatchQueue.main)
    .assign(to: &$results)
```

**Prompt:** switchToLatest is there, errors are "handled" — and yet after the first airplane-mode search, the search bar never works again for the rest of the session. No crash. Explain precisely why, then fix it.

**Answer:** **Failure is a terminal event, and it travels.** When one inner search publisher fails, `switchToLatest` forwards the failure downstream — and a Combine failure **terminates the entire subscription**, all the way up to `$query`. `replaceError(with: [])` then does exactly what it says: replaces the error with one final value `[]`… and **completes**. The pipeline is now *finished* — politely, with empty results — and no future keystroke will ever flow through it again. Error "handled," pipeline dead.

The fix is *where* you catch, not *whether*: neutralize the failure **inside** the switched-over publisher, so the outer pipeline only ever sees `Never`-failing inners:

```swift
.map { text in
    api.searchClips(matching: text)
        .replaceError(with: [])          // this request failed; the pipeline lives
        .eraseToAnyPublisher()
}
.switchToLatest()
```

**Senior extension:** `replaceError` erases *what went wrong* — for real UX you want `.catch` mapping to a `Result`/state enum so the UI can show "retry" instead of silently-empty results. And note the async/await contrast out loud: a `do/catch` inside the task loop has no such trap — one of the honest reasons teams migrate reactive pipelines to structured concurrency.

**Say this out loud:** *"In Combine, errors aren't values — they're pipeline death. So error handling is a placement question: catch at the per-request boundary and the stream survives; catch at the end and you've just chosen a graceful funeral."*

---

## Section 3 — Memory, the deep cuts

### Drill 3.1 — The session that won't let go

```swift
final class ClipUploader: NSObject, URLSessionTaskDelegate {
    private lazy var session = URLSession(
        configuration: .background(withIdentifier: "clip-uploads"),
        delegate: self,
        delegateQueue: nil
    )

    func upload(_ fileURL: URL) { session.uploadTask(with: request, fromFile: fileURL).resume() }

    deinit { print("uploader gone") }   // never prints
}
```

**Prompt:** No closures, no timers, no Combine, delegate is `weak` in every pattern you know… yet `ClipUploader` never deallocates. Where's the strong reference?

**Answer:** **`URLSession` strongly retains its delegate** — by documented design, and *unlike* almost every other delegate pattern in the SDK. Rationale: tasks may complete long after you'd otherwise be gone, and the session must be able to deliver those callbacks. So: self → session (via the lazy property) → delegate (self). Cycle, no closure in sight. And the `deinit`-based cleanup instinct is once again unreachable (the Vol. 1 Drill 3.1/3.3 lock pattern, third costume).

The **only** way to break it is explicit invalidation from somewhere that runs:

```swift
func shutdown() {
    session.finishTasksAndInvalidate()   // or invalidateAndCancel() to abort
}
```

After invalidation the session releases the delegate. Call it from the owning screen's teardown / when uploads complete.

**Senior extension:** for a *background* session specifically, the retain is half the story — the session identifier outlives the process, and relaunch delivers events via `application(_:handleEventsForBackgroundURLSession:completionHandler:)`. So a background uploader usually *shouldn't* be a per-screen object at all; it's app-lifetime by nature. Recognizing "this object's lifetime is wrong for its job" beats fixing the leak.

**Say this out loud:** *"URLSession is the exception that proves the delegate rule — it retains its delegate until you invalidate. Any 'no closures but still leaking' hunt, I check for retaining APIs: URLSession delegates, `assign(to:on:)`, scheduled timers, CADisplayLink targets."*

---

### Drill 3.2 — Five hundred thumbnails, one memory cliff

```swift
func regenerateAllThumbnails(for clips: [Clip]) throws {   // maintenance job, 500 clips
    for clip in clips {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: clip.localURL))
        let cgImage = try generator.copyCGImage(at: .zero, actualTime: nil)
        let jpeg = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.8)!
        try jpeg.write(to: clip.thumbnailURL)
        // nothing retained past this line — so memory should be flat, right?
    }
}
```

**Prompt:** Every object here goes out of scope each iteration, yet memory climbs linearly through the loop and the app gets jettisoned around clip #300. ARC releases at end of scope… doesn't it?

**Answer:** ARC does — **autorelease doesn't**. AVFoundation, ImageIO, and UIKit internals are Objective-C underneath, and plenty of their intermediates are *autoreleased*: queued to die "later," when the autorelease pool drains. The main pool drains **per run-loop tick** — and this loop never returns to the run loop. Five hundred iterations of decoded frames and JPEG buffers pile up in a pool that never empties. Scope has nothing to do with it.

```swift
for clip in clips {
    try autoreleasepool {
        // …same body…
    }   // pool drains every iteration; memory stays flat
}
```

**Senior extensions:** (1) This is *still* relevant in 2026 precisely in media/image code paths — pure-Swift code rarely autoreleases, which is why people forget the tool exists. (2) The neighboring fix: `generator.maximumSize = thumbnailPixelSize` so you never decode full 1080p frames just to shrink them. (3) A maintenance job like this belongs off the main thread with a bounded task group — tie back to Vol. 1 Drill 1.5's "don't start all 500 at once."

**Say this out loud:** *"End of scope releases the reference; autorelease releases the object at pool drain — and a tight loop never drains. Any bulk media loop gets an explicit `autoreleasepool` from me by reflex, and Allocations → 'created & persistent' confirms who was hoarding."*

---

### Drill 3.3 ★ — The struct that ships reference semantics

```swift
final class EditTimeline {           // segments, effects, undo stack…
    var segments: [Segment] = []
}

struct ClipDraft {
    var title: String
    let timeline: EditTimeline
}

var original = ClipDraft(title: "v1", timeline: makeTimeline())
var experiment = original            // "safe copy — it's a struct"
experiment.title = "v2 (test)"
experiment.timeline.segments.removeAll()   // try something radical…
```

**Prompt:** The editor's "duplicate draft" feature uses exactly this. Users report that experimenting on the copy destroys the original's edits — but only the edits, never the title. Explain the split-brain, then name what Swift's own types do about it.

**Answer:** `ClipDraft` has **value semantics for `title` and reference semantics for `timeline`.** Copying a struct copies its fields — and the `timeline` field is a *pointer*. Both drafts now share one `EditTimeline` instance; `removeAll()` through either handle mutates the single shared object. The `let` on the field is extra misdirection: it means the *reference* can't be reseated, while the object behind it stays fully mutable. The struct wrapper is wearing value semantics as a costume.

Fixes, in order of increasing sophistication — and the ladder itself is the interview answer:
1. **Make `EditTimeline` a struct** (segments and effects are data; this is likely just right).
2. **Deep-copy at the boundary** — an explicit `duplicate()` that clones the timeline. Works, easy to forget at the *next* call site.
3. **Copy-on-write**, which is what `Array`/`Dictionary`/`String` do: keep the class as storage, check `isKnownUniquelyReferenced(&storage)` before mutating, clone only when shared. Value semantics outside, cheap copies inside.

```swift
struct ClipDraft {
    private var storage: EditTimeline
    var segments: [Segment] {
        get { storage.segments }
        set {
            if !isKnownUniquelyReferenced(&storage) { storage = storage.copy() }
            storage.segments = newValue
        }
    }
}
```

**Say this out loud:** *"A struct is only as value-semantic as its shallowest reference. When I audit a model type I ask: if I copy this and mutate the copy, who else feels it? And `isKnownUniquelyReferenced` is how the standard library makes value semantics affordable — naming it usually ends the question."*

---

## Section 4 — SwiftUI, identity as a weapon

### Drill 4.1 — The layout tweak that resets the video

```swift
struct FeedItemView: View {
    let clip: Clip
    @State private var isExpanded = false   // description show-more state

    var body: some View {
        if clip.isFeatured {
            ClipPlayerView(clip: clip)          // has internal playback @State
                .overlay(FeaturedBadge())
        } else {
            ClipPlayerView(clip: clip)
        }
    }
}
```

**Prompt:** When a clip becomes featured *while playing* (a live promotion), playback restarts from zero and its like-animation state vanishes. "But it's the same `ClipPlayerView` with the same clip!" Explain why SwiftUI disagrees.

**Answer:** **Structural identity.** To SwiftUI, the two branches of that `if` are *different positions in the view tree* — `ConditionalContent<TrueBranch, FalseBranch>`. When `isFeatured` flips, the view in the true-branch slot is **created** and the false-branch one is **destroyed** — even though your eyes see "the same view." All `@State` under the destroyed branch (playback position, animations) is torn down with it; transitions fire as insert/remove, not update.

Fix: **one structural position, parameterized** —

```swift
ClipPlayerView(clip: clip)
    .overlay { if clip.isFeatured { FeaturedBadge() } }   // branch the decoration, not the view
```

Now the player occupies the same identity across the change; only the overlay branches.

**Senior extension:** the inverse tool — sometimes you *want* a reset (new user logs in, force-fresh state) and `.id(user.id)` deliberately assassinates the old identity. Structural identity isn't a gotcha to avoid; it's the state-lifetime control surface. Vol. 1's Drill 4.2 (ForEach IDs) is this same principle expressed through explicit identity.

**Say this out loud:** *"`if/else` in a body isn't a rendering choice, it's an identity boundary — state lives and dies with the branch. My rule: branch modifiers and decorations freely, but branch a stateful view's existence only when I mean its state to reset."*

---

### Drill 4.2 — The detail view stuck on the last clip

```swift
struct ClipDetailView: View {
    let clipID: Clip.ID
    @State private var model = ClipDetailModel()

    var body: some View {
        ClipContent(model: model)
            .task { await model.load(clipID) }
    }
}
```

**Prompt:** From a clip's detail screen, tapping a related clip in "Up Next" pushes… the same screen showing the *old* clip's data (the URL bar of bugs: right route, stale content). Sometimes it's fine. What determines which, and what's the two-character-class fix?

**Answer:** `.task { }` runs **once per view identity, on appearance** — it does *not* re-run because an input property changed. When SwiftUI reuses the same structural identity for the new `clipID` (common in navigation and lazy containers), no new appearance happens: the old task's data stays on screen. When identity *does* change (fresh push), it loads fine — hence "sometimes."

The purpose-built fix:

```swift
.task(id: clipID) { await model.load(clipID) }
```

`task(id:)` treats the id as the task's *identity*: when it changes, SwiftUI **cancels the running task and starts a new one**. Cancellation of the stale load plus restart for the new input — Drill 1.4's switchToLatest pattern, provided as a view modifier.

**Senior extension:** the same class of bug hides in `onAppear`-based loads and in `init`-time fetches. The question to ask of any view: *"which of my inputs, when changed without a new appearance, must restart work?"* — each of those belongs in a `task(id:)` or `onChange(of:)`.

---

### Drill 4.3 ★ — The @State that ignores its parent

```swift
struct RenameSheet: View {
    @State private var draftTitle: String

    init(clip: Clip) {
        _draftTitle = State(initialValue: clip.title)   // seed the text field
    }

    var body: some View {
        TextField("Title", text: $draftTitle)
    }
}
```

**Prompt:** The rename sheet shows the right title the first time. Reopened later for a *different* clip, it shows the previous clip's title. The `init` provably runs with the new clip — you logged it. So how is the old value on screen?

**Answer:** This is the sharpest identity lesson in SwiftUI: **`State(initialValue:)` is honored only when the identity first appears.** The view *struct* is re-initialized constantly — cheap, disposable descriptions (Vol. 1, Section 1 of the refresher) — but the *state storage* lives with the **identity**, outside the struct. On re-init of an existing identity, SwiftUI keeps the existing storage and quietly discards your new "initial" value. Your log proves the init ran; it doesn't prove the State took — those are different systems.

Fixes by intent:
- **"New clip = fresh sheet":** give the sheet a new identity — `RenameSheet(clip: clip).id(clip.id)`, or present with `.sheet(item:)` which does identity-per-item for you. Identity change → state storage rebuilt → seed honored.
- **"Live-sync while open":** `.onChange(of: clip.title) { draftTitle = $1 }` — explicit reconciliation.
- **Step back (often best):** a rename *draft* is arguably the parent's business — pass a `@Binding`, or hand the sheet a small model object, and the seeding problem evaporates.

**Say this out loud:** *"`@State` initial values are a first-appearance-only contract — after that, storage belongs to the identity, not the struct. So when a view seems to ignore new inputs, I don't debug the data flow first; I debug the identity."*

---

## Section 5 — Video & media, editor-grade

### Drill 5.1 — The writer that drops frames politely

```swift
// live recording: sample buffers arriving at 60fps
func handle(_ sampleBuffer: CMSampleBuffer) {
    guard writer.status == .writing else { return }
    videoInput.append(sampleBuffer)          // ⚠️
}
```

**Prompt:** Recording "works," but under load the output video has missing stretches, and occasionally the writer lands in `.failed` with nothing obviously wrong in the code. What contract is being violated?

**Answer:** **`AVAssetWriterInput` has backpressure, and this code ignores it.** You may only append when `isReadyForMoreMediaData` is true; appending while the input's internal queue is full is a contract violation — appends fail (that ignored `Bool` return!) or push the writer into `.failed`/`.unknown` error states. The encoder falls behind under thermal or scene-complexity load; that's exactly when frames arrive fastest and readiness goes false.

The designed-for pattern, live-capture flavor:

```swift
videoInput.expectsMediaDataInRealTime = true   // tells the writer: prioritize keeping up

func handle(_ sampleBuffer: CMSampleBuffer) {
    guard writer.status == .writing else { return }
    if videoInput.isReadyForMoreMediaData {
        if !videoInput.append(sampleBuffer) {          // check the return!
            log(writer.error)                          // writer is now failed — surface it
        }
    } else {
        droppedFrames += 1                             // deliberate drop, measured
    }
}
```

For *offline* transcode (not live), the shape inverts: `requestMediaDataWhenReady(on: queue)` and you pull-supply frames in its callback loop — the writer drives the pace, not the source.

**Say this out loud:** *"Real-time capture means frames are perishable: when the encoder can't keep up, the correct move is dropping frames deliberately and counting them — not queueing (that's Drill 1.6's unbounded-buffer death) and not appending blind (that's a corrupted file). `isReadyForMoreMediaData` is the backpressure signal; honoring it is the whole game."*

---

### Drill 5.2 ★ — The trim that's off by a second

```swift
// clip editor: user drags the trim handle to 00:07.350
func previewFrame(at time: CMTime) {
    player.seek(to: time)                    // preview follows the handle
}
// …and on export:
exportSession.timeRange = CMTimeRange(start: trimStart, duration: trimDuration)
```

**Prompt:** QA: "the preview frame doesn't match where I put the handle — it snaps to a moment up to a second away. And sometimes the exported clip starts *earlier* than my trim." Both symptoms, one underlying cause. Go.

**Answer:** **Keyframes.** Compressed video (H.264/HEVC) is mostly delta frames; you can only start decoding at a keyframe (sync frame), which might be 1–2 seconds apart in gameplay footage.

- **The preview:** `seek(to:)`'s default tolerance is "nearest convenient position" — in practice, near a keyframe, because that's cheap. Frame-accurate seeking is opt-in:
  ```swift
  player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
  ```
  Now AVPlayer decodes from the previous keyframe *forward* to your exact frame — accurate, but expensive. The pro UX pattern: **tolerant seeks while the finger is scrubbing** (fast, keyframe-snapped is fine mid-drag), **zero-tolerance seek on release** (the frame they'll actually judge).

- **The export:** with a **passthrough preset** (no re-encode), the writer can't split a GOP mid-stream — it must cut at keyframe boundaries, so the start snaps outward and the clip begins early. Frame-accurate trims require **re-encoding** (a quality/speed/battery trade), or the hybrid trick: re-encode only the head GOP and passthrough the rest.

**Say this out loud:** *"Trim accuracy is a product decision wearing a codec costume: tolerance-zero seeks and re-encode give you frame-perfect at a cost; passthrough is instant but snaps to keyframes. For a clips app I'd do tolerant-while-scrubbing, exact-on-release, and be explicit with users or with the encoder about the export trade."*

---

### Drill 5.3 ★ — The app that silences everyone's Spotify

```swift
// app startup:
try? AVAudioSession.sharedInstance().setCategory(.playback)
try? AVAudioSession.sharedInstance().setActive(true)

// feed cells autoplay muted, tap for sound. Users report:
// 1) "Opening the app kills my music — even though your videos start MUTED."
// 2) "After a phone call, videos never play sound again until I force-quit."
```

**Prompt:** Both complaints trace to audio-session handling. Diagnose each.

**Answer:**
1. **Category `.playback` is non-mixable by default** — activating the session interrupts other audio, full stop. Being *muted* is irrelevant: muting your player doesn't tell the *session* anything; the interruption happened at activation. For a muted-autoplay feed the right posture is `.ambient` (or `.playback` with `.mixWithOthers`) — the user's music keeps playing over your silent videos. Then, when they tap for sound, *that's* the moment to switch to non-mixable `.playback` and take the audio focus. Session category should follow **user intent**, not app launch.

2. **Nobody's listening for interruptions.** A phone call fires `AVAudioSession.interruptionNotification` with `.began`; when it ends, you get `.ended` — with an options flag `.shouldResume` telling you whether resuming is appropriate. Miss this, and the session stays deactivated: players sit at `rate == 0`, muted-looking, "broken until force-quit." The handler is boilerplate-shaped but product-critical: on `.began` pause and update UI; on `.ended` + `.shouldResume`, reactivate the session and resume.

**Senior extension:** the third leg is route changes (`routeChangeNotification`) — headphones yanked mid-clip should pause, per platform convention. Audio session work is invisible when right and 1-star reviews when wrong.

**Say this out loud:** *"Audio on iOS is a shared resource negotiated through the session, and my player is only a tenant. Category = my declared intent, mixability = my manners, interruption/route handlers = my recovery. For a clips feed: ambient while muted, claim focus on unmute."*

---

### Drill 5.4 — Design discussion: the upload pipeline that survives everything

**Prompt (reason-with-me, their actual domain):** *"A user records a 3-minute clip on the subway, backgrounds the app, loses signal twice, and the app gets jetsammed somewhere in there. Design the upload pipeline so the clip still arrives — exactly once."* 

**The shape of a strong answer:**

1. **A persistent queue, not an in-memory one.** Each upload is a durable record (SQLite/file): file URL, bytes sent, state machine (`queued → uploading → verifying → done/failed`), retry count, idempotency key. Process death loses nothing but progress since the last checkpoint.
2. **Background `URLSession` as the transport.** Upload tasks from *file URLs* (Vol. 1, Drill 5.1) in a background configuration survive suspension and even app termination — the system daemon keeps transferring. On relaunch, `handleEventsForBackgroundURLSession` reconnects you to the session; you *rebuild state from the queue + session's task list*, never from memory.
3. **Chunked + resumable for the signal drops.** Split the file (or use a resumable protocol); each chunk PUT is idempotent with a content range; on reconnect, ask the server which chunks it has and send the diff. Retries use exponential backoff + jitter, gated on `NWPathMonitor` (don't burn retries in a tunnel).
4. **Exactly-once at the *server*, at-least-once at the client.** The client's job is to retry freely; the **idempotency key** (client-generated clip UUID) is what makes retries safe — the server dedupes assembly and returns the same final clip ID. (Vol. 1, Drill 6.3's lesson, scaled up to files.)
5. **Finalize with verification.** After the last chunk: a commit call comparing checksums; only then does the queue record hit `done` and the local temp file become deletable. Crash between "server has it" and "client knows" → the commit call is itself idempotent, so re-running is safe.
6. **Product layer:** visible per-clip progress driven from the queue, Wi-Fi-only policy option (gameplay files are big), and a "your clip will upload when you're back online" state instead of an error.

**Say this out loud:** *"The design rule: the network layer is allowed to be stupid and retry-happy because the queue is durable and the protocol is idempotent. Every crash window has an answer because state lives in exactly two places — the client's durable queue and the server — and both are re-queryable."*

---

## Section 6 — Data & real-time, the long tail

### Drill 6.1 ★ — The server release that blanked every old client

```swift
enum ClipKind: String, Decodable {
    case gameplay, montage, story
}

struct Clip: Decodable {
    let id: String
    let kind: ClipKind
    // …
}

// feed loading:
let clips = try JSONDecoder().decode([Clip].self, from: data)
```

**Prompt:** Backend ships a new content type, `"livestream"`. Within minutes, support fills with reports — but only from users on *older* app versions, and the symptom isn't one weird cell: it's a **completely empty feed**. Explain the blast radius, then make the model shrapnel-proof.

**Answer:** Two compounding failures:

1. **The enum is closed.** `ClipKind("livestream")` has no case → `DecodingError.dataCorrupted`. One unknown string kills the decode of that clip.
2. **The array decode is all-or-nothing.** `decode([Clip].self)` throws if *any element* throws — one livestream clip in a page of 50 nukes all 50. Hence "empty feed," not "one missing clip."

Shrapnel-proofing, both layers:

```swift
enum ClipKind: String {
    case gameplay, montage, story
    case unknown                                   // the escape hatch
}
extension ClipKind: Decodable {
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ClipKind(rawValue: raw) ?? .unknown  // forward-compatible
    }
}
```

…and decode the collection lossily, so a genuinely corrupt element drops alone:

```swift
struct LossyArray<T: Decodable>: Decodable {
    let elements: [T]
    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var result: [T] = []
        while !container.isAtEnd {
            if let value = try? container.decode(T.self) { result.append(value) }
            else { _ = try? container.decode(AnyDecodableSink.self) }  // consume + skip the bad one
        }
        elements = result
    }
}
private struct AnyDecodableSink: Decodable {
    init(from decoder: Decoder) throws {}   // touches nothing, accepts anything —
}                                            // a synthesized empty struct would THROW on
                                             // scalar elements and never consume the slot
```

The UI then decides what `.unknown` renders as — a graceful "update to view this content" cell, or nothing (counted in analytics either way, so you *know* it's happening).

**Say this out loud:** *"Mobile clients live in the field for years, so I treat the API as a moving target by default: open enums with an `.unknown` case, lossy collection decoding, and telemetry on both — the schema WILL grow, and the failure mode must be 'one unfamiliar cell,' never 'blank feed.'"*

---

### Drill 6.2 — A thousand messages, sixty frames

```swift
// live chat on a popular clip: message bursts of 500–1000/sec during a raid
socket.onMessage { [weak self] message in
    DispatchQueue.main.async {
        self?.messages.append(message)     // @Published var messages: [ChatMessage]
    }
}
```

**Prompt:** Under a burst, the UI freezes for seconds, then "catches up" in a lurch. Memory's fine, no leak, the parsing is off-main already. What's actually saturating, and what's the fix pattern?

**Answer:** **The main thread is being paid per message, not per frame.** Each append dispatches a main-queue block, mutates a `@Published` array (→ `objectWillChange` → view diff per message). At 1000/sec you're asking the main run loop to do a thousand invalidation cycles a second when the screen can only show ~60–120. The queue backs up — that's the freeze — then drains all at once — the lurch.

Fix pattern: **coalesce to display cadence.** Ingest off-main into a buffer; flush to UI state at a fixed tick:

```swift
private var pending: [ChatMessage] = []          // guarded by the ingest queue/actor

// ingest (off-main): pending.append(message)

// flush ~10–15 times/sec:
flushTimer = Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak self] _ in
    guard let self, !self.pending.isEmpty else { return }
    let batch = self.drainPending()
    self.messages.append(contentsOf: batch)      // ONE mutation, one diff, per tick
}
```

**Senior extensions:** cap the visible transcript (chat UIs window to the last few hundred messages; the raid doesn't need infinite scrollback in RAM); under extreme bursts degrade honestly ("2,113 new messages" pill) — which is a *product* answer, the kind Medal's JD is fishing for. Note the family resemblance: this is Drill 1.5's chunky-not-chatty, applied to the main actor.

**Say this out loud:** *"UI state should update at UI cadence. Anything that can outpace the display — sockets, sensors, capture — gets a buffer and a flush tick between it and the main actor, so cost scales with frames, not events."*

---

### Drill 6.3 — The messages that arrive before they were sent

```swift
// merging fresh WebSocket messages with REST backfill after a reconnect:
allMessages = (backfill + liveBuffer)
    .sorted { $0.sentAt < $1.sentAt }     // sentAt: Date, stamped by the SENDER's device
```

**Prompt:** Users occasionally see replies appear *above* the message they reply to, and one user's messages consistently sort into the past. No timezone code in sight. What's the flaw, and what's the ordering that can't lie?

**Answer:** **Client clocks are fiction.** `sentAt` is stamped by each sender's device, and device clocks skew — seconds routinely, minutes for users with auto-time off, and any clock can jump mid-session. Sorting a multi-party conversation by sender-stamped time interleaves everyone's fiction: the "consistently in the past" user just has a slow clock. Timezones are a red herring — `Date` is absolute; *the clocks themselves* are wrong.

The fix: **order by the server's authority, not the client's claim.** The server assigns a monotonic per-conversation sequence number (or its own receive timestamp) as it accepts each message; clients sort by that, exclusively. Client time is display-only garnish ("sent 14:02" is fine to be a little wrong; *order* is not). Local echo of your own unsent message sits at the optimistic tail until the server ack assigns its true sequence (Vol. 1, Drill 6.1's dedup/ack machinery finishing the job).

**Say this out loud:** *"Rule: clients may not vote on time. Any cross-device ordering — chat, comments, edit history — comes from a server-issued sequence; device clocks are for wall-clock display only. The moment I see `sorted(by: $0.clientDate)` across users, I know a bug report is already in flight."*

---

## Section 7 — Rapid-fire minis, boss edition (~10 minutes)

**7.1 —**
```swift
protocol Renderer {}
extension Renderer { func render() -> String { "software" } }
struct MetalRenderer: Renderer { func render() -> String { "metal" } }

let r: Renderer = MetalRenderer()
print(r.render())
```
**"software."** `render()` is *not a protocol requirement* — it exists only in the extension, so calls through the protocol type dispatch **statically** to the extension. Declare `func render() -> String` *inside* the protocol and the same code prints "metal" (dynamic dispatch via the witness table). One-line customization-point lesson; interviewers adore it.

**7.2 —**
```swift
let family = "👨‍👩‍👧‍👦"
print(family.count)           // ?
print(family.utf16.count)     // ?
```
**1, then 11.** `count` counts grapheme clusters (what a human calls "a character"); the family emoji is four scalars joined by zero-width joiners. This is *why* `String` has no integer subscripting — and why truncating usernames/messages by UTF-16 length (what many backends count) can slice an emoji in half. Say "extended grapheme cluster" and move on like it's nothing.

**7.3 —**
```swift
let a: Int8 = 127
let b = a + 1        // ?
let c = a &+ 1       // ?
```
**`a + 1` crashes — deliberately.** Swift traps on overflow instead of silently wrapping (a lesson learned from C). `&+` is the explicit wrapping operator: `c == -128`. Overflow as a *loud* failure is a safety feature; `&+` is you signing a waiver.

**7.4 —**
```swift
print(0.1 + 0.2 == 0.3)
```
**false.** Binary floating point can't represent these decimals exactly; the sum is 0.30000000000000004. Compare with tolerance (`abs(x - y) < .ulpOfOne`-scale epsilon) — and in a video editor, don't accumulate `Double` seconds at all: this is *why* Core Media time is rational (`CMTime` = value/timescale), a beautiful full-circle point at Medal.

**7.5 —**
```swift
let tags = ["fps": 12, "clutch": 8, "ace": 5]
for (name, _) in tags { print(name) }   // stable output?
```
**No — dictionary order is unspecified and varies between runs** (hashing is seeded per-process, partly as a defense measure). Any UI that happens to look ordered in the simulator will shuffle in prod. Feed sections, tag chips: sort explicitly, always.

**7.6 —**
```swift
let sizes = clips.map { expensiveSize($0) }.first      // A
let size  = clips.lazy.map { expensiveSize($0) }.first // B
```
**A computes `expensiveSize` for every clip, then takes one; B computes it once.** `.lazy` fuses the pipeline so elements are produced on demand. Free win for "first match in a big collection" chains — and worth knowing the flip side: a `lazy` sequence recomputes on every traversal, so materialize (`Array(...)`) if you'll iterate twice.

---

## Appendix A — The boss-round discussion question: "How would you migrate our app to Swift 6 strict concurrency?"

They're mid-migration or dreading it — every team is. A structured answer, since you've been reasoning about isolation all through both volumes:

1. **Turn the dial, not the switch.** Enable `StrictConcurrency` as *warnings* per-module (`SWIFT_STRICT_CONCURRENCY = complete`) while staying in Swift 5 language mode — inventory before surgery. Migrate module-by-module, leaf frameworks first, app target last.
2. **Give the UI layer a home.** Most warnings dissolve by annotating what was always true: view models, UI-facing services → `@MainActor`. Big win, low risk.
3. **Sort the rest into three buckets:** shared mutable state → **actor** (with chunky APIs — Drill 1.5); passive data crossing boundaries → make it `Sendable` (value types get it nearly free — and Drill 3.3's struct-wrapping-a-class is exactly what *fails* here, a satisfying connection); third-party/legacy imports → `@preconcurrency import` as a scoped, documented IOU.
4. **Treat every silencing annotation as debt with a ticket** — `@unchecked Sendable` is a promise the compiler can't check; each one gets a comment saying *why* it's actually safe.
5. **The payoff argument:** the drills in Section 1 of both volumes are bugs the strict checker catches *at compile time* — the migration converts a class of production races into build errors. That's the sentence that ends the discussion well.

---

## Appendix B — Self-test protocol (do this once before the interview)

Simulate the round. Pick **five drills you haven't reread** (mix: two concurrency, one memory, one video, one wildcard). Set a 25-minute timer. For each:

1. Read the code once, then narrate your reasoning **out loud, without notes** — phone voice-memo running. Awkward is the point; the interview is out loud too.
2. Land the three beats per drill: *mechanism* ("this races because…"), *minimal fix*, *how I'd catch it in the wild*.
3. Play back the recording at 1.5×. Listen for: silence (rehearse a stalling line from Vol. 1 Appendix A), hedging ("maybe, sort of"), or missing the mechanism (you named the symptom, not the cause).

Score 4/5 with clean mechanisms and you're genuinely ready. Score lower: reread only the sections you missed, and re-test with five fresh drills tomorrow.

---

*Vol. 1 made you fast on the bugs everyone should catch. This volume makes you the candidate who says "that's a unicast stream being used as a broadcast" and "client clocks may not vote on ordering" — sentences that end interviews early, in the good way. Same instruction as before: out loud, mechanism-first. Go.*
