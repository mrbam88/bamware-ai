# TS + React Crash Course — Senior Basics, Interview Edition
**Bilal Malik · the stuff they love to ask · ★ = highest probability tomorrow**

---

# PART 1 — TYPESCRIPT

## ★ 1. `type` vs `interface`
```ts
interface Clip { id: string; title: string }     // extendable, declaration-merging
type Clip = { id: string; title: string }        // also does unions, primitives, tuples
```
- 95% interchangeable. `interface` can `extends` and merge; `type` can do unions (`type X = A | B`) — interface can't
- **Say:** "I default to `type` for flexibility, `interface` for public object shapes — and I match the codebase."

## ★ 2. Discriminated unions (THE TS interview pattern)
```ts
type FetchState =
  | { status: 'loading' }
  | { status: 'loaded'; data: Clip[] }
  | { status: 'error'; message: string };

switch (state.status) {
  case 'loaded': return state.data.length;      // TS KNOWS data exists here
  case 'error':  return state.message;          // and message here
}
```
- The `status` literal is the discriminant — checking it **narrows** the type per branch
- Kills the classic bug: `isLoading && error && data` combinations that can't all be true
- **Say:** "I model state as a discriminated union so impossible states are unrepresentable."

## ★ 3. Narrowing (how TS learns what something is)
```ts
function handle(e: unknown) {
  if (e instanceof Error) e.message;            // instanceof narrows classes
  if (typeof e === 'string') e.toUpperCase();   // typeof narrows primitives
}
if ('retryable' in error) { ... }               // 'in' narrows by property
if (clip) { clip.title }                        // truthiness narrows away null/undefined
```
- Custom type guard (worth knowing the syntax):
```ts
function isClip(x: unknown): x is Clip {
  return typeof x === 'object' && x !== null && 'id' in x;
}
```

## ★ 4. `unknown` vs `any` (guaranteed question)
- `any` = **opt out of type checking** — anything compiles, bugs flow through silently
- `unknown` = "I don't know yet, and you must **prove** what it is before using it" (narrowing required)
- `catch (e)` is `unknown` for exactly this reason
- **Say:** "`unknown` is the safe any — same flexibility receiving, but forces narrowing before use. `any` is a code-review flag."
- Bonus: `never` = "can't happen" — used for exhaustive switches:
```ts
default: { const _exhaustive: never = state; }  // compile ERROR if a case is missing
```

## ★ 5. Generics — write once, keep types
```ts
function first<T>(arr: T[]): T | undefined { return arr[0]; }
first([1, 2, 3]);          // T inferred as number
first(clips);              // T inferred as Clip

function getById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(i => i.id === id);          // extends = constraint: T must have id
}
```
- **Say:** "Generics preserve the relationship between input and output types — without them you'd return `any` and lose safety."

## ★ 6. Utility types (the toolbox — know these six)
```ts
type Profile = { name: string; email: string; age: number };

Partial<Profile>          // all optional → patches, form errors
Required<Profile>         // all required
Pick<Profile, 'name'>     // just these fields
Omit<Profile, 'age'>      // everything but
Record<string, number>    // dictionary: keys → values
keyof Profile             // 'name' | 'email' | 'age' (union of key names)
ReturnType<typeof fn>     // the type fn returns
```
- Composed example you've seen: `Partial<Record<keyof Profile, string>>` = per-field error map, all optional, no typos possible

## 7. Optionals & nullish
```ts
user?.address?.city            // optional chaining: undefined if any link missing
count ?? 0                     // nullish coalescing: default ONLY for null/undefined
count || 0                     // ⚠️ also defaults on 0 and '' — usually a bug for numbers
function f(x?: number) {}      // optional param = number | undefined
```

## 8. `as const` + literal types
```ts
const ranges = ['1D', '1M', '1Y'] as const;     // readonly tuple of literals
type Range = typeof ranges[number];              // '1D' | '1M' | '1Y' — derived, stays in sync
```
- **Say:** "I derive types from values with `as const` + `typeof` so there's one source of truth."

## 9. Typing functions & async
```ts
type OnSelect = (clip: Clip) => void;                    // callback type
async function load(): Promise<Clip[]> { ... }           // async ALWAYS returns Promise<T>
const fmt = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
```

---

# PART 2 — REACT

## ★ 1. The mental model (say this before any React answer)
- **UI = f(state).** State changes → component re-renders → React diffs the new tree vs old → patches only what changed
- You never mutate the UI; you change state and describe the result
- Corollaries: renders must be cheap + pure · mutation breaks change detection · identity (keys, references) is how React tells "same" from "new"
- (Coming from Swift: this is SwiftUI's model — `body` = render, `@State` = useState, structural identity = keys)

## ★ 2. useState — the three rules
```ts
const [clips, setClips] = useState<Clip[]>([]);

setCount(c => c + 1);                       // 1. functional form when new depends on old
setClips([...clips, newClip]);              // 2. NEVER mutate — new array/object every time
setUser({ ...user, name: 'Bilal' });        //    spread = copy with changes
// 3. setState is async-ish & batched — reading `count` right after setCount shows the OLD value
```
- Why no mutation: React compares **references**. `clips.push(x)` = same reference = "nothing changed" = no re-render. #1 junior bug

## ★ 3. useEffect — honestly
```ts
useEffect(() => {
  const sub = subscribe(id, handleEvent);     // side effect: sync with outside world
  return () => sub.remove();                  // cleanup: runs before re-run AND on unmount
}, [id]);                                     // deps: every reactive value the effect READS
```
- Deps rules: `[]` = once on mount · `[id]` = mount + whenever id changes · missing = every render (almost never right)
- Lying about deps = stale closures. The lint rule is right; restructure instead of silencing
- Async effects: inner function pattern (effect must return cleanup, not a Promise)
- **Say:** "Effects are for synchronizing with external systems — network, subscriptions, timers. If there's no external system, I probably don't need an effect."

## ★ 4. Derived state — DON'T store what you can compute
```ts
// ❌ const [total, setTotal] = useState(0);  + an effect to sync it  ← interview trap
// ✅ compute during render:
const total = holdings.reduce((sum, h) => sum + h.valueCents, 0);
const visible = clips.filter(c => c.title.includes(query));
```
- Mirrored state desyncs; computed values can't. If it's expensive, wrap in `useMemo` — but compute-first is the default
- **This is a top-3 React interview probe** ("do they reach for useState+useEffect when a plain expression works?")

## ★ 5. useRef — the mutable box that doesn't render
```ts
const intervalRef = useRef<number | null>(null);   // survives renders, changing it ≠ re-render
const inputRef = useRef<TextInput>(null);          // or a handle to a native component
```
- State = data the UI shows. Ref = data the component *remembers* (timer ids, timestamps, previous values, DOM/native handles)
- Your stopwatch used both correctly — that split IS the question

## ★ 6. The identity trilogy — memo, useMemo, useCallback
```ts
const Row = React.memo(RowComponent);            // skip re-render if props are shallow-equal
const sorted = useMemo(() => [...clips].sort(byDate), [clips]);   // cache a VALUE
const onLike = useCallback(id => api.like(id), []);               // cache a FUNCTION's identity
```
- All three exist because **new references defeat shallow comparison** — arrays/objects/functions are recreated each render
- Use when something downstream watches references (memo child, effect deps, custom hook). Not by reflex
- **Say:** "Memoization is about reference identity, not speed. I add it when a consumer compares references — and I profile before sprinkling it."

## ★ 7. Keys (list identity)
```ts
{clips.map(c => <Row key={c.id} clip={c} />)}    // stable server id
```
- Keys tell the diff which row is which across updates: wrong keys = recycled state on wrong rows, broken animations
- `key={index}` breaks on insert/remove/reorder — say why: identity follows position, not data
- Same lesson as SwiftUI's `ForEach` id — one mental model, two frameworks

## 8. Lifting state — up AND down
- **Up:** two components need the same state → move it to their closest common parent, pass down + callbacks up
- **Down:** frequently-changing state (your timer) lives as LOW as possible so ticks don't re-render the world
- **Say:** "State lives at the lowest common ancestor of everyone who needs it — no lower, no higher."

## 9. Controlled inputs (forms)
```tsx
const [name, setName] = useState('');
<TextInput value={name} onChangeText={setName} />   // state is the single source of truth
```
- Controlled = React owns the value (validate/transform/reset freely). That + `Partial` field errors + submit states = the whole profile-form exercise

## 10. Custom hooks — the reuse unit
```ts
function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);                  // reset on every change = debounce
  }, [value, ms]);
  return debounced;
}
// usage: const q = useDebouncedValue(query, 300);  // fires searches on quiet, not keystrokes
```
- A custom hook = a function using hooks — shares LOGIC, not UI. Extracting one live ("let me pull this into useHoldings") is a big senior move
- Rules of hooks (know cold): call only at top level (no ifs/loops), only from components/hooks — because React tracks hooks **by call order**

## 11. Context — DI, not state management
```tsx
const AuthContext = createContext<User | null>(null);
<AuthContext.Provider value={user}>...</AuthContext.Provider>
const user = useContext(AuthContext);              // any depth, no prop drilling
```
- For rarely-changing cross-cutting values: auth, theme, config
- Cost: every value change re-renders **all consumers** — not for fast-changing data
- **Say:** "Context is dependency injection, not a state manager — for hot data I keep state local or reach for a store."

---

# THE BUG LIST (rapid-fire — name the bug on sight)
- `setCount(count + 1)` twice in a row → only +1 (stale value; use functional form)
- `clips.push(x); setClips(clips)` → no re-render (mutation, same reference)
- `useEffect(async () => …)` → cleanup swallowed by the Promise
- Missing cleanup → zombie interval/subscription after unmount
- `useEffect` with missing dep → stale closure reads frozen values
- New object/fn prop every render → `React.memo` child re-renders anyway (identity)
- `key={index}` + reorder → state glued to the wrong rows
- useState+useEffect to mirror a computable value → derived-state trap
- Effect that sets state it also depends on → render loop

*Everything here compounds: identity (2, 6, 7) + closures (1, 5) + lifecycle (3, 4) are the same three ideas wearing nine costumes. Know the three ideas, and tomorrow every question is a rerun.*
