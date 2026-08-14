# SwiftUI + Combine — 2-Day Live-Coding Refresher

**Bilal Malik · rebuild the model, reload the fingers**

You've shipped iOS for 15 years. You don't need to *learn* this — you need the declarative model and the modern syntax back at your fingertips fast. Read this top-to-bottom once, then do the drills by *typing them out cold*, not reading them. The drills are the part that actually moves the needle. Silence-and-reread is how people walk into a live round and blank on `@Binding`.

**How to use this in 2 days:**
- **Day 1:** Sections 1–5 (mental model + state + layout + lists/nav). Do every drill by hand in a Playground.
- **Day 2:** Sections 6–8 (Combine, async/await, networking) + the gotchas + the two mini-apps. Then re-do the Section 1–3 drills cold to prove they stuck.
- Keep the *live-coding checklist* (Section 10) open during the interview.

**One framing note for the interview:** modern SwiftUI (iOS 17+) moved to the `@Observable` macro and away from `ObservableObject`/`@Published`/Combine for view state. Both are live in the wild. This doc teaches **the modern way as default** and **flags the legacy way** wherever it differs — because a strong signal in the room is *"here's how I'd do it today, and here's the older pattern you'll still see in the codebase."* That sentence alone reads as current.

---

## 1. The mental model (this is the whole game)

UIKit is **imperative**: you hold references to views and mutate them (`label.text = "hi"`). SwiftUI is **declarative**: you describe what the UI *should look like for a given state*, and the framework diffs and updates it for you. You never call `reloadData()`. You change state; the view recomputes.

The single sentence to internalize:

> **A view is a function of its state.** `body` is a pure computed property that SwiftUI calls whenever the state it depends on changes.

```swift
struct CounterView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Count: \(count)")
            Button("Increment") { count += 1 }
        }
    }
}
```

When `count` changes, SwiftUI re-invokes `body`, produces a new lightweight description of the view tree, diffs it against the old one, and updates only what changed. `body` runs *constantly* and cheaply — **never** put side effects, network calls, or expensive work directly in `body`.

Three consequences that trip up UIKit brains:

1. **Views are value types (structs), not objects.** They're cheap, disposable descriptions. They get recreated all the time. So view state can't just live as a stored property — a `var count = 0` on the struct would get wiped every recompute. That's *why* the property wrappers exist (Section 2).
2. **`some View` is an opaque return type** — "I return one specific concrete View type, the compiler figures out which." You don't write the type; it's often monstrous (`VStack<TupleView<...>>`).
3. **You compose small views**, you don't subclass. Reuse = extract a subview or a `@ViewBuilder` function, not inheritance.

**`@ViewBuilder`** is the magic behind `VStack { ... }` accepting multiple child views without commas or `return`. It's a result builder that collects the views. You can annotate your own functions with it:

```swift
@ViewBuilder
func header(_ title: String) -> some View {
    Text(title).font(.headline)
    Divider()
}
```

### Drill 1
From an empty Playground/file, type a `ToggleView` that shows `Text("On")` or `Text("Off")` and a button that flips it. No peeking. If you reach for a class or a stored `var isOn = false` without a wrapper, stop — that's the UIKit reflex, and Section 2 is why it fails.

---

## 2. State & data flow — the part they're actually testing

This is where live-coding rounds are won or lost. Get the wrapper decision right out loud and you sound senior. There are two eras; know both.

### 2a. Modern era (iOS 17+): `@Observable` + `@State` + `@Bindable`

**`@Observable`** (a macro from the Observation framework) marks a reference type (class) whose properties SwiftUI tracks automatically. Views re-render only when a property they *actually read* changes — finer-grained and faster than the old way.

```swift
@Observable
class CartModel {
    var items: [String] = []
    var total: Double = 0
}
```

Ownership and passing:

- **`@State`** — the view **owns** a piece of state. Use it for value types (`Int`, `Bool`, `String`, structs) *and*, in iOS 17+, to own the lifetime of an `@Observable` object.
  ```swift
  @State private var cart = CartModel()   // this view owns the model
  ```
- Pass an `@Observable` object to a child **as a plain property** (`let`/`var`). The child re-renders automatically when it reads a changed property. No wrapper needed just to observe.
  ```swift
  struct CartSummary: View {
      var cart: CartModel          // plain — observation still works
      var body: some View { Text("\(cart.items.count) items") }
  }
  ```
- **`@Bindable`** — when a child needs a two-way **binding** into an `@Observable` object's property (e.g. a `TextField`):
  ```swift
  struct EditName: View {
      @Bindable var user: UserModel
      var body: some View { TextField("Name", text: $user.name) }
  }
  ```
- **`@Environment(_:)`** — inject an `@Observable` object through the environment (dependency injection down the tree):
  ```swift
  // parent:  ContentView().environment(cart)
  @Environment(CartModel.self) private var cart
  ```

### 2b. Legacy era (still everywhere, still interviewed): `ObservableObject` + `@Published`

This is the Combine-backed model. You'll see it in most existing codebases, so be fluent.

```swift
class CartModel: ObservableObject {
    @Published var items: [String] = []
    @Published var total: Double = 0
}
```

- **`@StateObject`** — the view **owns and creates** the observable object (created once, survives re-renders). Use where you'd use `@State` for a class.
  ```swift
  @StateObject private var cart = CartModel()
  ```
- **`@ObservedObject`** — the object is **passed in** from a parent (this view does *not* own it). ⚠️ Classic bug: using `@ObservedObject` with an inline `= CartModel()` initializer — it gets recreated on every parent re-render and loses state. Own it with `@StateObject`, pass it with `@ObservedObject`.
- **`@EnvironmentObject`** — passed implicitly through the environment; inject with `.environmentObject(cart)`. Crashes at runtime if you forgot to inject it (a known footgun).
- **`@Published`** — marks a property that, on change, fires the object's `objectWillChange` publisher, which re-renders every view observing that object (coarser than `@Observable` — the *whole* object triggers, not per-property).

### 2c. The two wrappers that are identical in both eras

- **`@State`** — view-owned local value-type state. Private by convention. The source of truth.
- **`@Binding`** — a **read/write reference** to state owned *somewhere else*. This is how a child mutates a parent's `@State` without owning it. You pass it with the `$` prefix (the projected value).
  ```swift
  struct Parent: View {
      @State private var isOn = false
      var body: some View { ToggleRow(isOn: $isOn) }   // $ = a Binding to isOn
  }
  struct ToggleRow: View {
      @Binding var isOn: Bool                            // read/write into parent's state
      var body: some View { Toggle("Power", isOn: $isOn) }
  }
  ```

### The decision table (memorize this shape)

| You need… | Modern (iOS 17+) | Legacy |
|---|---|---|
| Local value state this view owns | `@State` | `@State` |
| Let a child read/write my value state | pass `$value` → `@Binding` | same |
| A reference-type model this view **owns** | `@State var m = Model()` | `@StateObject` |
| A reference-type model **passed in** (observe only) | plain `var m: Model` | `@ObservedObject` |
| Two-way binding into a passed-in model | `@Bindable var m` | `@ObservedObject` + `$m.prop` |
| Inject a model down the whole tree (DI) | `@Environment(Model.self)` | `@EnvironmentObject` |
| Model type declaration | `@Observable class` | `class: ObservableObject` + `@Published` |

**Say this in the room if asked:** *"I'd reach for `@Observable` and `@State` to own the model — it's the current API and gives per-property invalidation. In an older codebase I'd match the existing `ObservableObject`/`@Published` + `@StateObject`/`@ObservedObject` pattern."*

### Drill 2 (do this twice)
Build a two-screen flow: a `TodoListView` that owns a model of `[String]` todos, and an `AddTodoView` presented as a sheet that appends a new todo. Do it **once modern** (`@Observable` + `@State` + `@Bindable`) and **once legacy** (`ObservableObject` + `@Published` + `@StateObject`). If you can do both without notes, you've got the single most-tested concept locked.

---

## 3. Layout — stacks, modifiers, frames

Three primitives do 90% of layout:
- **`VStack`** — vertical. **`HStack`** — horizontal. **`ZStack`** — depth (back-to-front).
- Each takes `alignment:` and `spacing:`.
- **`Spacer()`** — greedy flexible space; pushes siblings apart. **`Divider()`** — a line.

```swift
HStack(alignment: .center, spacing: 12) {
    Image(systemName: "star.fill")
    VStack(alignment: .leading) {
        Text("Title").font(.headline)
        Text("Subtitle").font(.subheadline).foregroundStyle(.secondary)
    }
    Spacer()          // shoves everything above to the left
    Text("→")
}
.padding()
```

**Modifiers** are the core idiom, and **order matters** — each modifier wraps the view it's called on and returns a *new* view.

```swift
Text("Hi").padding().background(.blue)   // blue fills padding+text
Text("Hi").background(.blue).padding()   // blue fills only text, padding outside
```

The frame system you'll actually use:
- `.frame(width:height:)` — fixed size.
- `.frame(maxWidth: .infinity)` — expand to fill available width (the "make this button full-width" move).
- `.frame(minHeight:idealHeight:maxHeight:alignment:)` — flexible with an alignment for the content inside.

**`GeometryReader`** — gives you the parent's proposed size when you genuinely need it (e.g. "make this 40% of screen width"). It's greedy (fills its parent) and easy to overuse — reach for it only when a relative/proportional layout truly requires the numbers.

```swift
GeometryReader { geo in
    Rectangle().frame(width: geo.size.width * 0.4)
}
```

Common modifiers worth having cold: `.font()`, `.foregroundStyle()`, `.padding()`, `.background()`, `.cornerRadius()` / `.clipShape(RoundedRectangle(cornerRadius:))`, `.overlay()`, `.opacity()`, `.frame()`, `.onTapGesture {}`, `.onAppear {}`, `.disabled()`, `.tint()`.

### Drill 3
Build a "profile card": a rounded rectangle with an SF Symbol avatar on the left, a name + handle stacked in the middle, a right-aligned "Follow" button that's full-width-of-its-column, padding, and a subtle background. Get the `Spacer()` and modifier-order right by eye.

---

## 4. Lists, ForEach, and dynamic content

**`List`** is the SwiftUI table view — scrolling, cell reuse, separators, all free.

```swift
List(users) { user in            // users: [User] where User: Identifiable
    Text(user.name)
}
```

**`ForEach`** generates views from a collection; use it *inside* `List`, `VStack`, etc. It needs a stable identity:
- If elements conform to **`Identifiable`** (have an `id`), just `ForEach(items)`.
- Otherwise supply a key path: `ForEach(items, id: \.self)` (for e.g. `[String]`) or `ForEach(items, id: \.someUniqueField)`.

```swift
struct User: Identifiable {
    let id = UUID()
    let name: String
}

List {
    ForEach(users) { user in
        HStack { Text(user.name); Spacer(); Image(systemName: "chevron.right") }
    }
    .onDelete { indexSet in users.remove(atOffsets: indexSet) }   // swipe-to-delete
}
```

⚠️ **Identity gotcha** (a favorite trap): `ForEach(items, id: \.self)` on an array with duplicate values, or using array indices as IDs while the array mutates, causes wrong animations, dropped rows, or state attaching to the wrong cell. Prefer real `Identifiable` IDs.

**`Section`** groups rows with headers/footers. **Forms** (`Form { ... }`) auto-style rows as grouped settings-style UI — great for a quick input screen in a live round.

### Drill 4
`List` of `Identifiable` items with a `Section` header, swipe-to-delete, and a row that navigates to a detail view (leads into Section 5). Then repeat with a `[String]` using `id: \.self` and articulate out loud why real IDs are safer.

---

## 5. Navigation, sheets, alerts

**`NavigationStack`** (iOS 16+) is current. `NavigationView` is **deprecated** — if you type it, correct yourself out loud; interviewers notice.

```swift
NavigationStack {
    List(users) { user in
        NavigationLink(user.name, value: user)     // value-based (modern)
    }
    .navigationTitle("Users")
    .navigationDestination(for: User.self) { user in
        UserDetail(user: user)
    }
}
```

Two navigation styles:
- **Simple:** `NavigationLink("Label") { DestinationView() }` — inline destination.
- **Value-based (programmatic):** `NavigationLink(value:)` + `.navigationDestination(for:)`, optionally driven by a `@State var path = NavigationPath()` bound to the stack for push/pop-in-code and deep linking. Mentioning `NavigationPath` for programmatic control is a senior signal.

**Sheets / modals:**
```swift
.sheet(isPresented: $showingSheet) { AddItemView() }
.sheet(item: $selectedItem) { item in DetailView(item: item) }  // item-driven
```

**Alerts & confirmation:**
```swift
.alert("Delete?", isPresented: $showConfirm) {
    Button("Delete", role: .destructive) { delete() }
    Button("Cancel", role: .cancel) { }
} message: { Text("This can't be undone.") }
```

Dismiss the current screen from inside it:
```swift
@Environment(\.dismiss) private var dismiss
// ...
Button("Done") { dismiss() }
```

### Drill 5
Wrap Drill 4's list in a `NavigationStack` with a title, a toolbar "+" button (`.toolbar { ToolbarItem(placement: .primaryAction) { Button... } }`) that presents an add-item `.sheet`, and a detail screen reached by `NavigationLink`. This little app is basically every SwiftUI live-coding prompt — build it until it's muscle memory.

---

## 6. Combine — the essentials

Combine is Apple's reactive framework: **publishers** emit values over time, **operators** transform the stream, **subscribers** receive them. Since iOS 15+ async/await covers a lot of what Combine used to (Section 7), but Combine is still all over existing code and still comes up — especially anything with `@Published`, form validation, debounced search, or `Timer`/notification streams.

The three roles:
- **Publisher** — emits zero+ values, then optionally a completion (`.finished` or `.failure(Error)`). Has two associated types: `Output` and `Failure`.
- **Operator** — a publisher that wraps another and transforms it (`map`, `filter`, `debounce`, `combineLatest`…). Chains are lazy — nothing runs until subscribed.
- **Subscriber** — requests and receives values. `sink` and `assign` are the built-in ones.

```swift
import Combine

var cancellables = Set<AnyCancellable>()

[1, 2, 3, 4].publisher
    .filter { $0 % 2 == 0 }
    .map { $0 * 10 }
    .sink { print($0) }          // prints 20, then 40
    .store(in: &cancellables)
```

**`AnyCancellable` / `store(in:)`** — a subscription lives only as long as its `AnyCancellable`. Store it (usually in a `Set<AnyCancellable>` property on your model) or it's cancelled immediately and you'll see *nothing*. This is the #1 "why isn't my Combine code firing" bug.

**`@Published` is a publisher.** Access its stream with the `$` prefix:
```swift
class SearchModel: ObservableObject {
    @Published var query = ""
    @Published var results: [String] = []
    private var cancellables = Set<AnyCancellable>()

    init() {
        $query
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] text in self?.search(text) }
            .store(in: &cancellables)
    }
    func search(_ text: String) { /* ... */ }
}
```
That debounced-search snippet is the single most-asked Combine pattern — know it cold.

**Operators worth knowing by name:** `map`, `filter`, `compactMap`, `removeDuplicates`, `debounce`, `throttle`, `combineLatest` (merge latest of two streams), `merge`, `flatMap` (switch to a new publisher — e.g. kick off a network call per input), `receive(on:)` (hop threads — usually `.receive(on: DispatchQueue.main)` before touching UI), `eraseToAnyPublisher()` (hide the ugly concrete type behind `AnyPublisher<Output, Failure>`).

**`sink` vs `assign`:**
- `sink(receiveCompletion:receiveValue:)` — general-purpose; run any closure. (Value-only `sink { }` only compiles when `Failure == Never`.)
- `assign(to: \.prop, on: object)` — pipe values straight into a property. `assign(to: &$published)` assigns into another `@Published` without a cancellable.

⚠️ **Retain cycles:** `sink`/`assign(to:on:)` closures capture strongly. Use `[weak self]` inside `sink` when referencing `self`, or you leak the model.

### Drill 6
Write a `FormModel: ObservableObject` with `@Published var email` and `@Published var password`, and a derived `@Published var isValid` that's `true` only when email contains "@" and password length ≥ 8. Wire it with `Publishers.CombineLatest($email, $password).map { ... }.assign(to: &$isValid)`. This "combineLatest two fields into a validity flag" is a classic and shows you understand streams, not just syntax.

---

## 7. async/await & structured concurrency

Modern Swift concurrency often replaces Combine for one-shot async work (network calls, loading). Know when to use which.

```swift
func loadUser(id: Int) async throws -> User {
    let url = URL(string: "https://api.example.com/users/\(id)")!
    let (data, _) = try await URLSession.shared.data(from: url)
    return try JSONDecoder().decode(User.self, from: data)
}
```

**Calling async work from SwiftUI:**
- **`.task { }`** — runs an async job tied to the view's lifetime; auto-cancels when the view disappears. Preferred over `.onAppear` for async loads.
  ```swift
  .task { await viewModel.load() }
  ```
- **`Task { }`** — spin up an async context from a synchronous spot (e.g. a button action): `Button("Load") { Task { await vm.load() } }`.

**`@MainActor`** — guarantees code runs on the main thread. Annotate your view model (`@MainActor class VM`) so UI-state updates are main-thread-safe without manual `DispatchQueue.main.async`. This is the modern answer to Combine's `receive(on: .main)`.

**`async let`** — run things concurrently and await together:
```swift
async let a = loadUser(id: 1)
async let b = loadUser(id: 2)
let (userA, userB) = try await (a, b)   // both run in parallel
```

**Combine vs async/await — the interview answer:**
- **One-shot async** (fetch this, decode it, done): **async/await**. Cleaner, no cancellable bookkeeping.
- **Streams over time** (a `@Published` field changing, debounced search, multiple UI events combined, timers, notifications): **Combine** — or `AsyncSequence`/`.values` if you want to stay in async-land.
- Say it crisply: *"async/await for one-shot requests, Combine when I'm reacting to a stream of values over time — though I'll match whatever the codebase uses."*

### Drill 7
Convert Drill 6's *load* path (not the validation) to async/await: a `@MainActor @Observable class` with `func load() async` that fetches from a URL, decodes, and assigns to a `var items`. Call it from `.task`. Then say out loud why validation stays in Combine but the load moved to async.

---

## 8. Networking end-to-end (the "build a small app" prompt)

Live rounds love "fetch from this endpoint and show a list." The full modern shape:

```swift
struct Post: Identifiable, Decodable {
    let id: Int
    let title: String
    let body: String
}

@MainActor
@Observable
class FeedModel {
    var posts: [Post] = []
    var isLoading = false
    var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let url = URL(string: "https://jsonplaceholder.typicode.com/posts")!
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
                throw URLError(.badServerResponse)
            }
            posts = try JSONDecoder().decode([Post].self, from: data)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct FeedView: View {
    @State private var model = FeedModel()

    var body: some View {
        NavigationStack {
            Group {
                if model.isLoading {
                    ProgressView()
                } else if let error = model.errorMessage {
                    ContentUnavailableView("Error", systemImage: "exclamationmark.triangle", description: Text(error))
                } else {
                    List(model.posts) { post in
                        VStack(alignment: .leading) {
                            Text(post.title).font(.headline)
                            Text(post.body).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Feed")
            .task { await model.load() }
        }
    }
}
```

That template — `Decodable` model, `@MainActor @Observable` view model with `isLoading`/`error`/`data`, a `.task` load, and a three-state view (loading / error / content) — is a near-universal answer. **Internalize its skeleton**; you can regenerate the whole thing from the shape. Note the three states out loud as you build; interviewers love that you handled loading and error, not just the happy path.

`https://jsonplaceholder.typicode.com` is a free fake API — perfect for practicing this cold today.

### Drill 8
Type the whole FeedView app above from memory. Then extend it (staged, Betterment-style): add pull-to-refresh (`.refreshable { await model.load() }`), then tap-through to a `PostDetail` via `NavigationLink`. If you can build this in ~15 minutes talking the whole time, you're ready.

---

## 9. Live-coding gotchas & traps

The things that actually bite in the room:

- **`@State` must be `private`** and initialized inline. It's view-owned; exposing it is a smell.
- **`@ObservedObject var x = Model()`** — recreated every parent render, loses state. Own with `@StateObject` (or modern `@State` + `@Observable`).
- **Work in `body`** — `body` runs constantly. No network calls, no `Task {}` spawned inline unconditionally, no expensive computation. Move it to `.task`/`.onAppear`/computed helpers.
- **Forgotten `.store(in:)`** — Combine subscription dies instantly, nothing emits.
- **UI update off the main thread** — Combine chains need `.receive(on: DispatchQueue.main)` before `sink`-ing into UI; async code needs `@MainActor`. Purple runtime warnings otherwise.
- **`ForEach` with `id: \.self`** on non-unique data → wrong rows/animations. Use `Identifiable`.
- **`NavigationView`** — deprecated; use `NavigationStack`.
- **`@EnvironmentObject` not injected** → runtime crash, not a compile error.
- **Retain cycles in `sink`** — `[weak self]`.
- **Huge `body`** — extract subviews. A 200-line `body` reads as junior; small composed views read as senior.
- **`if let` in `body`** — you *can* branch and use `if let`/`switch` inside `@ViewBuilder`, but each branch must return a View. Wrap ambiguous cases; use `Group` when you need a single container around a conditional.

**Narration lines that score points** (say these as you code): *"I'll make this `Identifiable` so `ForEach` has stable identity"* · *"I'm putting this on `@MainActor` so UI updates are main-thread-safe"* · *"I'll handle loading and error states, not just the happy path"* · *"I'd own the model with `@State`/`@StateObject` here, not `@ObservedObject`, so it survives re-renders"* · *"This is the seam that changes if the requirement grows."*

---

## 10. Live-coding checklist (keep open during the interview)

1. **Clarify first (60s).** Restate the prompt. Ask about data source, empty/error states, target iOS version (settles `@Observable` vs `ObservableObject`).
2. **Model first.** Define the data type; make it `Identifiable`/`Decodable` if it'll be in a list or fetched.
3. **State decision, out loud.** Who owns the model? `@State` + `@Observable` (modern) or `@StateObject` (legacy). Say why.
4. **Build the skeleton.** `NavigationStack` → `List`/`ForEach` → a row view. Get *something* on screen fast.
5. **Wire state → UI.** Bindings for inputs, `.task` for loads.
6. **Handle the three states** if async: loading / error / content.
7. **Narrate the whole time.** Name things as you go, explain the wrapper choices, call out seams. Silence is the only way to fail a pairing round.
8. **When they extend it, extend the design** — don't rewrite. "Only the load step changes," "this modifier is the seam."
9. **Keep `body` small** — extract subviews as it grows.
10. **Don't gold-plate.** Clean and working beats clever and half-done. They'll extend it; leave room.

---

## Appendix: two mini-apps to build cold on Day 2

**A. Counter+ (state fundamentals, ~5 min):** a counter with increment/decrement/reset, a `@State` step size bound to a `Stepper`, and the count colored red when negative. Tests `@State`, `@Binding`, conditional modifiers.

**B. Search feed (the big one, ~20 min):** the Section 8 FeedView + a search field at top that filters the list *client-side* first, then — extension — a debounced Combine pipeline that re-queries the API on `query` change. This single app exercises `@Observable`/`ObservableObject`, `@MainActor`, async/await *and* Combine, `NavigationStack`, `List`, and the three-state pattern. If you can build B while narrating, you can pass this round.

---

*You've written more production Swift than most people who'll interview you. The format is the only scary part — and the format rewards exactly the person who's shipped this many times. Reps + narration. Go reload the fingers.*
