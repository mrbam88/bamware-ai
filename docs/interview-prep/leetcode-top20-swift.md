# Top 20 LeetCode-Style Questions — Swift, Pattern-First
**Bilal Malik · for the weakest muscle · 20 problems, 8 patterns, every solution complete**

You're not bad at algorithms — you're out of reps on a narrow, learnable catalog. The trick:
**stop learning problems, learn the 8 patterns.** Every problem below is labeled with its
pattern; once you can *name the pattern from the problem statement*, the code writes itself.

**The 8 patterns:** ① hash map/set (trade memory for lookup) · ② two pointers (walk from the
ends or read/write) · ③ sliding window (grow right, shrink left) · ④ stack (most-recent-first
matching) · ⑤ linked list pointer surgery · ⑥ binary search (halve the sorted space) ·
⑦ tree/graph traversal (DFS recursion, BFS queue) · ⑧ dynamic programming lite (carry the best
answer so far).

**The live protocol when this is your weak spot** (this matters more than the solutions):
1. Restate the problem + invent a tiny example. 2. **Say the brute force with its complexity**
("naive is O(n²) — check every pair") — this banks points immediately and is your safety net.
3. Pattern-match out loud: "pairs + lookups smells like a hash map." 4. Code the pattern.
5. Trace your example through the code, out loud. 6. State final complexity. Never silence,
never code before step 3.

**Swift-specific interview gotchas (read twice — these burn people live):**
- **Strings: convert first.** `let chars = Array(s)` — Swift has no `s[0]`; String.Index live is a time sink.
- `counts[key, default: 0] += 1` — the counting idiom.
- `Array.removeFirst()` is **O(n)** — for BFS queues, iterate an index or swap whole levels instead.
- No built-in heap/queue — say "in production I'd use `Heap`/`Deque` from swift-collections; here I'll sort.
- Node identity is `===`. In-place mutation = `inout` + `swapAt`.
- Midpoint without overflow: `lo + (hi - lo) / 2`.
- Complexity smell test: n ~ 10⁵ needs O(n log n) or better; O(n²) at 10⁵ = ~10¹⁰ ops = too slow.

---

## Pattern ① — Hash Map / Set (4 problems)
*Smell: "find a pair/complement," "count things," "group things," "have I seen this before."*
*(Warm-up freebie: Contains Duplicate = `Set(nums).count != nums.count`. That's the whole pattern in one line.)*

### 1. Two Sum ★ (the most asked question on earth)
Indices of the two numbers summing to target.
**Insight:** for each number, ask "have I already *seen* my complement?" — a dictionary answers in O(1).
```swift
func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
    var seen: [Int: Int] = [:]                    // value → index
    for (i, n) in nums.enumerated() {
        if let j = seen[target - n] { return [j, i] }
        seen[n] = i
    }
    return []
}
```
O(n) time, O(n) space. **Say:** "Brute force is O(n²) pairs; the dictionary trades O(n) memory to make each lookup O(1)." **Trap:** insert *after* checking, or you'll match a number with itself.

### 2. Valid Anagram
Same letters, same counts?
**Insight:** count one string up, count the other down; any miss = false.
```swift
func isAnagram(_ s: String, _ t: String) -> Bool {
    guard s.count == t.count else { return false }
    var counts: [Character: Int] = [:]
    for c in s { counts[c, default: 0] += 1 }
    for c in t {
        guard let n = counts[c], n > 0 else { return false }
        counts[c] = n - 1
    }
    return true
}
```
O(n) / O(1)-ish (bounded alphabet). **Say:** "Sorting both works in O(n log n) — counting beats it."

### 3. Group Anagrams
Bucket words that are anagrams of each other.
**Insight:** anagrams share a canonical key — the sorted word. Group by key.
```swift
func groupAnagrams(_ strs: [String]) -> [[String]] {
    var groups: [String: [String]] = [:]
    for s in strs { groups[String(s.sorted()), default: []].append(s) }
    return Array(groups.values)
}
```
O(n·k log k). **Say:** "The move is designing the *key* — sorted string, or a 26-count signature for O(n·k)."

### 4. Top K Frequent Elements
The k most common values.
```swift
func topKFrequent(_ nums: [Int], _ k: Int) -> [Int] {
    var counts: [Int: Int] = [:]
    for n in nums { counts[n, default: 0] += 1 }
    return counts.sorted { $0.value > $1.value }.prefix(k).map(\.key)
}
```
O(n log n). **Say:** "Sort is the pragmatic answer; the optimization to *name* is bucket sort — index buckets by frequency for O(n) — or a size-k heap."

---

## Pattern ② — Two Pointers (2 problems)
*Smell: "palindrome," "sorted array + pair," "in place," "from both ends."*

### 5. Valid Palindrome
Alphanumerics only, case-insensitive.
```swift
func isPalindrome(_ s: String) -> Bool {
    let chars = Array(s.lowercased().filter { $0.isLetter || $0.isNumber })
    var left = 0, right = chars.count - 1
    while left < right {
        if chars[left] != chars[right] { return false }
        left += 1
        right -= 1
    }
    return true
}
```
O(n) / O(n) for the cleaned copy. **Say:** "I'm buying clarity with the filtered copy; the O(1)-space version skips non-alphanumerics inside the loop — happy to write it if you want."

### 6. Move Zeroes (the read/write pointer — in-place workhorse)
All zeros to the end, order of the rest preserved, in place.
**Insight:** `write` marks where the next non-zero belongs; `read` scans.
```swift
func moveZeroes(_ nums: inout [Int]) {
    var write = 0
    for read in nums.indices where nums[read] != 0 {
        nums.swapAt(read, write)
        write += 1
    }
}
```
O(n) / O(1). **Say:** "Read/write pointers are the generic in-place filter — same skeleton solves Remove Duplicates from Sorted Array."

---

## Pattern ③ — Sliding Window / One-Pass Tracking (2 problems)
*Smell: "longest/shortest substring or subarray with a property," "best single transaction."*

### 7. Best Time to Buy and Sell Stock ★
One buy, one sell, max profit.
**Insight:** at each price, the best sale is (price − cheapest price so far). Track both in one pass.
```swift
func maxProfit(_ prices: [Int]) -> Int {
    var minPrice = Int.max
    var best = 0
    for p in prices {
        minPrice = min(minPrice, p)
        best = max(best, p - minPrice)
    }
    return best
}
```
O(n) / O(1). **Trap:** you can't sell before you buy — that's *why* min-so-far works and "max − min of whole array" doesn't.

### 8. Longest Substring Without Repeating Characters ★
```swift
func lengthOfLongestSubstring(_ s: String) -> Int {
    let chars = Array(s)
    var lastSeen: [Character: Int] = [:]
    var start = 0                                  // left edge of the window
    var best = 0
    for (i, c) in chars.enumerated() {
        if let prev = lastSeen[c], prev >= start { // repeat INSIDE the window?
            start = prev + 1                       // jump the left edge past it
        }
        lastSeen[c] = i
        best = max(best, i - start + 1)
    }
    return best
}
```
O(n) / O(min(n, alphabet)). **Say:** "Sliding window: right edge always advances, left edge only advances — each pointer moves n times total, so it's linear, not quadratic." **Trap:** the `prev >= start` check — a repeat *behind* the window doesn't count.

---

## Pattern ④ — Stack (1 problem)
*Smell: "matching pairs," "most recent unclosed thing," "undo."*

### 9. Valid Parentheses ★
```swift
func isValid(_ s: String) -> Bool {
    let pairs: [Character: Character] = [")": "(", "]": "[", "}": "{"]
    var stack: [Character] = []
    for c in s {
        if let expectedOpen = pairs[c] {           // c is a closer
            guard stack.popLast() == expectedOpen else { return false }
        } else {                                   // c is an opener
            stack.append(c)
        }
    }
    return stack.isEmpty                           // leftovers = unclosed
}
```
O(n) / O(n). **Traps (both endgames):** closing an empty stack (`popLast()` returns nil → the guard handles it — say so) and leftover openers (the final `isEmpty`).

---

## Pattern ⑤ — Linked List Pointer Surgery (3 problems)
*Smell: the word "linked list." Shared setup:*
```swift
final class ListNode {
    var val: Int
    var next: ListNode?
    init(_ val: Int, _ next: ListNode? = nil) { self.val = val; self.next = next }
}
```

### 10. Reverse Linked List ★ (THE most common warm-up)
**Insight:** walk the list flipping each `next` backward; three names: `prev`, `curr`, and a saved `next`.
```swift
func reverseList(_ head: ListNode?) -> ListNode? {
    var prev: ListNode? = nil
    var curr = head
    while let node = curr {
        let next = node.next     // save before breaking the link
        node.next = prev         // flip
        prev = node              // advance both
        curr = next
    }
    return prev                  // old tail = new head
}
```
O(n) / O(1). **Say:** "Draw it before coding it — three boxes, one arrow flip. The saved `next` is the whole trick." Recursion exists but O(n) stack — mention, don't prefer.

### 11. Merge Two Sorted Lists
**Insight:** a dummy head kills all the "is this the first node?" edge cases.
```swift
func mergeTwoLists(_ l1: ListNode?, _ l2: ListNode?) -> ListNode? {
    let dummy = ListNode(0)
    var tail = dummy
    var a = l1, b = l2
    while let x = a, let y = b {
        if x.val <= y.val { tail.next = x; a = x.next }
        else              { tail.next = y; b = y.next }
        tail = tail.next!
    }
    tail.next = a ?? b           // splice whatever's left
    return dummy.next
}
```
O(n+m) / O(1). **Say "dummy node" out loud** — it's a known senior tell on list problems.

### 12. Linked List Cycle (fast & slow pointers)
**Insight:** tortoise and hare — fast gains one step per round; in a cycle it must lap slow.
```swift
func hasCycle(_ head: ListNode?) -> Bool {
    var slow = head
    var fast = head
    while fast != nil && fast?.next != nil {
        slow = slow?.next
        fast = fast?.next?.next
        if slow === fast { return true }     // identity, not value!
    }
    return false                             // fast hit the end → no cycle
}
```
O(n) / O(1). **Say:** "The Set-of-visited-nodes version is O(n) space; Floyd's is the O(1) flex. `===` because two nodes can share a value."

---

## Pattern ⑥ — Binary Search (1 problem)
*Smell: "sorted" + "find" — or any monotonic yes/no boundary (first bad version, capacity search).*

### 13. Binary Search ★ (nail the template; variants are edits)
```swift
func search(_ nums: [Int], _ target: Int) -> Int {
    var lo = 0
    var hi = nums.count - 1
    while lo <= hi {                          // <= : the one-element window still gets checked
        let mid = lo + (hi - lo) / 2          // overflow-safe midpoint
        if nums[mid] == target { return mid }
        if nums[mid] < target { lo = mid + 1 } else { hi = mid - 1 }
    }
    return -1
}
```
O(log n) / O(1). **The three bug sites to name:** `<=` vs `<`, `mid ± 1` (never `mid` — infinite loop), midpoint overflow. **Say:** "Any monotonic predicate binary-searches — 'find the first version that fails' is this exact template with the comparison swapped."

---

## Pattern ⑦ — Trees & Graphs (4 problems)
*Smell: "tree" → recursion (DFS) by default, queue (BFS) for anything "level by level." Setup:*
```swift
final class TreeNode {
    var val: Int
    var left: TreeNode?
    var right: TreeNode?
    init(_ val: Int) { self.val = val }
}
```

### 14. Maximum Depth of Binary Tree (recursion in one breath)
```swift
func maxDepth(_ root: TreeNode?) -> Int {
    guard let root else { return 0 }
    return 1 + max(maxDepth(root.left), maxDepth(root.right))
}
```
O(n) time, O(height) stack. **Say:** "Every tree DFS is this shape: base case on nil, combine children's answers. Invert Binary Tree is the same skeleton with a swap in the middle."

### 15. Binary Tree Level Order Traversal (the BFS template)
```swift
func levelOrder(_ root: TreeNode?) -> [[Int]] {
    guard let root else { return [] }
    var result: [[Int]] = []
    var queue: [TreeNode] = [root]
    while !queue.isEmpty {
        var level: [Int] = []
        var next: [TreeNode] = []
        for node in queue {
            level.append(node.val)
            if let l = node.left  { next.append(l) }
            if let r = node.right { next.append(r) }
        }
        result.append(level)
        queue = next                    // whole-level swap: dodges O(n) removeFirst
    }
    return result
}
```
O(n) / O(width). **Say:** "I swap whole levels instead of `removeFirst` because Swift's removeFirst is O(n) — and it makes 'per-level' logic free."

### 16. Validate Binary Search Tree (the famous trap)
**Trap:** checking each node only against its *parent* passes wrong trees — a right-subtree node
must beat its *grandparent's* lower bound too. Propagate (min, max) bounds down.
```swift
func isValidBST(_ root: TreeNode?) -> Bool {
    func valid(_ node: TreeNode?, _ lo: Int?, _ hi: Int?) -> Bool {
        guard let node else { return true }
        if let lo, node.val <= lo { return false }
        if let hi, node.val >= hi { return false }
        return valid(node.left, lo, node.val) && valid(node.right, node.val, hi)
    }
    return valid(root, nil, nil)
}
```
O(n) / O(height). **Say the trap before they ask** — naming it unprompted is the whole score. (Alt framing: in-order traversal must come out strictly increasing.)

### 17. Number of Islands (grid DFS — the graph gateway)
**Insight:** each '1' you haven't visited = a new island; flood-fill ("sink") it so it's never counted again.
```swift
func numIslands(_ grid: [[Character]]) -> Int {
    var grid = grid
    let rows = grid.count
    let cols = grid.first?.count ?? 0
    var islands = 0

    func sink(_ r: Int, _ c: Int) {
        guard r >= 0, r < rows, c >= 0, c < cols, grid[r][c] == "1" else { return }
        grid[r][c] = "0"
        sink(r + 1, c); sink(r - 1, c); sink(r, c + 1); sink(r, c - 1)
    }

    for r in 0..<rows {
        for c in 0..<cols where grid[r][c] == "1" {
            islands += 1
            sink(r, c)
        }
    }
    return islands
}
```
O(rows·cols). **Say:** "Guard-first flood fill keeps bounds checking in ONE place. For huge grids I'd switch to BFS with a queue to avoid recursion depth."

---

## Pattern ⑧ — DP Lite (2 problems)
*Smell: "how many ways," "maximum/minimum over a sequence" — and the answer at step i depends on earlier steps.*

### 18. Climbing Stairs (DP with training wheels)
1 or 2 steps at a time; how many ways to reach step n?
**Insight:** ways(n) = ways(n−1) + ways(n−2) — Fibonacci in a costume. Keep two variables, not an array.
```swift
func climbStairs(_ n: Int) -> Int {
    if n <= 2 { return n }
    var twoBack = 1, oneBack = 2
    for _ in 3...n {
        (oneBack, twoBack) = (oneBack + twoBack, oneBack)
    }
    return oneBack
}
```
O(n) / O(1). **Say:** "Naive recursion is exponential from recomputing; I only ever need the last two answers, so the memo collapses to two variables."

### 19. Maximum Subarray — Kadane's ★
Largest sum of any contiguous run (negatives allowed).
**Insight:** at each element: extend the running sum, or abandon it and start fresh — whichever is bigger.
```swift
func maxSubArray(_ nums: [Int]) -> Int {
    var best = nums[0]
    var current = nums[0]
    for n in nums.dropFirst() {
        current = max(n, current + n)     // extend, or start over here
        best = max(best, current)
    }
    return best
}
```
O(n) / O(1). **Say the insight sentence** — "a negative running sum is dead weight; drop it" — that's the entire algorithm. **Trap:** all-negative arrays (this handles them; a `current = max(0, …)` variant doesn't).

---

## The Design Question

### 20. LRU Cache ★ (and it's *your* domain — this is a thumbnail cache)
O(1) `get` and `put` with eviction of the least-recently-used.
**Insight:** dictionary for O(1) lookup + doubly-linked list for O(1) reordering; sentinels kill edge cases.
```swift
final class LRUCache {
    private final class Node {
        let key: Int
        var val: Int
        var prev: Node?
        var next: Node?
        init(_ key: Int, _ val: Int) { self.key = key; self.val = val }
    }

    private let capacity: Int
    private var map: [Int: Node] = [:]
    private let head = Node(0, 0)          // sentinel: most-recent side
    private let tail = Node(0, 0)          // sentinel: least-recent side

    init(_ capacity: Int) {
        self.capacity = capacity
        head.next = tail
        tail.prev = head
    }

    private func remove(_ node: Node) {
        node.prev?.next = node.next
        node.next?.prev = node.prev
    }
    private func moveToFront(_ node: Node) {
        node.next = head.next
        node.prev = head
        head.next?.prev = node
        head.next = node
    }

    func get(_ key: Int) -> Int {
        guard let node = map[key] else { return -1 }
        remove(node)
        moveToFront(node)
        return node.val
    }

    func put(_ key: Int, _ value: Int) {
        if let node = map[key] {
            node.val = value
            remove(node)
            moveToFront(node)
            return
        }
        if map.count == capacity, let lru = tail.prev, lru !== head {
            remove(lru)
            map[lru.key] = nil
        }
        let node = Node(key, value)
        map[key] = node
        moveToFront(node)
    }
}
```
O(1) / O(capacity). **Your unfair advantage — say it:** "In production this is `NSCache` (thread-safe,
memory-pressure-aware) or my actor-based thumbnail cache with in-flight-task memoization — this DLL+dictionary
is the algorithmic core of both." **Swift footnote worth a point:** the prev/next pointers form retain
cycles — fine for an interview, but in shipping code you'd break links on removal or make `prev` weak.

---

## The 3-Day Plan (interview is this week)

- **Day 1:** Patterns ①–④ (problems 1–9). Read the insight, cover the code, write it yourself.
- **Day 2:** Patterns ⑤–⑦ (10–17). Linked lists on paper FIRST — draw the arrows, then code.
- **Day 3:** ⑧ + LRU (18–20), then **redo the seven ★ problems blind**, 20 minutes each, narrating.
- Any problem you fail blind: that's tomorrow's warm-up. 20-minute cap — stuck past that, read the
  solution and move on; grinding builds frustration, not pattern memory.

**Honest calibration:** Medal's stated format is code-*reasoning* and product-flavored building, not
LeetCode — so this doc is your floor, not your ceiling. If an algorithm appears, it'll likely be
practical (dedupe a feed = ①, cache = 20, paginate = ⑥-adjacent). The live protocol at the top is
the real deliverable: brute-force-first, pattern named out loud, one traced example. A senior who
narrates a simple solution cleanly beats a mid who silently attempts a clever one — every time.

