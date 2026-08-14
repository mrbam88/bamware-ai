# Medal / General Intuition — Code-Reasoning Drills
**Bilal Malik · Senior iOS Engineer · 60–90 min technical deep dive with 2 engineers · this week**

This round is three things: your technical experience, your questions for them, and **code-reasoning exercises**. This doc is built for the third part, with a tight appendix for the other two. It pairs with your `swiftui-combine-refresher` doc — that one rebuilds live-coding fingers; this one rebuilds the *"read this code, tell me what's wrong"* muscle, tuned to Medal's domain: video, real-time, feeds, social.

**How to use it (interview is this week):**
- Do the **★ priority track** first (10 drills, ~2 hours): 1.1, 1.2, 1.3, 2.1, 2.3, 3.1, 4.1, 5.1, 5.2, 6.2. That covers the highest-probability territory: Swift Concurrency, Combine, memory, and video.
- Cover the code with your hand, reason **out loud** before reading the answer. The narration is the skill being tested.
- Second pass: everything else, plus the rapid-fire minis the morning of.
- Keep Appendix A (the routine) open during the interview.

---

## Before anything else: the 5-step routine for ANY code-reasoning prompt

1. **Read it aloud, slowly.** State what the code is *trying* to do in one sentence. ("This is a debounced search pipeline that assigns results to a published property.")
2. **Trace the types and lifetimes.** Who owns what? What's a value vs reference? What outlives what? Where are the suspension points / thread hops?
3. **Name the bug precisely.** Not "this looks wrong" — "this races because two child tasks mutate shared state," or "this leaks because the closure captures self strongly and self owns the subscription."
4. **Fix it minimally, then harden.** Give the one-line fix first, *then* the senior version ("and in production I'd also…").
5. **Say how you'd catch it.** Instruments/Memory Graph for leaks, Thread Sanitizer / Swift 6 strict concurrency for races, a failing test for logic. This step is what separates senior from mid.

Silence is the only way to fail this round. Narrate everything, even dead ends: "First instinct is X… no, wait, that's fine because Y — the real issue is Z."

---

## Section 1 — Swift Concurrency (the JD names it; highest priority)

### Drill 1.1 ★ — The task that outlives the screen

```swift
struct ClipFeedView: View {
    @State private var model = FeedModel()

    var body: some View {
        List(model.clips) { clip in
            ClipRow(clip: clip)
        }
        .onAppear {
            Task { await model.startLiveUpdates() }  // polls the feed every few seconds, forever
        }
    }
}
```

**Prompt:** The user opens this feed, then swipes back. What happens? Fix it.

**Answer:** The polling loop **keeps running after the screen is gone**. `Task { }` in `onAppear` creates an unstructured task tied to nothing — nobody cancels it, and it keeps the model alive while it loops. Open the feed five times, you have five polling loops.

Fix: use the `.task` modifier instead — it ties the task to the view's lifetime and **auto-cancels on disappear**:

```swift
.task { await model.startLiveUpdates() }
```

Then make the loop *cooperate* with cancellation, because Swift cancellation is cooperative, not preemptive:

```swift
func startLiveUpdates() async {
    while !Task.isCancelled {
        await refresh()
        try? await Task.sleep(for: .seconds(5))  // sleep throws immediately on cancel
    }
}
```

**Say this out loud:** *"Cancellation in Swift is cooperative — `.task` sends the cancel signal on disappear, but my loop still has to check for it. `Task.sleep` helps because it throws the moment the task is cancelled instead of finishing the nap."*

---

### Drill 1.2 ★ — The actor that fetches twice

```swift
actor ThumbnailCache {
    private var cache: [URL: UIImage] = [:]

    func thumbnail(for url: URL) async throws -> UIImage {
        if let cached = cache[url] { return cached }
        let image = try await downloader.fetch(url)   // slow network call
        cache[url] = image
        return image
    }
}
```

**Prompt:** Two feed cells request the same thumbnail at nearly the same time. The actor protects `cache`, so what could possibly go wrong?

**Answer:** **Actor reentrancy.** Actors protect state from *data races*, not from *interleaving at suspension points*. Caller A misses the cache and suspends at `await downloader.fetch`. While A is suspended, the actor is free to run caller B — who *also* misses the cache and starts a second identical download. No corruption, but duplicated work; on a feed, the same thumbnail can download dozens of times.

Fix: cache the **in-flight task**, not just the result — the check and the "claim" then happen with no suspension between them:

```swift
actor ThumbnailCache {
    private var tasks: [URL: Task<UIImage, Error>] = [:]

    func thumbnail(for url: URL) async throws -> UIImage {
        if let existing = tasks[url] { return try await existing.value }
        let task = Task { try await downloader.fetch(url) }
        tasks[url] = task
        return try await task.value
    }
}
```

**Senior extension:** on failure, remove the failed task from the dictionary so the URL can retry, and cap the cache (NSCache or LRU eviction) because feed scrolling is unbounded.

**Say this out loud:** *"The actor guarantees my state is race-free, but every `await` inside it is a reentrancy point — I always re-validate assumptions after a suspension, or design so there's nothing to re-validate."*

---

### Drill 1.3 ★ — The upload counter that lies

```swift
final class UploadManager {
    var completedCount = 0

    func uploadAll(_ clips: [Clip]) async {
        await withTaskGroup(of: Void.self) { group in
            for clip in clips {
                group.addTask {
                    try? await self.upload(clip)
                    self.completedCount += 1        // update progress
                }
            }
        }
    }
}
```

**Prompt:** What's wrong, and why won't this compile under Swift 6 strict concurrency?

**Answer:** **Data race.** Multiple child tasks run concurrently on different threads and all mutate `completedCount` — a classic read-modify-write race, so the final count can be short. Swift 6 rejects it at compile time: `UploadManager` isn't `Sendable`, and the child task closures capture and mutate its state across concurrency domains.

Cleanest fix — mutate only at the **single collection point**, in the parent:

```swift
func uploadAll(_ clips: [Clip]) async {
    await withTaskGroup(of: Bool.self) { group in
        for clip in clips {
            group.addTask { (try? await self.upload(clip)) != nil }
        }
        for await success in group where success {
            completedCount += 1     // one isolation context, no race
        }
    }
}
```

Alternatives worth naming: make `UploadManager` an `actor`, or `@MainActor` if the count drives UI.

**Say this out loud:** *"My default pattern with task groups is: children return values, the parent loop aggregates. All mutation happens in one isolation context — which is also exactly what Swift 6's strict checking pushes you toward."*

---

### Drill 1.4 — Three awaits, one slow screen

```swift
func loadHomeScreen() async throws -> HomeData {
    let clips   = try await api.fetchClips()      // ~400ms
    let stories = try await api.fetchStories()    // ~300ms
    let profile = try await api.fetchProfile()    // ~200ms
    return HomeData(clips: clips, stories: stories, profile: profile)
}
```

**Prompt:** This code is correct. Why is it still wrong, and what's the fix?

**Answer:** The three fetches are independent but run **sequentially** — ~900ms of stacked latency for what should cost ~400ms. `await` in a row is a serial chain.

```swift
async let clips   = api.fetchClips()
async let stories = api.fetchStories()
async let profile = api.fetchProfile()
return try await HomeData(clips: clips, stories: stories, profile: profile)
```

All three start immediately and run concurrently; total time is the slowest call.

**Senior extension:** if one throws, the structured scope **cancels the siblings automatically** on exit — that's the quiet win of structured concurrency. For a *dynamic* number of calls, this becomes a task group. And on a home screen, consider whether you want all-or-nothing at all — maybe clips should render while profile trickles in.

---

### Drill 1.5 — One bad clip kills the batch

```swift
func uploadBatch(_ clips: [Clip]) async throws -> [UploadReceipt] {
    var receipts: [UploadReceipt] = []
    try await withThrowingTaskGroup(of: UploadReceipt.self) { group in
        for clip in clips {
            group.addTask { try await self.upload(clip) }
        }
        for try await receipt in group {
            receipts.append(receipt)
        }
    }
    return receipts
}
```

**Prompt:** The user selects 20 clips; clip #7 fails with a network blip. What does the user get?

**Answer:** **Nothing.** The error propagates out of `for try await`, the group scope exits by throwing, and structured concurrency **cancels all remaining children**. Nineteen good uploads die because one failed. Whether that's a bug depends on product intent — and *saying that* is the senior move. For a batch upload you almost certainly want per-item outcomes:

```swift
try await withThrowingTaskGroup(of: Result<UploadReceipt, Error>.self) { group in
    for clip in clips {
        group.addTask {
            do    { return .success(try await self.upload(clip)) }
            catch { return .failure(error) }
        }
    }
    // collect results; retry or surface failures individually
}
```

**Senior extensions:** (1) Don't start 20 at once — seed the group with ~3 and add the next clip each time one finishes, so you don't saturate the uplink. (2) Real uploads at Medal should survive backgrounding → background `URLSession` upload tasks from file URLs, not in-process tasks.

---

### Drill 1.6 — 60fps into an unbounded buffer

```swift
func videoFrames() -> AsyncStream<CMSampleBuffer> {
    AsyncStream { continuation in
        recorder.startCapture { sampleBuffer, type, error in
            if type == .video {
                continuation.yield(sampleBuffer)
            }
        }
        continuation.onTermination = { _ in
            recorder.stopCapture()
        }
    }
}
```

**Prompt:** This bridges a callback-based recorder into async/await. It works in the demo, then memory climbs and the app dies mid-recording. Why?

**Answer:** `AsyncStream`'s default buffering policy is **`.unbounded`**. The recorder yields 60 frames a second; if the consumer (encoder, uploader, effects pipeline) runs even slightly slower, every unconsumed `CMSampleBuffer` — big, pixel-buffer-backed objects — queues up in the stream. Memory grows until jetsam kills the app.

Fix: pick a policy that matches real-time semantics — for live video you want the *newest* data, not a complete history:

```swift
AsyncStream(bufferingPolicy: .bufferingNewest(2)) { continuation in ... }
```

Old frames get dropped instead of hoarded. For frames you *must* keep (writing to disk), the answer isn't a bigger buffer — it's applying backpressure or handing frames straight to `AVAssetWriter` and letting it manage the queue.

**Say this out loud:** *"Bridging delegates to AsyncStream is my go-to, but the buffering policy is the design decision: real-time consumers want `bufferingNewest`, completeness consumers need genuine backpressure. Unbounded is almost never right for media."*

---

## Section 2 — Combine (the JD names it too)

### Drill 2.1 ★ — The search results that arrive from the past

```swift
$query
    .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
    .removeDuplicates()
    .flatMap { text in
        api.searchClips(matching: text)     // returns AnyPublisher<[Clip], Never>
    }
    .receive(on: DispatchQueue.main)
    .assign(to: &$results)
```

**Prompt:** Debounce is there, duplicates removed — yet users sometimes type "fortnite", see the right results flash, then watch them get replaced by results for "fortn". What's the bug?

**Answer:** **`flatMap` never cancels.** It subscribes to *every* inner publisher and merges all their output — so the slow request for "fortn" is still in flight when "fortnite" completes, and when it finally lands, it overwrites newer results. Classic stale-response race.

Fix: switch, don't merge —

```swift
.map { text in api.searchClips(matching: text) }
.switchToLatest()
```

`switchToLatest` **cancels the previous inner publisher** the moment a new one arrives. Exactly the semantics typeahead wants.

**Senior extension:** in async/await land the same idea is "store the current search `Task`, cancel it before starting a new one." Same race, same cure, different dialect — naming both shows you're bilingual (and Medal's codebase will have both).

---

### Drill 2.2 — The pipeline that never fires

```swift
final class FeedBinder {
    func bind(model: FeedModel) {
        model.$clips
            .receive(on: DispatchQueue.main)
            .sink { [weak self] clips in
                self?.render(clips)
            }
    }
}
```

**Prompt:** No crash, no warning in the logs, `render` just never runs. Why?

**Answer:** The `AnyCancellable` returned by `sink` is **discarded**, so the subscription is cancelled the instant `bind` returns. A Combine subscription lives exactly as long as its cancellable. This is the #1 "why is my Combine dead" bug (and the compiler does warn about the unused result — a warning someone silenced).

```swift
private var cancellables = Set<AnyCancellable>()

model.$clips
    .receive(on: DispatchQueue.main)
    .sink { [weak self] clips in self?.render(clips) }
    .store(in: &cancellables)
```

**Say this out loud:** *"Subscription lifetime is ownership: whoever should keep the pipeline alive owns the cancellable, and tearing down the owner tears down the pipeline. That's also why I like `store(in:)` on the object rather than global sets — lifetime tracks the screen."*

---

### Drill 2.3 ★ — The player that ticks forever

```swift
final class PlayerViewModel: ObservableObject {
    @Published var progress: Double = 0
    private var cancellables = Set<AnyCancellable>()

    func startProgressUpdates() {
        Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { _ in
                self.progress = self.player.currentProgress   // ⚠️
            }
            .store(in: &cancellables)
    }
}
```

**Prompt:** User closes the player. Instruments shows `PlayerViewModel` still alive and the timer still firing. Walk through the retain cycle.

**Answer:** The `sink` closure captures `self` **strongly**. The chain: `self` → `cancellables` → subscription → closure → `self`. Nobody's refcount ever hits zero, so `deinit` never runs — which also means "I'll cancel in `deinit`" can't save you; deinit is *unreachable*. The timer fires into a zombie view model forever.

```swift
.sink { [weak self] _ in
    guard let self else { return }
    self.progress = self.player.currentProgress
}
```

Now dismissing the player releases the VM, `cancellables` deallocates, the subscription cancels, the timer stops. One capture list, whole lifecycle fixed.

**How you'd catch it:** Memory Graph Debugger (the cycle is visible as self → cancellable → closure → self), or a `deinit { print(...) }` breadcrumb while developing.

---

### Drill 2.4 — One publisher, two network calls

```swift
let clipDetails = URLSession.shared.dataTaskPublisher(for: url)
    .map(\.data)
    .decode(type: ClipDetails.self, decoder: JSONDecoder())

clipDetails.sink { ... } .store(in: &cancellables)   // drives the player UI
clipDetails.sink { ... } .store(in: &cancellables)   // drives the comments pane
```

**Prompt:** The backend team asks why every clip-open hits this endpoint twice. Explain, and fix without restructuring the two subscribers.

**Answer:** `dataTaskPublisher` is a **cold** publisher — every new subscriber re-executes the work, so two `sink`s = two HTTP requests. Fix: share one upstream subscription:

```swift
let clipDetails = URLSession.shared.dataTaskPublisher(for: url)
    .map(\.data)
    .decode(type: ClipDetails.self, decoder: JSONDecoder())
    .share()
```

**Senior extension:** `share()` doesn't replay — a late subscriber that attaches after the value fired gets nothing. If the comments pane subscribes late, you want `shareReplay`-style behavior (`multicast` + `CurrentValueSubject`, or just model it as `@Published` state fed by one pipeline). Knowing *that* boundary is the difference between using `share()` and understanding it.

---

## Section 3 — Memory & ARC

### Drill 3.1 ★ — The classic timer leak (UIKit flavor, because the JD lists UIKit first)

```swift
final class ClipPlayerViewController: UIViewController {
    private var progressTimer: Timer?

    override func viewDidLoad() {
        super.viewDidLoad()
        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            self.updateProgressBar()
        }
    }

    deinit {
        progressTimer?.invalidate()
    }
}
```

**Prompt:** "We invalidate in deinit, so we're fine." Are they?

**Answer:** No — and the reasoning chain is the interview answer. The repeating timer's block captures `self` strongly; the **run loop retains a scheduled timer** until it's invalidated. So: run loop → timer → block → `self`. The VC can never deallocate, therefore **`deinit` never runs, therefore `invalidate()` never runs**. The cleanup is parked behind a door that the leak itself locked.

Two independent fixes; do the first, mention the second:

```swift
progressTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
    self?.updateProgressBar()
}
```

…and/or invalidate somewhere that *actually runs*, like `viewDidDisappear`. Modern alternative worth naming: drive progress from `AVPlayer.addPeriodicTimeObserver` (remember to remove it) or a `.task` loop that auto-cancels.

**Say this out loud:** *"Any cleanup scheduled in `deinit` is worthless if the resource itself is what's keeping the object alive. I check: who retains whom, and is my teardown reachable?"*

---

### Drill 3.2 — `unowned` on a network boundary

```swift
final class ProfileViewController: UIViewController {
    func loadProfile() {
        api.fetchProfile(userID: userID) { [unowned self] profile in
            self.render(profile)
        }
    }
}
```

**Prompt:** QA reports a rare crash: open a profile on bad hotel Wi-Fi, immediately tap back. Where's the crash and what's the rule?

**Answer:** The request outlives the screen. When the slow response finally arrives, the completion runs with an `unowned self` whose object is **gone** → deterministic crash. `unowned` is a *promise* that self outlives the closure; an async network completion is exactly where that promise breaks.

```swift
api.fetchProfile(userID: userID) { [weak self] profile in
    guard let self else { return }   // screen's gone — drop the result
    self.render(profile)
}
```

**The rule:** `weak` + `guard` across any boundary where lifetime is uncertain (network, timers, notifications, anything escaping-async). Reserve `unowned` for provably-tied lifetimes (a closure stored *by* self, never escaping it). If you have to think twice, it's `weak`.

**Senior extension:** better still, cancel the request when the screen goes away — not receiving stale results beats discarding them. That's `URLSessionTask.cancel()` in this dialect, or free with structured concurrency's `.task`.

---

### Drill 3.3 — The immortal recorder

```swift
@Observable
final class RecordingModel {
    init() {
        Task {
            for await event in recorder.events {   // AsyncStream that never finishes
                self.handle(event)
            }
        }
    }
}
```

**Prompt:** No timer, no Combine, no delegates. Yet this object never deallocates. Why, and what's the shape of the fix?

**Answer:** The `Task` closure captures `self` strongly, and the task **never completes** — it's iterating an infinite stream. A task retains its captures until it finishes or is cancelled, so `self` is kept alive by a task nobody can reach. Same disease as 3.1 in async clothing: can't cancel in `deinit`, because `deinit` is unreachable.

Fix shape — break the strong capture *and* create an explicit off-switch:

```swift
private var eventTask: Task<Void, Never>?

init() {
    eventTask = Task { [weak self] in
        guard let events = self?.recorder.events else { return }
        for await event in events {
            guard let self else { return }   // re-check each iteration
            self.handle(event)
        }
    }
}

func stop() { eventTask?.cancel() }   // call from the owning screen's teardown
```

**Say this out loud:** *"Long-lived tasks are the new retain cycles. My checklist for any `Task` in an init: does it end? If not, who cancels it, and does it capture self weakly so the cancel point is reachable?"*

---

## Section 4 — SwiftUI reasoning

### Drill 4.1 ★ — The video that restarts when someone likes it

```swift
struct ClipCell: View {
    let clip: Clip
    @ObservedObject var player = PlayerModel()   // ⚠️

    var body: some View {
        VideoSurface(player: player)
            .onAppear { player.play(clip.streamURL) }
    }
}
```

**Prompt:** Users report feed videos stuttering back to 0:00 whenever *anything* on screen updates — a like count ticking, a comment badge. What's happening?

**Answer:** `@ObservedObject` does **not own** its object — and here it's handed a brand-new `PlayerModel()` as a default value. Every time the parent re-renders (any state change up the tree), SwiftUI re-initializes `ClipCell`, the inline initializer runs again, and playback state is torn down with it. The video restarts because the *player object's lifetime is tied to render frequency*.

Fixes, in order of preference for a feed:
1. **Own it properly** — `@StateObject var player = PlayerModel()` (or modern: `@State var player = PlayerModel()` with `@Observable`). SwiftUI creates it once per cell identity and keeps it across re-renders.
2. **For a real clip feed:** don't let cells own players at all — inject from a shared player pool keyed by clip ID (see Drill 5.2), so scrolling reuses a handful of expensive players instead of allocating per cell.

**Say this out loud:** *"`@StateObject`/`@State` is ownership, `@ObservedObject`/plain property is a reference to someone else's object. Inline-initializing an `@ObservedObject` is the canonical bug — it resets on every render. And player objects are so expensive I'd hoist them out of the view tree entirely."*

---

### Drill 4.2 — The like that jumps to the wrong clip

```swift
struct FeedView: View {
    let clips: [Clip]   // Clip is Hashable

    var body: some View {
        ScrollView {
            LazyVStack {
                ForEach(clips, id: \.self) { clip in
                    ClipCell(clip: clip)
                }
            }
        }
    }
}
```

**Prompt:** After pull-to-refresh, some cells animate weirdly and one user's "liked" heart appears on a different clip. Connect that to this code.

**Answer:** `id: \.self` makes the **entire value the identity**. Two problems: (1) if any field changes on refresh — view count ticks up, like count changes — the *same clip* hashes differently, so SwiftUI sees "old clip deleted, new clip inserted" → teardown, re-insert, broken animations, lost cell state; (2) if two clips ever compare equal, identities collide and per-cell state (`@State` in `ClipCell`, like the heart animation) attaches to the wrong row.

Fix: stable, server-issued identity —

```swift
ForEach(clips) { clip in ... }   // Clip: Identifiable, id = server clipID
```

Now a refreshed clip with a new view count is *the same row updating*, not a delete+insert.

**Say this out loud:** *"Identity is the contract that lets SwiftUI diff. I give it the server's ID — stable across refreshes, unique across the set. `\.self` couples identity to content, and content changes."*

---

### Drill 4.3 — The body that does work

```swift
struct ClipRow: View {
    let clip: Clip

    var body: some View {
        let formatter = RelativeDateTimeFormatter()          // ⚠️ allocated every render
        let duration = clip.frames.reduce(0) { $0 + $1.dt }  // ⚠️ O(n) every render

        return HStack {
            Text(clip.title)
            Spacer()
            Text(formatter.localizedString(for: clip.date, relativeTo: .now))
            Text("\(duration, format: .number)s")
        }
    }
}
```

**Prompt:** The feed scrolls at 45fps. Why might this row be a suspect, and what's the principle?

**Answer:** `body` is called **constantly** — every invalidation of this view or an ancestor. Two things that don't belong there: (1) allocating a formatter per render (`(Relative)DateTimeFormatter` creation is notoriously expensive — hundreds of these per second while scrolling); (2) an O(n) reduce over frame data per render. Multiply by every visible row, every scroll tick.

Principle: **`body` must be a cheap, pure read of precomputed state.**
- Formatters: `static let` (shared, allocated once) — they're safe to reuse.
- Derived values: compute once where the data changes (in the model / at decode time), store `clip.duration`.
- If a subview truly re-renders too often, check what state it reads; with legacy `ObservableObject`, coarse `@Published` objects over-invalidate (the `@Observable` migration fixes exactly this — worth *saying*).

**How you'd catch it:** Instruments → SwiftUI template (View Body invocation counts), Time Profiler for the reduce, `Self._printChanges()` while debugging.

---

## Section 5 — Video & media pipelines (Medal's home turf; AVFoundation is their listed bonus)

### Drill 5.1 ★ — The upload that jetsams the app

```swift
func uploadClip(at fileURL: URL) async throws {
    let data = try Data(contentsOf: fileURL)          // 2-min 1080p60 clip
    var request = URLRequest(url: uploadEndpoint)
    request.httpMethod = "POST"
    request.httpBody = data
    let (_, response) = try await URLSession.shared.data(for: request)
    try validate(response)
}
```

**Prompt:** Works fine on your test clips. Users uploading real gameplay recordings get killed mid-upload with no crash log (just a jetsam event). Diagnose and redesign.

**Answer:** `Data(contentsOf:)` loads the **entire video into RAM** — a couple minutes of 1080p60 is hundreds of MB — then `httpBody` effectively doubles the exposure. Memory spikes past the per-app ceiling and the OS jetsams the process: no crash report, because it's not a crash.

Redesign, in layers:
1. **Stream from disk, never materialize:** `URLSession.uploadTask(with:fromFile:)` (or `upload(for:fromFile:)` async) — the system streams the file in chunks with a tiny memory footprint.
2. **Use a background `URLSession` configuration** — gameplay uploads are long; users background the app. Background sessions survive suspension and even relaunch.
3. **Chunked/resumable protocol** (multipart ranges, tus-style) so hotel Wi-Fi failure at 95% resumes instead of restarting — with per-chunk retry and an idempotency key so the server dedupes.
4. If transcoding first: `AVAssetExportSession` to a temp file, then upload the file — still never a `Data` blob.

**Say this out loud:** *"My rule for media is: video lives in files and streams; it only ever exists in memory a sample buffer at a time. Any API that hands me the whole thing as `Data` is a red flag at Medal's file sizes."*

---

### Drill 5.2 ★ — Design discussion: an autoplaying clip feed that doesn't melt

**Prompt (this is a "reason with me" exercise, not a bug hunt):** *"Our feed autoplays clips as you scroll, TikTok-style. How would you architect the playback layer?"* — Have a structured answer ready; this is *their* product.

**The shape of a strong answer:**

1. **A small pool of players, not one per cell.** `AVPlayer` + its rendering pipeline is expensive, and iOS supports only a handful of simultaneous hardware decode sessions. Keep ~3 players (previous / current / next), owned by a feed-level controller *outside* the cells (ties back to Drill 4.1); cells are dumb surfaces (`AVPlayerLayer` / `VideoPlayer`) that get a player attached on focus.
2. **Prefetch by scroll intent.** As a cell approaches, attach a player, preload asset properties asynchronously (`AVURLAsset.load(.isPlayable, .duration)` — never block on sync property access), and pre-roll. On fast flicks, **cancel** prefetches for cells that blew past (Drill 1.1's cancellation discipline again).
3. **Serve HLS, not progressive MP4s,** so quality adapts to bandwidth mid-clip; set `preferredForwardBufferDuration` small for fast starts, and `automaticallyWaitsToMinimizeStalling` appropriately for short clips.
4. **Thumbnails as first paint:** show the cached thumbnail instantly, crossfade to video when ready — perceived performance is the metric that matters in a feed.
5. **Lifecycle discipline:** pause + detach offscreen players, respond to audio-session interruptions, drop the pool on memory warnings, and mute-autoplay per policy/UX.
6. **Measure:** time-to-first-frame, stall rate, player-pool cache hits — tie it to analytics (the JD literally says data-driven).

**Say this out loud:** *"The core idea: players are a scarce resource that the feed orchestrates; cells never own them. Everything else — prefetch, HLS, cancellation — hangs off that inversion."*

---

### Drill 5.3 — The wrong thumbnail on the wrong cell

```swift
func collectionView(_ cv: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
    let cell = cv.dequeueReusableCell(withReuseIdentifier: "clip", for: indexPath) as! ClipCell
    let clip = clips[indexPath.item]

    let generator = AVAssetImageGenerator(asset: AVURLAsset(url: clip.videoURL))
    generator.generateCGImagesAsynchronously(forTimes: [NSValue(time: .zero)]) { _, cgImage, _, _, _ in
        DispatchQueue.main.async {
            if let cgImage { cell.thumbnailView.image = UIImage(cgImage: cgImage) }   // ⚠️
        }
    }
    return cell
}
```

**Prompt:** Scroll fast and thumbnails land on the wrong clips, then "fix themselves." Classic — walk through it.

**Answer:** **Cell reuse race.** The closure captures the *cell object*. By the time the async generation finishes, that cell has been recycled to display a different clip — the image lands on whatever the cell shows *now*. Fast scrolling = a queue of stale completions painting the wrong rows.

The three-part fix, worth reciting:
1. **Validate identity at delivery** — capture the clip ID, not just the cell; on completion, ask the collection view for the cell *currently* at that item (`cellForItem(at:)` returns nil if offscreen) or compare `cell.representedID == clip.id` set at configure time.
2. **Cancel on reuse** — kick off cancellation in `prepareForReuse` (`generator.cancelAllCGImageGeneration()` / cancel the task).
3. **Cache aggressively** — thumbnails in `NSCache` keyed by clip ID so re-scrolls are sync hits; ideally the *server* provides thumbnail URLs and the device never touches the video asset for a feed image at all.

**Senior extension:** also decode/downsample off-main at target size (`maximumSize` on the generator, or `UIGraphicsImageRenderer` downsampling) — full-res decode on the main thread is the *other* scroll killer hiding in this snippet.

---

### Drill 5.4 — Reasoning drill: recording inside a ~50MB box

**Prompt:** *"iOS screen recording via a ReplayKit broadcast upload extension runs in a separate process with a hard memory ceiling — around 50MB. Sample buffers arrive at 60fps. How do you design capture within that?"* (Medal shipped in-app recording on iOS — some version of this constraint is their daily life.)

**The reasoning they want to hear:**
- **Never accumulate.** The budget is a rounding error compared to raw frames (a single 1080p BGRA frame is ~8MB). Everything must be *flow-through*: sample buffer in → process → append to `AVAssetWriter` → release. Holding even a handful of buffers is fatal.
- **Do less per frame.** Downscale/transcode via hardware (VideoToolbox / writer presets), skip or drop frames under pressure rather than queueing them (Drill 1.6's `bufferingNewest` logic — same principle, different layer).
- **Write incrementally to shared storage.** Stream into a file in the **App Group container**; the main app picks it up for editing/upload. Communicate via file coordination/Darwin notifications — the extension does capture, nothing else.
- **Fail visibly, not silently.** If the extension is killed (memory, user stop), the writer must finalize or the file must be salvageable — design for partial recordings.
- **Honest hedge that scores points:** *"I'd verify the current ceiling and behavior on-device — extension limits are folklore-adjacent and change by OS release. The design principle — streaming, zero accumulation — holds regardless of the exact number."*

---

## Section 6 — Real-time & networking (feeds, chat, likes)

### Drill 6.1 — Chat that survives the subway

**Prompt (design discussion):** *"Our chat runs over WebSockets. Users ride the subway. What does your client connection layer look like?"*

**The shape of a strong answer:**
1. **Reconnect with exponential backoff + jitter** (1s, 2s, 4s… capped, randomized so a server blip doesn't get a synchronized thundering herd), reset on success; reconnect triggers on app-foreground and network-path change (`NWPathMonitor`), not just on failure.
2. **Gap fill on reconnect.** A socket that reconnects has *missed messages*. Track the last-seen message ID / cursor per conversation; on reconnect, fetch the delta over REST, then resume streaming. The socket is a live tail, REST is the source of truth.
3. **Ordering & dedup.** Server-assigned sequence/IDs, client dedups by ID (reconnect overlap *will* redeliver), UI sorts by server order, not arrival order.
4. **Optimistic send.** Message appears instantly in "sending" state with a client-generated UUID; server echo confirms (dedup by that UUID — it's the idempotency key, so retries can't double-send); failure → retry affordance. Queue outbound while offline.
5. **Heartbeat/ping** to detect half-dead connections (carrier NAT loves those), and clean pause in background per iOS socket lifecycle.

**Say this out loud:** *"The mental model: the socket is an optimization over polling, not the system of record. Everything must converge correctly if the socket lies, dies, or replays."*

---

### Drill 6.2 ★ — The feed that repeats itself

```swift
func loadNextPage() async throws {
    let page = try await api.fetchClips(offset: clips.count, limit: 20)
    clips.append(contentsOf: page)
}
```

**Prompt:** Users scroll, and every so often the same clip appears twice in a row across a page boundary. The backend swears the DB has no duplicates. What's wrong?

**Answer:** **Offset pagination under a moving dataset.** Between page 1 and page 2, new clips were posted (or ranking shifted). Everything slides down; `offset: 20` now points *before* where page 1 ended, so the tail of page 1 reappears at the head of page 2. (Deletions cause the mirror bug: skipped items you never see.)

Fix: **cursor pagination.** The server returns an opaque cursor anchored to the last item (e.g., `(created_at, id)`); the client passes it back verbatim:

```swift
let page = try await api.fetchClips(after: cursor, limit: 20)
cursor = page.nextCursor
clips.append(contentsOf: page.items)
```

Client-side hygiene regardless of protocol: **dedup by ID on append** (a `Set<Clip.ID>` guard), because the server is allowed to have a bad day — pairs with stable `ForEach` identity from Drill 4.2, since duplicate IDs in a `ForEach` are their own crash/glitch class.

**Senior extension:** for a *ranked* feed (Medal's discovery tab), cursors get fuzzier — a session token pinning a ranking snapshot is common. Mentioning that shows you've met real feeds, and it's a great reverse-question for the interviewers.

---

### Drill 6.3 — The like button that lies under retry

```swift
func toggleLike(for clip: Clip) async {
    clip.isLiked.toggle()
    clip.likeCount += clip.isLiked ? 1 : -1      // optimistic UI ✓
    do {
        try await api.post("/clips/\(clip.id)/toggle-like")   // ⚠️
    } catch {
        clip.isLiked.toggle()
        clip.likeCount += clip.isLiked ? 1 : -1  // rollback
    }
}
```

**Prompt:** Optimistic update ✓, rollback on failure ✓. QA still produces wrong like states on flaky networks. Find the two deeper problems.

**Answer:**
1. **"Toggle" isn't idempotent.** A timeout is *ambiguous* — the server may have processed the request even though the client saw an error. Retry (or the user tapping again after your rollback) *flips it back*. Any endpoint where replaying changes the outcome is broken under retries. Fix the contract: declarative state, `PUT like = true/false` — safe to retry any number of times; send with an idempotency key if the backend supports it.
2. **Rapid taps race.** Two in-flight toggles resolve out of order and the rollback arithmetic corrupts the count. Fix: serialize per clip — latest intent wins, cancel/coalesce the previous request (`switchToLatest` thinking again, in async clothes), and reconcile `likeCount` from the server's response rather than client math.

**Say this out loud:** *"Optimistic UI is easy; the hard part is that errors are ambiguous. I design mutations to be idempotent and declarative so the client can retry stupidly and still converge — then the server's echo is the truth that reconciles the UI."*

---

## Section 7 — Rapid-fire minis (morning-of warm-up, ~10 minutes)

**7.1 —** 
```swift
struct Clip { var title: String }
var a = Clip(title: "Ace")
var b = a
b.title = "Whiff"
print(a.title)
```
**"Ace."** Structs copy on assignment; `b` is an independent value. (Collections are value types too, with copy-on-write.) Bonus point: SwiftUI's whole diffing model leans on value semantics — mutate a copy, nothing else sees it.

**7.2 —**
```swift
func process() throws {
    defer { print("1") }
    defer { print("2") }
    print("3")
}
```
**3, 2, 1.** `defer` blocks run LIFO at scope exit — including early returns and thrown errors. That reliability is why `defer { isLoading = false }` is the loading-flag idiom.

**7.3 —**
```swift
var count = 0
let c1 = { print(count) }
let c2 = { [count] in print(count) }
count = 5
c1()   // ?
c2()   // ?
```
**5, then 0.** Closures capture *variables by reference* by default (c1 sees the later mutation); a capture list copies the *value at creation* (c2 froze zero). Same mechanism behind `[weak self]` — the capture list changes *how* you capture.

**7.4 —**
```swift
// already running on the main thread:
DispatchQueue.main.sync { updateBadge() }
```
**Deadlock.** Main is a serial queue: `sync` blocks the main thread waiting for a closure that can only run… on the main thread it just blocked. Never `sync` onto the queue you're on; with async/await this whole class of bug dissolves into `await MainActor.run` / `@MainActor`.

**7.5 —**
```swift
final class Session {
    lazy var decoder = JSONDecoder()   // first touched from two threads at once
}
```
**Not thread-safe.** `lazy var` initialization has no synchronization — concurrent first access can double-initialize (or worse). Contrast to name out loud: `static let` *is* lazy **and** thread-safe (dispatch_once semantics). Fixes: eager `let`, isolate the class (actor / `@MainActor`), or lock.

**7.6 —**
```swift
print("A")
DispatchQueue.main.async { print("B") }
print("C")
```
**A, C, B.** `async` enqueues; the current pass through the run loop finishes before the block runs. Same shape with `Task { }` — the synchronous code after it wins the race.

---

## Appendix A — The routine, condensed (keep open in the interview)

> 1. **Intent:** "This code is trying to ___."
> 2. **Trace:** ownership, lifetimes, value-vs-reference, suspension points, thread hops.
> 3. **Name the bug precisely** — mechanism, not vibes.
> 4. **Minimal fix → hardened fix.** ("One-line fix is X; in production I'd also Y.")
> 5. **How I'd catch it:** Swift 6 strict concurrency / Thread Sanitizer (races) · Memory Graph + Instruments Leaks (cycles) · SwiftUI Instruments + `Self._printChanges()` (renders) · a failing test (logic).

Stalling lines that buy thinking time and still sound senior: *"Let me trace who owns what here."* · *"First question I ask of any async code: what happens when this races or gets cancelled?"* · *"Let me check the lifetimes before the logic."*

Recurring themes across every drill — if stuck, check these in order: **lifetime** (who keeps this alive? who cancels it?), **identity** (what makes this *the same thing* across updates?), **isolation** (which context mutates this?), **idempotency** (what happens on retry?), **memory scale** (what happens at 60fps / 500MB?).

---

## Appendix B — Company cheat sheet (60 seconds before you join the call)

**General Intuition** — frontier AI lab for "acting in space and time": world models + large action models trained on Medal's **3.8B action-labeled gameplay clips** (video + the actual controller inputs — the data moat nobody else has). **$320M Series A at $2.3B** (June 2026) led by Khosla Ventures, with General Catalyst, **Jeff Bezos, Eric Schmidt**; ~$454M total raised ($134M seed, Oct 2025). Reportedly **turned down a ~$500M OpenAI acquisition** to stay independent. Compute via CoreWeave. First product: an API for game developers — "frames in, actions out" agents replacing brittle behavior-tree bots; roadmap runs games → realistic sim → **robotics** (their quadruped navigated an office after ~8 minutes of real-world fine-tuning). Also launched **Nerve**, a marketplace where gamers get paid for data labeling/teleoperation. Stated ethics line: no lethal autonomy.

**People:** CEO **Pim de Witte** — built Medal starting from RuneScape private servers; cofounders **Eloi Alonso, Adam Jelley, Vincent Micheli** (world-model researchers); CPO **Kent Rollins**.

**Medal** (the product you'd work on) — world's largest gaming-clips platform, ~12M users. iOS app (4.8★, ~32k ratings): clip feeds + discovery, Stories, built-in editor (trim/text/stickers/voiceover), sharing to Discord/TikTok/IG, console-clip sync, 1080p60 uploads, and **in-app recording** shipped in v6.0. The JD's phrase: "real-time recording and clipping to social feeds, content discovery, and chat."

**Their stack:** Swift (iOS) · Kotlin (Android) · Electron/React/Redux (desktop) · C#/C++ (native Windows recording) · Java, Redis, RabbitMQ, Kubernetes (backend) · Terraform, GitHub Actions, CircleCI.

**The role:** Senior iOS Engineer, NYC on-site, **$180K–$275K + equity**, small team, ship fast ("idea pitched on Monday can be in users' hands two or three weeks later").

**Why this passes your #1 filter effortlessly:** you'd be a consumer engineer *inside a frontier AI lab*. The anti-VPG.

---

## Appendix C — The other two-thirds of the interview

### Your gaming answer (honest "grew up gaming, less now" — and it's a great story)

The trap is faking current-gamer status to engineers who live this; the win is an *authentic arc*. Yours is unusually good:

> "Gaming is how I got into tech — I grew up on [YOUR TITLES/ERA HERE — name 2–3 real ones and what you loved about them]. And my path kept looping back to it: one of my early jobs was at WM Robots, where I piloted camera drones — controller in hand, screen in front of me, real machine responding. So your whole thesis, that game-controller skills transfer to acting in the real world, isn't abstract to me — I've lived that loop. These days I'll be honest: I build more than I play — nights go to shipping my own apps — but that's exactly why Medal appeals to me. It's an engineering-heavy product about the *culture* of play, and the hardest kind of consumer engineering: real-time video."

Fill in the bracket before the interview — real titles only, and have one warm story about one of them. If they ask what you're playing *now*, honesty + curiosity: name whatever you actually touch (even casual/mobile counts), then flip it: *"What's the team playing? I want to see what clips culture looks like from the inside."* Interviewers remember the question you asked more than the title you named.

### The recency framing (they wrote "recency matters" in the JD — expect it)

> "My last stretch mixes native Swift and React Native, deliberately. NuvoAir was a SwiftUI clinical app with live BLE device streaming; at Photobucket the interesting work was *native* — custom Swift modules for secure media and auto-backup under an RN shell; and daily since then, Swift stays current through my own studio work. I'm fluent in the modern stack — Swift Concurrency, `@Observable`, SwiftUI-with-UIKit-where-it-earns-it — and 15 years of iOS means the platform's sharp edges are old friends. The honest version: my fingers are warm and my instincts are deep."

Then *prove* recency by how you talk in the code-reasoning section — actor reentrancy and `bufferingNewest` do the arguing for you. (That's what this whole doc is for.)

### Experience mapping — their signal → your story (one-liners, expand on demand)

- **Video/media-heavy** → Photobucket: secure media sharing + auto-backup, custom Swift native modules. Allscripts: telemedicine video to 1M+ patients.
- **Real-time** → NuvoAir: live BLE streaming from medical hardware into a SwiftUI app — sample-rate data, connection drops, reconnection discipline.
- **Social** → Baat: shipped a full social/dating app end-to-end (profiles, matching, messaging surface) — your product-ownership story in miniature.
- **Ownership** → sole mobile engineer at VPG and Photobucket; "drove it end-to-end" is your default mode, which is literally their bullet.
- **Scale + data-driven** → FreedomCare: 25k+ daily users, built and led the team, lived on crash reports and analytics. Regulated-industry rigor (clinical trials) = disciplined about quality by habit.
- **AI-native** → bamware: multi-agent studio (Claude Code + CrewAI behind evals and review gates) shipping real apps. At an AI lab, this is your differentiator against every other 15-year iOS veteran — use it.

### Questions to ask (pick 4–5; these are peer-to-peer engineer questions)

1. "You shipped in-app recording on mobile — what was the hardest iOS constraint to design around? I'm guessing extension memory limits or the capture-to-editor pipeline." *(Instant credibility; you have opinions from this doc.)*
2. "Where's the codebase on the UIKit↔SwiftUI spectrum, and how's the Swift 6 strict-concurrency migration treating you?"
3. "Do clips captured on iOS feed the action-labeled dataset on the GI side? And do you see world-model features — auto-highlight detection, smart clipping — landing in the app, on-device or server-side?" *(Shows you understand the whole company, not just the app.)*
4. "How do engineers here actually use AI tools day to day? I build with Claude Code and agents constantly — curious what the norm is inside a frontier lab." *(Your #1 filter, asked as curiosity, not demand.)*
5. "The JD says an idea pitched Monday ships in two or three weeks — walk me through that pipeline. Feature flags? Experiments? Who kills a feature that isn't working?"
6. "How big is the iOS team, and how do mobile, backend, and design actually collaborate day to day?"
7. "What would a great first 90 days look like for this role?"

### Final checklist

- [ ] ★ track done twice; rapid-fire minis the morning of.
- [ ] Gaming bracket filled with your real titles + one story.
- [ ] 4–5 questions picked and written down.
- [ ] Reread Appendix B right before the call.
- [ ] They said 60–90 min because "convos get carried away" — that's an invitation. If a drill topic comes up, *go deep and enjoy it*. Energy: calm, curious, senior.

---

*The code-reasoning round rewards exactly one thing: precise mechanisms, narrated out loud. You've debugged every bug in this doc for real at some point in 15 years — this week is just reloading them into working memory. Go get it.*
