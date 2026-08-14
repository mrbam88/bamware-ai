# Top 20 LeetCode-Style Questions — JavaScript, Pattern-First
**Bilal Malik · same 20 problems as the Swift doc, same 8 patterns · JS idioms + JS traps**

Same catalog, same insights — the patterns are language-agnostic. What changes in JavaScript:
the idioms (`Map`, destructuring swaps, `Infinity`), the traps (default `.sort()` is
*lexicographic*, `shift()` is O(n), `==` coerces), and one gift: **LRU Cache collapses to ~20
lines because `Map` remembers insertion order.** TypeScript note for RN-flavored interviews:
these solutions are unchanged — just add annotations (`nums: number[]`, `Map<number, number>`).

**The 8 patterns:** ① hash map/set · ② two pointers · ③ sliding window · ④ stack ·
⑤ linked-list pointer surgery · ⑥ binary search · ⑦ tree/graph traversal · ⑧ DP lite.

**The live protocol (unchanged, still the real deliverable):**
1. Restate + tiny example. 2. Brute force *out loud with complexity*. 3. Name the pattern.
4. Code it. 5. Trace the example. 6. State final complexity. Never silence, never code before step 3.

**JavaScript-specific gotchas (read twice — these burn people live):**
- **`.sort()` compares as STRINGS by default:** `[1, 2, 10].sort()` → `[1, 10, 2]`. Numbers always
  need `(a, b) => a - b`. The single most common live-coding bug in JS.
- **`Map` over plain objects** for counting/caching: any key type, `.size`, guaranteed insertion
  order. Object keys silently coerce to strings (`obj[1]` and `obj["1"]` collide).
- **`arr.shift()` is O(n)** — same disease as Swift's `removeFirst`. BFS with an index pointer or
  whole-level swap.
- **`===` always.** `==` coerces (`0 == ''` is true) and reads as junior.
- Strings are indexable (`s[i]` works! nicer than Swift) but immutable, and `.length` counts UTF-16
  units — `"👨‍👩‍👧‍👦".length === 11`, the same lesson as Swift's grapheme mini from the other doc.
- **No overflow traps** — numbers are doubles; past `Number.MAX_SAFE_INTEGER` (2⁵³−1) you get *silent
  precision loss*, not a crash. Midpoint overflow isn't a thing at array scales; `Math.floor((lo+hi)/2)` is fine.
- `Infinity`/`-Infinity` are first-class initial values for min/max tracking.
- Destructuring swap: `[a, b] = [b, a]`. Nullish counting idiom: `(m.get(k) ?? 0) + 1`
  (`??` only catches null/undefined; `||` would also catch a legitimate `0`).
- Falsy list: `0, '', null, undefined, NaN` — `if (!n)` catches both "missing" and "zero", which
  is sometimes exactly what you want (see Valid Anagram) — *say* you're using it deliberately.

---

## Pattern ① — Hash Map / Set (4 problems)
*Smell: "find a pair/complement," "count things," "group things," "seen before."*
*(Warm-up freebie: Contains Duplicate = `new Set(nums).size !== nums.length`.)*

### 1. Two Sum ★
```javascript
function twoSum(nums, target) {
  const seen = new Map();                       // value → index
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return [];
}
```
O(n) / O(n). **Say:** "Brute force is O(n²) pairs; the Map trades memory for O(1) lookups."
**Trap:** insert *after* checking — else a number matches itself.

### 2. Valid Anagram
```javascript
function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const counts = new Map();
  for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const c of t) {
    const n = counts.get(c);
    if (!n) return false;                       // undefined OR 0 — deliberate falsy use
    counts.set(c, n - 1);
  }
  return true;
}
```
O(n). **Say:** "Count up on one string, down on the other; sorting both is the lazier O(n log n)."

### 3. Group Anagrams
```javascript
function groupAnagrams(strs) {
  const groups = new Map();
  for (const s of strs) {
    const key = [...s].sort().join('');         // canonical key: sorted letters
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.values()];
}
```
O(n·k log k). **Say:** "The design decision is the *key* — sorted string, or a 26-slot count signature for O(n·k)."

### 4. Top K Frequent Elements
```javascript
function topKFrequent(nums, k) {
  const counts = new Map();
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])                // numeric comparator — never bare .sort()!
    .slice(0, k)
    .map(([value]) => value);
}
```
O(n log n). **Say:** "Sort is pragmatic; the optimization to *name* is bucket sort — arrays indexed
by frequency — for O(n)."

---

## Pattern ② — Two Pointers (2 problems)

### 5. Valid Palindrome
```javascript
function isPalindrome(s) {
  const chars = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let left = 0, right = chars.length - 1;
  while (left < right) {
    if (chars[left] !== chars[right]) return false;
    left++;
    right--;
  }
  return true;
}
```
O(n) / O(n) for the cleaned copy. **Say:** "The regex buys clarity; the O(1)-space version skips
non-alphanumerics inside the loop — happy to write it." (Strings index directly in JS — enjoy it.)

### 6. Move Zeroes (read/write pointer)
```javascript
function moveZeroes(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) {
      [nums[read], nums[write]] = [nums[write], nums[read]];
      write++;
    }
  }
}
```
O(n) / O(1), in place. **Say:** "Read/write pointers are the generic in-place filter — same
skeleton as Remove Duplicates from Sorted Array."

---

## Pattern ③ — Sliding Window / One-Pass Tracking (2 problems)

### 7. Best Time to Buy and Sell Stock ★
```javascript
function maxProfit(prices) {
  let minPrice = Infinity;
  let best = 0;
  for (const p of prices) {
    minPrice = Math.min(minPrice, p);
    best = Math.max(best, p - minPrice);
  }
  return best;
}
```
O(n) / O(1). **Trap:** can't sell before buying — that's *why* min-so-far works and
"max(array) − min(array)" doesn't.

### 8. Longest Substring Without Repeating Characters ★
```javascript
function lengthOfLongestSubstring(s) {
  const lastSeen = new Map();
  let start = 0;                                 // left edge of the window
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (lastSeen.has(c) && lastSeen.get(c) >= start) {
      start = lastSeen.get(c) + 1;               // jump past the repeat
    }
    lastSeen.set(c, i);
    best = Math.max(best, i - start + 1);
  }
  return best;
}
```
O(n). **Say:** "Each pointer only moves forward, n times total — linear, not quadratic."
**Trap:** the `>= start` check — repeats *behind* the window don't count.

### 9. Valid Parentheses ★ (Pattern ④ — Stack)
```javascript
function isValid(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const c of s) {
    if (c in pairs) {                            // c is a closer
      if (stack.pop() !== pairs[c]) return false; // pop on empty → undefined → false ✓
    } else {
      stack.push(c);                             // c is an opener
    }
  }
  return stack.length === 0;                     // leftovers = unclosed
}
```
O(n) / O(n). **Say both endgames:** closing an empty stack (undefined mismatch handles it — point
that out) and leftover openers (the final length check). Arrays ARE the stack in JS — push/pop are O(1).

---

## Pattern ⑤ — Linked List Pointer Surgery (3 problems)
*Shared setup:*
```javascript
class ListNode {
  constructor(val = 0, next = null) {
    this.val = val;
    this.next = next;
  }
}
```

### 10. Reverse Linked List ★
```javascript
function reverseList(head) {
  let prev = null;
  let curr = head;
  while (curr) {
    const next = curr.next;    // save before breaking the link
    curr.next = prev;          // flip
    prev = curr;               // advance both
    curr = next;
  }
  return prev;                 // old tail = new head
}
```
O(n) / O(1). **Say:** "Three names — prev, curr, saved next. The save is the whole trick. Draw it first."

### 11. Merge Two Sorted Lists
```javascript
function mergeTwoLists(l1, l2) {
  const dummy = new ListNode(0);   // dummy head kills the "first node" edge cases
  let tail = dummy;
  while (l1 && l2) {
    if (l1.val <= l2.val) { tail.next = l1; l1 = l1.next; }
    else                  { tail.next = l2; l2 = l2.next; }
    tail = tail.next;
  }
  tail.next = l1 ?? l2;            // splice the remainder
  return dummy.next;
}
```
O(n+m) / O(1). **Say "dummy node" out loud** — known senior tell.

### 12. Linked List Cycle (fast & slow)
```javascript
function hasCycle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;   // reference identity — === on objects compares identity
  }
  return false;
}
```
O(n) / O(1). **Say:** "A visited-Set is O(n) space; Floyd's tortoise-and-hare is the O(1) flex —
fast gains one per step, so inside a cycle it must lap slow."

---

## Pattern ⑥ — Binary Search (1 problem)

### 13. Binary Search ★ (the template; variants are edits)
```javascript
function search(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {                       // <= : the one-element window still gets checked
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
```
O(log n). **The bug sites:** `<=` vs `<`, and `mid ± 1` (reusing `mid` = infinite loop). JS bonus
fact: no integer overflow at array scales (doubles are exact to 2⁵³), so the midpoint needs no
special form — *knowing why* is the senior point. **Say:** "Any monotonic yes/no boundary
binary-searches — 'first bad version' is this template with the comparison swapped."

---

## Pattern ⑦ — Trees & Graphs (4 problems)
*Shared setup:*
```javascript
class TreeNode {
  constructor(val = 0, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}
```

### 14. Maximum Depth (recursion in one breath)
```javascript
function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
```
O(n) time, O(height) stack. **Say:** "Every tree DFS is this shape: nil base case, combine
children. Invert Binary Tree is this skeleton with a swap in the middle."

### 15. Level Order Traversal (the BFS template)
```javascript
function levelOrder(root) {
  if (!root) return [];
  const result = [];
  let queue = [root];
  while (queue.length) {
    const level = [];
    const next = [];
    for (const node of queue) {
      level.push(node.val);
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    result.push(level);
    queue = next;                    // whole-level swap: dodges O(n) shift()
  }
  return result;
}
```
O(n) / O(width). **Say:** "I swap whole levels instead of `shift()` because shift is O(n) — and
per-level logic comes free."

### 16. Validate BST (the famous trap)
**Trap:** child-vs-parent checks pass wrong trees — bounds must propagate from *ancestors*.
```javascript
function isValidBST(root) {
  const valid = (node, lo, hi) => {
    if (!node) return true;
    if (lo !== null && node.val <= lo) return false;
    if (hi !== null && node.val >= hi) return false;
    return valid(node.left, lo, node.val) && valid(node.right, node.val, hi);
  };
  return valid(root, null, null);
}
```
O(n) / O(height). **Name the trap unprompted** — that's the score. (Alt: in-order traversal must
come out strictly increasing.)

### 17. Number of Islands (grid DFS)
```javascript
function numIslands(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let islands = 0;

  const sink = (r, c) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] !== '1') return;
    grid[r][c] = '0';
    sink(r + 1, c); sink(r - 1, c); sink(r, c + 1); sink(r, c - 1);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '1') {
        islands++;
        sink(r, c);
      }
    }
  }
  return islands;
}
```
O(rows·cols). **Two things to say:** "guard-first flood fill keeps bounds checks in one place,"
and "this mutates the input — I'd flag that and clone or use a visited-Set if the caller keeps the
grid." (Huge grids → BFS queue to dodge recursion depth.)

---

## Pattern ⑧ — DP Lite (2 problems)

### 18. Climbing Stairs
```javascript
function climbStairs(n) {
  if (n <= 2) return n;
  let twoBack = 1;
  let oneBack = 2;
  for (let i = 3; i <= n; i++) {
    [oneBack, twoBack] = [oneBack + twoBack, oneBack];
  }
  return oneBack;
}
```
O(n) / O(1). **Say:** "ways(n) = ways(n−1) + ways(n−2) — Fibonacci in a costume; the memo
collapses to two variables."

### 19. Maximum Subarray — Kadane's ★
```javascript
function maxSubArray(nums) {
  let best = nums[0];
  let current = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);  // extend, or start fresh here
    best = Math.max(best, current);
  }
  return best;
}
```
O(n) / O(1). **The insight sentence IS the algorithm:** "a negative running sum is dead weight —
drop it." **Trap:** all-negative arrays (this handles them; a max-with-0 variant doesn't).

---

## The Design Question

### 20. LRU Cache ★ — the JavaScript gift
In Swift this needed a hand-rolled doubly-linked list. In JS, **`Map` iterates in insertion
order**, and delete+set moves a key to the back — that *is* the recency list:
```javascript
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();            // insertion order = recency order
  }

  get(key) {
    if (!this.map.has(key)) return -1;
    const val = this.map.get(key);
    this.map.delete(key);            // refresh recency:
    this.map.set(key, val);          // delete + re-insert = move to "most recent"
    return val;
  }

  put(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size === this.capacity) {
      const oldest = this.map.keys().next().value;   // first key = least recent
      this.map.delete(oldest);
    }
    this.map.set(key, value);
  }
}
```
O(1) / O(capacity). **Say:** "The classic answer is hash map + doubly-linked list — that's exactly
what Map gives me for free here, since it maintains insertion order with O(1) delete and append.
If you'd like the explicit DLL version I can write it — it's the same structure with the pointers
exposed." That sentence proves you know the *real* algorithm AND the idiom. iOS tie-in you can
still use: "this is the algorithmic core of a thumbnail cache — NSCache on iOS, this in a RN layer."

---

## The 3-Day Plan (same as the Swift doc — pick ONE language per day, don't interleave)

- **Day 1:** Patterns ①–④ (1–9). Read the insight, cover the code, write it yourself.
- **Day 2:** Patterns ⑤–⑦ (10–17). Linked lists on paper first — arrows, then code.
- **Day 3:** ⑧ + LRU, then **redo the seven ★ blind**, 20 minutes each, narrating.
- 20-minute cap per problem. Stuck past that: read the solution, move on, re-attempt tomorrow.

**Which language in which room:** iOS/Medal-style interviews → Swift doc. Full-stack/RN-flavored
rounds → this one (and mention TypeScript types unprompted). The patterns transfer 1:1 — that's
the point of learning patterns instead of problems. If you can solve it in one language and
*translate* it live, that's a stronger signal than having memorized both.

