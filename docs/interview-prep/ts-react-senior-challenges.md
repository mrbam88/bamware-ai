# TS + React — Senior Challenges (Level 2)
**Bilal Malik · predict → check → narrate · these are the "let's see how deep it goes" probes**

Rules: cover the answer, say your prediction OUT LOUD, then read. Each ends with the line
to say in the room. Nothing here needs packages — all CoderPad-legal.

---

# PART 1 — TYPESCRIPT CHALLENGES

## TS-1 ★ "Implement `Partial` yourself" (the classic senior TS question)
```ts
type MyPartial<T> = { [K in keyof T]?: T[K] };
```
- Read it inside-out: `keyof T` = union of keys → `[K in keyof T]` = **mapped type**, a for-loop
  over keys at the type level → `?` adds optionality → `T[K]` = the original type at that key
- Follow-ups they chain: `MyRequired<T> = { [K in keyof T]-?: T[K] }` (`-?` REMOVES optionality) ·
  `MyReadonly<T> = { readonly [K in keyof T]: T[K] }` · `MyPick<T, K extends keyof T> = { [P in K]: T[P] }`
- **Say:** "Utility types aren't magic — they're mapped types, a loop over `keyof`. Happy to write any of them."

## TS-2 ★ `satisfies` vs `as` vs `:` (the modern one — recency signal)
```ts
type Config = Record<string, string | number>;

const a: Config = { apiUrl: 'x', retries: 3 };     // ✅ checked, BUT a.retries is now string|number
const b = { apiUrl: 'x', retries: 3 } as Config;   // ⚠️ cast — would hide real errors too
const c = { apiUrl: 'x', retries: 3 } satisfies Config;  // ✅ checked AND c.retries stays number
```
- `:` annotation **widens** — you lose the specific types you wrote
- `as` **asserts** — no real checking (typos sail through)
- `satisfies` **validates without widening** — best of both. `c.retries.toFixed()` works; `a.retries.toFixed()` errors
- **Say:** "`satisfies` checks conformance while keeping inference — I use it for config objects and lookup tables."

## TS-3 — Typing a generic hook (React + TS together, very likely live)
```ts
function useAsync<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<
    { status: 'idle' } | { status: 'loading' } | { status: 'done'; data: T } | { status: 'error'; error: Error }
  >({ status: 'idle' });

  const run = useCallback(async () => {
    setState({ status: 'loading' });
    try   { setState({ status: 'done', data: await fn() }); }
    catch (e) { setState({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) }); }
  }, [fn]);

  return { state, run };
}

const { state } = useAsync(fetchClips);   // T inferred as Clip[] — no annotation needed
```
- Everything from Level 1 composed: generic flows from the function you pass, discriminated union
  state, `unknown` catch narrowed. This one function is basically the whole TS interview
- **Say:** "The generic ties input to output so callers get full inference for free."

## TS-4 — `infer` (recognize-level, don't memorize)
```ts
type Unwrap<T> = T extends Promise<infer U> ? U : T;
// Unwrap<Promise<Clip>> = Clip · Unwrap<number> = number
```
- Conditional type (`extends ? :` = type-level if) + `infer` = "pattern-match and capture"
- This is how `ReturnType`, `Awaited`, `Parameters` are built
- **Say:** "Conditional types with `infer` pattern-match structure — I read them fine and reach for the built-ins (`Awaited`, `ReturnType`) before writing my own."

## TS-5 — The readonly trap
```ts
type Clip = { readonly id: string; tags: string[] };
const c: Clip = { id: '1', tags: ['fps'] };
c.id = '2';          // ❌ compile error — good
c.tags.push('ace');  // ✅ compiles! readonly is SHALLOW — the array itself is mutable
```
- Fixes: `readonly tags: readonly string[]`, or `Readonly<Clip>` (still shallow!), or model immutability by convention + immutable updates
- **Say:** "`readonly` is shallow and compile-time-only — the discipline that actually protects state is immutable updates, which React needs anyway."

---

# PART 2 — REACT CHALLENGES

## R-1 ★ The batching puzzle (predict the logs)
```tsx
const [count, setCount] = useState(0);

const onPress = () => {
  setCount(count + 1);
  setCount(count + 1);
  console.log(count);        // logs…?
};
```
**Answer:** logs `0`, and count becomes `1` (not 2).
- Both `setCount(count + 1)` read the same snapshot (`count = 0`) → both say "make it 1"
- The `console.log` reads the render's closure — state updates don't rewrite running code
- React **batches**: one re-render, after the handler finishes
- Fix for the increment: `setCount(c => c + 1)` twice → 2. Functional form reads latest
- **Say:** "State is a snapshot per render; setters schedule the NEXT render. Reading state right after setting it always shows the old value — that's not a bug, it's the model."

## R-2 ★ The stale interval (the most famous React puzzle)
```tsx
const [count, setCount] = useState(0);
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);
  return () => clearInterval(id);
}, []);                                    // what does the counter do?
```
**Answer:** goes 0 → 1 and **sticks at 1 forever.**
- The effect ran once; its closure captured `count = 0`. Every tick computes `0 + 1`
- Three fixes, in order of preference:
  1. `setCount(c => c + 1)` — functional update, no stale read (best here)
  2. Add `count` to deps — works, but tears down/recreates the interval every second (smell)
  3. **Latest-ref pattern** (the senior tool for when the callback is complex):
```tsx
const countRef = useRef(count);
useEffect(() => { countRef.current = count; });          // keep ref fresh every render
useEffect(() => {
  const id = setInterval(() => setCount(countRef.current + 1), 1000);
  return () => clearInterval(id);
}, []);                                                   // interval created once, reads live value
```
- **Say:** "Closures freeze values at render time; refs are the escape hatch — a stable box whose `.current` is always live. Functional updates when it's just state; latest-ref when the callback needs more."

## R-3 ★ "Why does my effect run twice?!" (StrictMode — they WILL have this in dev)
- In dev, React **StrictMode intentionally mounts → unmounts → remounts** every component, so
  every effect runs twice on mount
- It's not a bug — it's a **cleanup audit**: if your effect can't survive setup→cleanup→setup,
  it was already broken (missing cleanup, non-idempotent subscribe, duplicate fetch)
- Production runs once. Never "fix" it with a `useRef` did-run flag — fix the cleanup
- **Say:** "Double-invoke in dev is StrictMode stress-testing my cleanup. If it breaks my effect, my effect was leaking — I fix the cleanup, not the symptom."

## R-4 ★ useReducer — when useState stops scaling
```tsx
type Action =
  | { type: 'field'; name: keyof Form; value: string }
  | { type: 'submit' } | { type: 'success' } | { type: 'failure'; errors: FieldErrors };

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'field':   return { ...state, values: { ...state.values, [action.name]: action.value } };
    case 'submit':  return { ...state, status: 'submitting', errors: {} };
    case 'success': return { ...state, status: 'idle', dirty: false };
    case 'failure': return { ...state, status: 'idle', errors: action.errors };
  }
}
const [state, dispatch] = useReducer(reducer, initialForm);
```
- Reach for it when: multiple state vars update **together**, transitions have rules, or you
  want the logic **testable as a pure function** (assert on `reducer(state, action)` — no rendering!)
- Discriminated-union actions = exhaustive switch = compiler-checked transitions
- **Say:** "Three `useState`s that always change together are one `useReducer` in disguise — and the reducer is unit-testable with plain asserts, which fits this interview format perfectly."

## R-5 — Implement `usePrevious` (mini custom-hook challenge)
```tsx
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });   // runs AFTER render — stores for next time
  return ref.current;                           // returns what was stored LAST render
}
// const prevPrice = usePrevious(price);  →  price > prevPrice ? '▲' : '▼'
```
- The trick: effects run *after* render, so during render you read the old value, then it updates
- Tests generics + refs + effect timing in 5 lines — a favorite

## R-6 ★ The race (predict, then fix — your Drill 1.4 in React clothes)
```tsx
useEffect(() => {
  fetch(`/api/user/${id}`).then(r => r.json()).then(setUser);
}, [id]);     // user taps profile A, then quickly profile B. What can go wrong?
```
**Answer:** A's response can land AFTER B's → screen shows B's URL with A's data. Last to
*finish* wins, not last requested.
- Fix (flag or abort — know both):
```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/user/${id}`, { signal: controller.signal })
    .then(r => r.json()).then(setUser)
    .catch(e => { if (e.name !== 'AbortError') setError(e); });
  return () => controller.abort();    // new id → cleanup kills the old request
}, [id]);
```
- **Say:** "Effect cleanup runs before the next effect — that ordering is the hook for cancelling stale work. Flag = ignore the result; AbortController = also save the bandwidth."

## R-7 — Context re-render trap
```tsx
<AppContext.Provider value={{ user, theme, setTheme }}>   // ⚠️ new object EVERY render
```
- Provider's value is a fresh object each render → every consumer re-renders every time,
  even if nothing they use changed
- Fixes: `useMemo` the value object · split contexts (UserContext / ThemeContext) so consumers
  subscribe to only what they need · keep hot data OUT of context entirely
- **Say:** "Context propagates by reference identity like everything else — memoize the value and split by change-frequency."

## R-8 — Error boundaries (the one thing still requiring a class)
- An error boundary catches **render-phase** errors in its subtree and shows a fallback —
  without one, a render error unmounts the whole app
- It's the only remaining class-component use (`componentDidCatch` / `getDerivedStateFromError`);
  no hook equivalent yet — knowing THAT is the senior point
- Scope: does NOT catch event handlers or async errors — those are your try/catch + error state
- **Say:** "Boundaries catch render crashes; async/event errors are handled in state. I wrap feature subtrees so one broken widget doesn't take down the screen — and in practice I grab the tiny `react-error-boundary` package or the app's existing one."

## R-9 — Reset-by-key (the elegant trick most candidates don't know)
```tsx
<ProfileForm key={userId} userId={userId} />
```
- Changing `key` tells React: **different identity → unmount old, mount fresh** — all internal
  state resets, no manual "reset effect" needed
- Exactly SwiftUI's `.id()` — same lever, same use case ("new user = fresh form")
- **Say:** "Key isn't just for lists — it's the identity lever. New key = fresh state, which beats writing a reset effect that chases every field."

---

# SELF-TEST (tonight, 10 minutes, out loud)
1. R-1: why does it log 0, and what's the final count?
2. R-2: why stuck at 1, and name all three fixes.
3. TS-1: write `MyPartial` cold.
4. R-6: describe the race and the AbortController fix without looking.
5. TS-2: one sentence — what does `satisfies` buy over `:` and `as`?

4/5 clean = you're past the bar this round can ask. Sleep.
