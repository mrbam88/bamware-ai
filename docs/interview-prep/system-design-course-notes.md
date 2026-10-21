# System design — course notes and tutor guide

**What this is.** A study guide that follows the syllabus of LeetCode's paid course
*System Design for Interviews and Beyond* (16 chapters, 81 lessons; the two
Practice chapters are parts 1 and 2, merged here as section 14). Bilal bought
it and found the videos too long. It's here so any agent can tutor him through
the same topics.

**What this is not.** It's not a copy of the course. The section and lesson
titles match the course. Every explanation, example and number below was
written by an agent from general system-design knowledge. Where the course has
its own examples or framing, those aren't captured here. The original slides
and videos are on LeetCode under Bilal's account if a detail matters.

**Added:** 2026-10-21, at Bilal's explicit request (an exception to "the bank is
closed", like `ai-basics-for-mobile-devs.md`: no existing doc covered backend
system design; `mobile-system-design-cheatsheet.md` covers only the client side).

---

## How to tutor Bilal from this doc

- **Teach one lesson at a time.** Explain it in 3–5 short sentences of plain
  words, then ask **one** question. Move on only when he can say it back.
- **Use RN, Node and Express analogies.** They land faster than abstract ones.
  Example: a queue is like an Express handler that pushes a job onto Redis and
  returns `202` right away.
- **Reps beat reading** (from the prep index). Have him say each mechanism out
  loud. Don't hand him paragraphs.
- **Mix in a mini design problem** every 2–3 chapters, built from what he's
  covered so far.
- **Track progress** in the checklist at the bottom of this doc. Tick lessons
  off with a commit.
- The **★ lessons** are the ones interviewers ask about most. If time is short,
  do those first.
- **This doc is the trusted syllabus.** Agents building drills and exercises
  should stay inside these topics and treat the explanations here as correct.
  Add depth from your own knowledge freely, but if you find something here that
  is wrong, fix it in this file (with a commit), don't silently teach around it.
- **Drill seeds** are at the end of each chapter. They are starting points for
  drills, not a full list.
- **Coverage check (2026-10-21):** every one of the course's 81 lessons maps to
  a heading below; lesson titles were matched against the course's own list.

---

## 0. Introduction (3 lessons)

**Course introduction / who it's for / course overview.**
- In an interview, nobody expects you to know every detail of a real system.
  They want to see you use **common building blocks** and explain the
  **trade-offs** as you go.
- The course order: define requirements → pick hardware → learn how the parts
  talk to each other → queues → storage → deliver data reliably, quickly and
  at scale → protect the system from overload → practice problems.
- The core skill is the thinking process: requirement → concept → trade-off →
  decision.

---

## 1. How to define system requirements (10 lessons)

**1.1 System requirements ★**
- Every design starts with two lists. **Functional**: what the system does
  ("users can upload a photo"). **Non-functional**: how well it does it (fast,
  always up, can grow, never loses data).
- In an interview, spend the first 5 minutes agreeing on both lists. Every
  later choice should point back to one of them.

**1.2 Functional requirements**
- Write them as verbs on things: `createShortUrl(longUrl)`, `getFeed(userId)`.
  Those turn into your API.
- Cut the scope out loud: "I'll skip analytics and auth unless you want them."

**1.3 High availability ★**
- **Time-based availability**: the share of time the system is up. 99% up
  means about 3.65 days down per year. 99.9% means about 8.8 hours. 99.99%
  means about 53 minutes.
- **Count-based availability**: the share of requests that succeed. 1 failure
  in 100 requests means 99%. This is closer to what users actually feel.
- **High availability isn't a number. It comes from how you build and run the
  system.** One server that hasn't failed this week is not highly available.
  100% is almost never worth what it costs.
- How you build for it: **redundancy** (no single point of failure: multiple
  regions or zones, copies of the data, fallbacks), **failure detection**
  (health checks), **automatic failover**, and **graceful degradation**
  (serve something reduced instead of an error).
- How you run it: monitoring and alerts, on-call, slow rollouts, the ability
  to roll back, and practicing failures on purpose.
- **SLO** (service level objective) is the internal target, e.g. "99.9% of
  requests succeed over 30 days". **SLA** (service level agreement) is the
  promise to customers, with a penalty if it's missed. The SLA is looser than
  the SLO.

**1.4 Fault tolerance, resilience, reliability**
- **Fault tolerance**: the system keeps working while a part is broken, like
  a plane flying on one engine.
- **Resilience**: the system recovers quickly after a failure, back to normal
  on its own.
- **Reliability**: the system does the *correct* thing over time. A system can
  be up (available) and still return wrong answers (unreliable).

**1.5 Scalability ★**
- The system can handle more load by adding resources, without a redesign.
- **Vertical** scaling means a bigger machine: simple, but there's a ceiling
  and it's a single point of failure. **Horizontal** scaling means more
  machines: no ceiling, but now you need load balancing, splitting the data,
  and keeping state in sync.
- Load can grow in different directions: requests per second, data size,
  number of users, how big each request is. Say which one you mean.
- The trick: make the app servers **stateless** (keep sessions in Redis or a
  database) so you can add or remove servers freely.

**1.6 Performance ★**
- **Latency**: how long one request takes. Measure it with percentiles. p50
  is the typical request. **p99** is the slowest 1%, and those are often your
  most valuable users with the most data.
- **Throughput**: how many requests per second the system handles.
- Latency and throughput pull against each other. Batching raises throughput
  but adds latency.
- Rough numbers worth knowing: memory read is about 100 ns. SSD read is about
  100 µs. A round trip inside one data center is about 0.5 ms. A round trip
  across a continent is 50–150 ms.

**1.7 Durability**
- Once data is saved, it's never lost. You get there with copies on separate
  machines or zones, write-ahead logs, backups, and checksums.
- Durability isn't availability. Data can be safe but unreachable for a while.

**1.8 Consistency ★**
- **Strong consistency**: every read sees the latest write. Simple to reason
  about, but slower and harder to keep available.
- **Eventual consistency**: copies catch up after a short delay. Fast and
  highly available, but a read can be stale.
- The CAP rule, practical version: when the network splits (a *partition*),
  you choose between refusing requests (consistency) and answering with
  possibly stale data (availability).
- Choose per feature. A bank balance needs strong. A like count can be eventual.

**1.9 Maintainability, security, cost**
- **Maintainability**: easy to understand, change and operate. Simple beats
  clever.
- **Security**: authentication (who you are), authorization (what you're
  allowed to do), encryption in transit and at rest, least privilege.
- **Cost**: every 9 of availability and every replica costs money. Say this
  trade-off out loud. It scores well in interviews.

**1.10 Summary**
- Requirements decide the design. List them, rank them, and point back to
  them at every decision.

**Drill seeds — chapters 0–1**
- Given a one-line prompt ("design Instagram stories"), list 3 functional and 4 non-functional requirements with numbers, in 3 minutes, out loud.
- Convert availability targets: 99%, 99.9%, 99.99% → downtime per year and per month. Then: why is count-based availability closer to what users feel?
- Spot the mix-up: "our system is reliable because it's always up." Explain availability vs reliability vs durability with one example each.
- Pick strong or eventual consistency for: bank balance, like count, inventory at checkout, profile photo. Defend each in one sentence.
- p50 is 40 ms and p99 is 2 s. What does that tell you, and who are the p99 users likely to be?
- Your app servers keep sessions in memory. What breaks when you add a second server? Fix it.

---

## 2. How to achieve system qualities with hardware (2 lessons)

**2.1 Regions, availability zones, data centers, racks, servers ★**
- The levels, smallest to biggest: **server** → **rack** (shares power and a
  network switch) → **data center** → **availability zone** (one or more
  data centers with their own power and network) → **region** (several zones,
  a few ms apart).
- Spreading copies further apart protects against bigger failures. Copies on
  different racks survive one bad switch. Different zones survive a building
  outage. Different regions survive a whole-region outage or natural disaster.
- Cost: the further apart the copies, the slower it is to keep them in sync.
  Copying synchronously across zones is normal. Copying synchronously across
  regions is slow, so cross-region copies are usually async.

**2.2 Physical servers, VMs, containers, serverless**
- **Physical server**: full control and best performance, but slow to get
  and you maintain everything yourself.
- **Virtual machine**: a slice of a server with its own operating system.
  Starts in minutes.
- **Container**: shares the host's operating system and packages just the
  app (Docker). Starts in seconds. Usually run with Kubernetes.
- **Serverless** (Lambda): you write a function and the platform runs it.
  Scales to zero and you pay per call. Downsides: cold starts, time limits,
  and no local state.
- Moving down the list: less control and faster scaling, but you depend more
  on the cloud provider.

**Drill seeds — chapter 2**
- Where do you place 3 database copies to survive a zone outage? A region outage? What does each cost in write latency?
- Pick physical, VM, container or serverless for: an image-resize job that runs 10 times a day; a WebSocket chat gateway; a GPU model server. Justify.

---

## 3. Fundamentals of reliable, scalable, fast communication (6 lessons)

**3.1 Synchronous vs asynchronous communication ★**
- **Sync**: the caller waits for the answer, like an HTTP request with
  `await`. Simple, but the caller is tied to the callee. If the callee is
  slow, the caller is slow. If it's down, the caller fails.
- **Async**: the caller drops a message into a queue and moves on. The parts
  are decoupled and spikes are absorbed. The cost is more moving pieces,
  eventual consistency and harder debugging.
- Rule of thumb: use sync when the user needs the answer right now (a login
  check). Use async for side effects (send an email, resize an image).

**3.2 Asynchronous messaging patterns ★**
- **Message queue (point-to-point)**: each message goes to exactly one
  consumer. Good for spreading work across workers (SQS, RabbitMQ).
- **Publish/subscribe**: each message goes to every subscriber. Good for
  "an order was placed", which billing, email and analytics all want (SNS,
  Kafka topics).
- **Request/reply over queues**: a reply queue plus a correlation ID.
- **Competing consumers**: many workers read from one queue to scale out.

**3.3 Network protocols**
- **TCP**: reliable and ordered. It costs a handshake, and one lost packet
  holds up everything behind it.
- **UDP**: no guarantees, but fast. Good for video calls, games, DNS and
  metrics.
- **HTTP/1.1**: one request at a time per connection. **HTTP/2**: many
  requests share one connection. **HTTP/3 (QUIC)**: runs on UDP, so one lost
  packet doesn't block the other streams.

**3.4 Blocking vs non-blocking I/O ★**
- **Blocking**: one thread per connection, and the thread sleeps while it
  waits on I/O. Simple, but thousands of connections means thousands of
  threads, and memory and context switching become the limit.
- **Non-blocking (event loop)**: a few threads handle many connections, and
  the OS tells them when data is ready (epoll or kqueue). This is how
  **Node.js** and Netty work. One slow CPU task blocks everyone.
- Analogy for Bilal: the Node event loop. Never do heavy CPU work in a
  request handler.

**3.5 Data encoding formats**
- Text formats (JSON, XML) are readable and work everywhere, but they're
  bigger and slower to parse.
- Binary formats (**Protobuf**, Avro, Thrift) are smaller and faster, and
  they come with a schema.
- **Schema evolution**: add optional fields and never reuse field numbers, so
  old and new versions can still read each other's messages. That's
  backward and forward compatibility.

**3.6 Message acknowledgment ★**
- The receiver confirms it **processed** the message (an ack). With no ack
  before a timeout, the sender or broker sends it again.
- Ack *after* processing gives at-least-once delivery, so duplicates are
  possible. Ack *before* processing gives at-most-once, so a crash loses the
  message.
- That's why consumers have to be **idempotent**: processing the same message
  twice does no extra harm.

**Drill seeds — chapter 3**
- For each, sync or async and why: login check, welcome email, video transcoding, payment authorization.
- Queue or pub/sub: "order placed" needs to reach billing, email and analytics. What about "resize this image"?
- A consumer acks before processing and crashes mid-way. What happens? Now it acks after. What new problem appears, and how do you fix it?
- Node analogy check: why does one CPU-heavy request slow down every other request on a Node server?

---

## 4. How to improve performance with caching (2 lessons)

**4.1 Deduplication cache**
- Remember the IDs of messages or requests you've already handled (Redis
  `SET NX` with a time-to-live) and skip repeats.
- This makes at-least-once delivery behave like effectively-once. It's also
  how **idempotency keys** on payment APIs work.
- Trade-offs: how long to remember an ID (the time-to-live), and the memory
  that takes. A Bloom filter can cut memory if a few false positives are OK.

**4.2 Metadata cache ★**
- Keep data that's read often and changes rarely (configs, user profiles,
  routing tables) close to the code that uses it: in process memory or
  Redis.
- **Cache-aside** (the default): read the cache; on a miss, read the database
  and fill the cache. **Write-through**: write to the cache and the database
  together. **Write-back**: write to the cache and save to the database later
  (fast, but data can be lost).
- Hard parts: **invalidation** (time-to-live, or delete the cache entry on
  write), a **stampede** (when a hot key expires, thousands of requests hit
  the database at once; fix with a lock or a request coalescer), and
  **eviction** (LRU removes what was used least recently).

**Drill seeds — chapter 4**
- Design a dedup cache for payment requests: what key, what time-to-live, what happens on a Redis outage?
- A hot config key expires and the database falls over. Name the problem and two fixes.
- Cache-aside vs write-through vs write-back: which loses data on a crash, and when is that acceptable?

---

## 5. The importance of queues (6 lessons)

**5.1 Queue ★**
- A buffer between producers and consumers. It absorbs spikes, decouples
  the parts, and lets each side scale on its own.
- Mental model: the queue lets the producer finish now and the work happen
  later.

**5.2 Full and empty queue problems ★**
- **Full queue**: producers outrun consumers. Your choices: block the
  producer (**back-pressure**), drop new messages, drop the oldest, or grow
  forever (and eventually run out of memory). Choose on purpose.
- **Empty queue**: consumers spin and waste CPU. Fix it with **long polling**
  or blocking reads.
- A queue whose depth keeps growing is a bug, not a buffer. Alert on the
  depth and on the age of the oldest message.

**5.3 Start with something simple**
- Begin with an in-memory queue in one process, then move to a durable broker
  only when you need it.
- Interviewers reward starting simple and then scaling with a reason.

**5.4 Blocking queue and producer-consumer pattern**
- A bounded queue where `put` waits when the queue is full and `take` waits
  when it's empty. That gives you back-pressure and no busy-waiting.
- It's the classic concurrency building block. iOS analogy: `AsyncStream`
  with a buffering policy.

**5.5 Thread pool**
- A fixed set of worker threads pulls tasks from a queue. It caps how many
  things run at once and reuses threads instead of creating new ones.
- Size it by workload. CPU-bound work: about one thread per core. I/O-bound
  work: more threads.
- Unbounded pool or queue = a slow death under load. Bound both.

**5.6 Big compute architecture**
- Large batch jobs: split the work into tasks → put them on a queue → a large
  fleet of workers (often cheap spot instances) processes them → collect the
  results.
- Queues make it fault tolerant. If a worker dies, its task becomes visible
  again (the visibility timeout) and another worker retries it.

**Drill seeds — chapter 5**
- The queue is full. List the four choices and pick one for: analytics events, payment jobs, live video frames.
- Code drill: write a bounded blocking queue (Swift actor or TypeScript) with `put`/`take` that wait instead of spinning.
- Size a thread pool for a CPU-bound job on 8 cores vs an I/O-bound API caller. Why are they different?
- A batch worker dies mid-task. Walk through how the visibility timeout makes the task run again.

---

## 6. Data store internals (9 lessons)

**6.1 Log ★**
- An append-only file of records. Appending to the end is the fastest write
  possible, and the order is built in.
- It's the foundation of databases (the write-ahead log), Kafka, and
  replication.
- Old data needs **segments** (rolling files), **compaction** (keep only the
  latest value per key), and retention rules.

**6.2 Index ★**
- A side structure that finds data without scanning everything.
- Reads get faster and writes get slower: every write also updates every
  index. Index for the queries you actually run.

**6.3 Time series data**
- Data that arrives in time order: metrics, events, sensor readings. Writes
  are mostly appends, reads are mostly ranges ("the last hour"), and old data
  gets **downsampled** or deleted.
- Partition by time and compress heavily (store the change between values).
  Examples: InfluxDB, TimescaleDB, Prometheus.

**6.4 Simple key-value database**
- A log on disk plus an in-memory hash map from key to offset in the log
  (the Bitcask design).
- Writes are fast appends and reads take one disk seek. The limits: every key
  has to fit in memory, and range queries are impossible.

**6.5 B-tree index ★**
- A balanced tree of fixed-size disk pages. Updates happen **in place**.
  Reads and range queries take a few page reads.
- It's what most relational databases use (Postgres, MySQL InnoDB). Good for
  heavy reads. Writes cause random I/O.

**6.6 Embedded database**
- A database that runs inside your process as a library: SQLite, RocksDB,
  LevelDB. There's no network hop.
- It's often the storage layer under bigger distributed systems. Mobile
  analogy: SQLite or Core Data.

**6.7 RocksDB**
- An embedded key-value store built on an LSM-tree. Writes go to the
  **memtable** (in memory) plus the write-ahead log. When the memtable fills,
  it's flushed to sorted files on disk (**SSTables**), and background
  **compaction** merges those files.
- **Bloom filters** skip files that can't contain the key. Used for Kafka
  Streams state stores and MyRocks (MySQL on RocksDB); CockroachDB's storage
  engine (Pebble) is modeled on it.

**6.8 LSM-tree vs B-tree ★**
- **LSM**: very fast writes (sequential appends) and good compression. Reads
  can check several files, and compaction uses CPU and disk. Best for heavy
  writes (logs, metrics, Cassandra).
- **B-tree**: fast, predictable reads, but writes go to random spots on
  disk. Best for heavy reads and transactions.
- Talk in terms of **amplification**: write amplification (LSM compaction
  rewrites data) versus read amplification (an LSM read checks several
  files).

**6.9 Page cache**
- The operating system keeps recently used file data in spare RAM.
  Repeated reads come from memory.
- Kafka relies on this instead of its own cache. **Zero-copy** (`sendfile`)
  sends data from the page cache straight to the network.

**Drill seeds — chapter 6**
- Explain a write in an LSM-tree step by step (WAL → memtable → SSTable → compaction), then a read (memtable → Bloom filter → SSTables).
- Pick LSM or B-tree for: metrics ingestion, a banking ledger with lots of reads, a chat message store. Say which amplification you're trading.
- Bitcask-style store: why must every key fit in memory, and why can't it do range queries?
- Why can Kafka skip having its own cache? (page cache + zero-copy)

---

## 7. How to build efficient communication in distributed systems (11 lessons)

**7.1 Push vs pull ★**
- **Push**: the server sends data as soon as it has it. Low latency, but it
  can overwhelm a slow receiver.
- **Pull**: the receiver asks when it's ready. It sets its own pace and
  batches naturally, but there's polling delay and wasted empty polls.
- Kafka consumers *pull*. Mobile notifications are *push*.

**7.2 Host discovery**
- How a client finds a machine. **DNS** turns a name into IP addresses.
  Time-to-live values and client caching mean changes spread slowly.
- A load balancer sits behind one stable address.

**7.3 Service discovery ★**
- With many service instances coming and going, you need a **registry**
  (Consul, etcd, ZooKeeper, Kubernetes DNS).
- **Client-side discovery**: the client asks the registry and picks an
  instance itself. **Server-side discovery**: the client calls a load
  balancer, and it asks the registry.
- Instances register themselves and send heartbeats. A missed heartbeat
  removes the instance.

**7.4 Peer discovery**
- Nodes in a cluster find each other without a central registry, using
  **gossip protocols**. Each node periodically swaps member lists with a few
  random peers, and the information spreads like a rumor.
- Used by Cassandra and DynamoDB-style systems. It also detects failures
  (SWIM, phi-accrual detectors).

**7.5 How to choose a network protocol**
- Ask: does it need to be reliable? Does order matter? Is low latency
  critical? Is the stream one-way or two-way? Does it run in a browser or
  inside the data center?
- Defaults: HTTP/REST for public APIs. **gRPC** (HTTP/2 + Protobuf) between
  services. UDP or QUIC for real-time media.

**7.6 Network protocols in real-life systems**
- Pattern: REST or GraphQL at the edge for clients, gRPC inside, a message
  broker for async work, WebSockets for real-time features.

**7.7 Video over HTTP**
- **Adaptive bitrate streaming** (HLS, DASH): the video is cut into short
  chunks (2–10 s), each encoded at several qualities. A **manifest** file
  lists them, and the player picks a quality per chunk based on the current
  bandwidth.
- It works over plain HTTP, so it's cacheable by a CDN. That's the key
  advantage. Analogy for Bilal: AVPlayer reading an `.m3u8` file.

**7.8 CDN ★**
- Edge servers near users cache static content (images, video chunks, JS).
  That lowers latency and takes load off the origin servers.
- **Pull CDN**: an edge fetches from the origin the first time a file is
  requested. **Push CDN**: you upload content ahead of time.
- Main controls: cache keys, time-to-live, purge or invalidation, and
  versioned filenames (`app.3f9a.js`) that skip invalidation entirely.

**7.9 Push and pull technologies ★**
- **Short polling**: ask every N seconds. Simple and wasteful.
- **Long polling**: the server holds the request until there's data or a
  timeout.
- **Server-Sent Events (SSE)**: a one-way server-to-client stream over HTTP
  that reconnects automatically. Great for feeds and LLM token streaming.
- **WebSockets**: a two-way, persistent connection. Chat, games, live
  collaboration.
- **Mobile push** (APNs, FCM): wakes the app when it's not running.

**7.10 Push and pull technologies in real-life systems**
- Chat: WebSockets while the app is open, APNs or FCM when it's in the
  background.
- News feed: pull on open, plus optional SSE or WebSocket for live updates.
- Choose by direction, how often updates come, and whether the client is
  online.

**7.11 Large-scale push architectures ★**
- Millions of open connections: a dedicated **gateway / connection tier**
  holds the sockets and keeps a mapping of user → gateway server (in Redis).
  The backend publishes to a pub/sub system, and the right gateway pushes the
  message to the device.
- Hard parts: memory per connection, reconnect storms after a deploy (add
  jitter), presence ("is the user online?"), and sending to everyone in a
  large group (fan-out).

**Drill seeds — chapter 7**
- Pick a protocol for: a public mobile API, service-to-service calls, a live video call, LLM token streaming to a browser. One sentence each.
- Design notifications for a chat app: app open vs backgrounded vs killed.
- 5 million users hold WebSockets. Sketch the gateway tier, how a message finds the right gateway, and what happens on a deploy (reconnect storm).
- Client-side vs server-side service discovery: who knows the instance list, and what fails if the registry is down?
- Explain adaptive bitrate streaming and why it plays well with CDNs.

---

## 8. How to deliver data reliably (7 lessons)

**8.1 What else to know to build reliable, scalable, fast systems**
- Networks drop, delay, duplicate and reorder messages. Design assuming all
  four will happen.

**8.2 Timeouts ★**
- Every network call needs a timeout. Without one, a hung server ties up
  your threads forever.
- **Connection timeout** (short) versus **request timeout**. Set them from
  the callee's measured p99.9 plus a margin, not a guess.
- Pass a **deadline** down a chain of calls so services further along don't
  keep working after the caller has given up. Swift analogy: a task deadline
  combined with cancellation.

**8.3 What to do with failed requests**
- Options: retry, fall back (cached or default data), queue it for later,
  send it to a **dead-letter queue** after N tries, or fail fast and tell the
  user.
- Separate **transient** errors (timeout, 503, throttling), which are worth
  retrying, from **permanent** ones (400, 404, auth failure), which aren't.

**8.4 When to retry ★**
- Retry only if the operation is **idempotent**, or you send an idempotency
  key.
- Retry only transient errors, with a cap on how many tries.
- Watch out for **retry storms**. Retries at every layer multiply: 3 layers ×
  3 retries = 27 calls. Retry at one layer only, and use a **retry budget**
  (retries can be at most ~10% of traffic).

**8.5 How to retry ★**
- **Exponential backoff**: wait 100 ms, 200 ms, 400 ms… up to a maximum.
- **Jitter**: randomize the wait (e.g. "full jitter" = a random value between
  0 and the backoff) so clients don't all retry at the same moment (the
  thundering herd).
- Respect `Retry-After` headers. Bilal has built this before in his RN
  network-resilience prep.

**8.6 Message delivery guarantees ★**
- **At-most-once**: may be lost, never duplicated. Fine for metrics.
- **At-least-once**: never lost, may be duplicated. This is the usual
  default. Pair it with idempotent consumers.
- **Exactly-once**: really means "effectively once" = at-least-once delivery
  + deduplication, or transactions (Kafka's idempotent producer plus
  transactions).

**8.7 Consumer offsets**
- In a log-based system (Kafka), each consumer group stores its **offset**,
  meaning its position in each partition.
- Commit the offset *after* processing for at-least-once. Commit *before*
  for at-most-once.
- You can rewind the offset to reprocess messages, which is a great feature
  for fixing bugs.

**Drill seeds — chapter 8**
- Code drill: write `retry(fn)` with exponential backoff, full jitter, a max attempt count, `Retry-After` support, and no retries on 4xx.
- 3 layers each retry 3 times. How many calls hit the bottom service when it's down? Fix it two ways.
- Which is safe to retry blindly: GET profile, POST payment, PUT avatar, DELETE comment? What makes the unsafe one safe?
- Delivery guarantees: pick at-most / at-least / effectively-once for metrics, emails, money transfers. Where do you commit the Kafka offset for each?

---

## 9. How to deliver data quickly (2 lessons)

**9.1 Batching ★**
- Group many small messages into one request or write. Fewer round trips,
  less per-request overhead, and much higher throughput.
- Trade-off: each message waits until the batch is full, which adds latency.
  Use a size limit *and* a time limit (Kafka's `batch.size` + `linger.ms`).

**9.2 Compression**
- Fewer bytes on the network and on disk, at the cost of CPU. Compression
  works better on batches, because repetition across messages compresses
  well.
- Choices: gzip compresses most but is slow. **LZ4 / Snappy** are fast with
  less compression. **zstd** is a good balance.

**Drill seeds — chapter 9**
- Batching math: 10,000 msgs/s, 1 ms overhead per request. Compare 1 msg per request vs batches of 100. What latency did you add?
- Pick a compression codec for: logs shipped to cold storage, a low-latency message bus.

---

## 10. How to deliver data at large scale (6 lessons)

**10.1 How to scale message consumption ★**
- Add consumers, but one queue is ordered and limits how much you can run in
  parallel. The fix is **partitions**: split the stream into N ordered logs,
  with one consumer per partition per consumer group.
- Order is kept *within* a partition, not across partitions. Choose the
  partition key so related messages stay together (e.g. `userId`).

**10.2 Partitioning in real-life systems**
- Kafka splits topics into partitions. Databases split data into shards
  (Cassandra, DynamoDB, MongoDB, Vitess for MySQL).
- Same idea every time: split the data so each machine owns a piece.

**10.3 Partitioning strategies ★**
- **Range** (by key range, e.g. A–F): range queries work, but there's a
  risk of **hot spots** (e.g. timestamps make all writes land on one
  partition).
- **Hash** (hash(key) mod N): spreads load evenly, but no range queries.
- **Hot keys** (a celebrity user): add a random suffix to spread the key
  out, or cache it.

**10.4 Request routing**
- How does a request find the partition that has its data? Three options:
  the client knows the map; any node forwards the request; or a routing tier
  or proxy does it.
- The partition map lives in a coordination service (ZooKeeper, etcd) or
  spreads through gossip.

**10.5 Rebalancing partitions**
- When you add or remove nodes, move as little data as possible. **Don't use
  hash mod N.** Changing N moves almost every key.
- Fixes: a **fixed number of partitions** much larger than the number of
  nodes, where whole partitions move between nodes; or consistent hashing.
- Rebalancing uses network and disk, so throttle it, and consider doing it
  manually or after operator approval.

**10.6 Consistent hashing ★**
- Put nodes and keys on a hash ring. Each key belongs to the next node going
  clockwise. Adding or removing a node only moves the keys next to it, about
  1/N of all keys.
- **Virtual nodes**: each physical node takes many spots on the ring, which
  evens out the load and allows weighting by machine capacity.
- Used in DynamoDB, Cassandra, CDNs and load balancers.

**Drill seeds — chapter 10**
- You need per-user ordering of events with 50 consumers. Choose the partition key and explain what ordering you lose.
- Timestamps as a range-partition key: what goes wrong? Fix it.
- You go from 4 to 5 nodes with hash mod N. Roughly what share of keys move? With consistent hashing? Why add virtual nodes?
- One celebrity account melts one partition. Two fixes.

---

## 11. How to protect servers from clients (5 lessons)

**11.1 System overload ★**
- Above capacity, latency jumps and throughput *falls*: queues fill,
  timeouts fire, retries pile on more load. This is **congestion collapse**.
- Causes: traffic spikes, retry storms, a slow dependency, noisy neighbors.

**11.2 Autoscaling**
- Add or remove instances based on a metric: CPU, requests per second,
  queue depth, latency.
- **Reactive** scaling follows the metric. **Scheduled** scaling covers
  known peaks. **Predictive** scaling uses past patterns.
- It isn't instant: instances take minutes to boot and warm up. You still
  need headroom and load shedding for sudden spikes.

**11.3 Autoscaling system design**
- Parts: a metrics collector → a decision engine (target tracking, cooldowns
  so it doesn't flip back and forth) → a provisioner (the cloud API) → the
  load balancer registers new instances.
- Scale on queue depth for workers and on CPU or latency for web servers.
  Set a minimum and maximum, and scale in slowly.

**11.4 Load shedding ★**
- When overloaded, **reject** extra requests fast (a quick `503`) instead of
  serving everyone slowly. A fast rejection is cheap, and a slow failure
  spreads.
- Prioritize: drop background and low-priority traffic first, keep checkout
  and login. Drop requests that have already passed their deadline.

**11.5 Rate limiting ★**
- Cap requests per client (per user, API key or IP) for fairness and
  protection.
- Algorithms: **token bucket** (allows bursts up to the bucket size, refills
  at a steady rate; the default choice), **leaky bucket** (a smooth output
  rate), **fixed window** (has a burst problem at the window edges),
  **sliding window log/counter** (accurate, costs more memory).
- Distributed version: counters in Redis (`INCR` + time-to-live, or a Lua
  script for an atomic token bucket). Return `429` with `Retry-After`.

**Drill seeds — chapter 11**
- Draw what happens to latency and throughput as load passes capacity, and explain why retries make it worse.
- Code drill: implement a token bucket (capacity, refill rate, `tryAcquire()`); then make it work across servers with Redis.
- Black Friday spike in 30 s; autoscaling takes 4 minutes. What keeps the site up in between?
- Load shedding: which requests do you drop first in an e-commerce app, and what status code do you return?

---

## 12. How to protect clients from servers (5 lessons)

**12.1 Synchronous and asynchronous clients**
- A sync client blocks a thread per call. A slow server uses up the client's
  threads, and the failure spreads up the chain.
- Async or non-blocking clients don't hold threads, but they still need
  limits on how many calls are in flight.

**12.2 Circuit breaker ★**
- Wraps calls to a dependency and has three states. **Closed**: calls go
  through and failures are counted. **Open**: after too many failures, fail
  immediately and don't call at all. **Half-open**: after a cooldown, let a
  few test calls through; success closes the breaker, failure reopens it.
- It gives the failing service room to recover and protects your threads.
  Pair it with a fallback.

**12.3 Fail-fast design principle**
- When failure is certain or likely (the breaker is open, the deadline has
  passed, the input is invalid, the queue is full), fail immediately.
  Holding resources just to fail later is the worst outcome.

**12.4 Bulkhead ★**
- Isolate resources per dependency or tenant, like a ship's watertight
  compartments. Example: a separate thread or connection pool for each
  downstream service, so a slow payments service can't use up the threads
  that the profile service needs.

**12.5 Shuffle sharding**
- Give each customer a random *combination* of a few workers out of many,
  instead of one fixed group. A bad customer (a "poison" load) only hurts
  their own combination. Few other customers share that exact combination,
  so the damage stays tiny.
- AWS uses this heavily (Route 53). It's a strong senior-level detail.

**Drill seeds — chapter 12**
- Code drill: implement a circuit breaker with closed / open / half-open states, a failure threshold and a cooldown.
- A slow payments service is eating all threads, and the profile page dies too. Name the pattern that prevents this and sketch it.
- Explain shuffle sharding with numbers: 8 workers, each customer gets 2. How many customers share your exact pair?

---

## 13. Epilogue (1 lesson)

- The building blocks repeat across every system. Learn the trade-offs once,
  and they apply everywhere.

---

## 14. Practice problems (6 lessons)

**Guidelines (parts 1 and 2) — the interview script**
1. Requirements: functional plus non-functional, with numbers (users,
   requests per second, data size, latency target, availability target).
2. Quick estimates: requests per second, storage per year, bandwidth.
3. API: a handful of endpoints.
4. Data model and storage choice, *with the reason*.
5. High-level diagram: client → load balancer → services → storage, plus
   queues and caches.
6. Deep dives where the risk is: scale, reliability, hot spots.
7. Wrap up: bottlenecks, failure modes, what you'd monitor, what you'd do
   next.

**URL shortener ★**
- Writes are rare and reads are very common (about 100:1), so cache
  heavily and serve redirects (301 or 302) from the cache or edge.
- ID generation: base62 of a counter (needs a distributed counter or
  pre-allocated ID ranges), or a hash of the URL (handle collisions). Seven
  base62 characters ≈ 3.5 trillion IDs.
- Storage: a key-value store (short code → long URL). Optional: custom
  aliases, expiry, click analytics (send click events through a queue).

**Fraud detection system**
- A real-time path and a batch path. Transaction events → stream (Kafka) →
  scoring service (rules + ML model, reading a feature store) → allow, deny,
  or send to review. The decision has to land within the payment's latency
  budget (on the order of 100 ms).
- Features: speed of activity (transactions per minute per card, kept in
  Redis with time windows), device and location signals, history. Batch
  jobs retrain models from labeled outcomes.
- Trade-off: false positives (blocking good customers) versus false
  negatives (letting fraud through). Fail open or fail closed when the
  scorer is down? Decide out loud.

**Authentication and authorization system**
- Authentication: passwords hashed with bcrypt or argon2, MFA, and OAuth2
  or OIDC for third-party login. Sessions (server-side, easy to revoke)
  versus **JWT** (stateless, fast to check, hard to revoke → short-lived
  access token + refresh token + a deny list).
- Authorization: RBAC (role-based) or ABAC (attribute-based). A policy
  engine checks permissions, and the results are cached at services or the
  gateway.
- Protect the login endpoint with rate limiting and lockout. Keep secrets in
  a vault. Every check is on the hot path, so make it fast and highly
  available.

**Monitoring system ★**
- Agents on each host collect metrics. Either they **push** them (through a
  queue such as Kafka) or a collector **pulls** them (Prometheus scrapes each
  host). Both end in a time-series database (downsample old data) → dashboards
  plus an alerting engine (thresholds, alert-after-N-minutes rules,
  deduplication, routing to on-call).
- Heavy writes and time-ordered data, so an LSM / time-series store fits
  (see chapter 6). Watch **cardinality**: too many label combinations makes
  storage explode.
- The monitoring system has to be more available than what it watches.
  Who monitors the monitor? A separate, simple watchdog.

**Drill seeds — chapter 14**
- Run each practice problem as a timed 35-minute mock using the 7-step script, with an agent as interviewer.
- After each mock, name which chapters' concepts you used and which you should have used.
- Cold prompts to add once these are done: chat app, news feed, ride matching, rate limiter as a service, notification system.

---

## Progress checklist

Tick these off as Bilal can explain each one aloud.

- [ ] 0 Introduction
- [ ] 1 Requirements: 1.1 [ ] 1.2 [ ] 1.3 [ ] 1.4 [ ] 1.5 [ ] 1.6 [ ] 1.7 [ ] 1.8 [ ] 1.9 [ ]
- [ ] 2 Hardware: 2.1 [ ] 2.2 [ ]
- [x] 3 Communication fundamentals (marked done in the course on 2026-10-21; re-check aloud)
- [ ] 4 Caching: 4.1 [ ] 4.2 [ ]
- [ ] 5 Queues: 5.1–5.6
- [ ] 6 Storage internals: 6.1–6.9
- [ ] 7 Efficient communication: 7.1–7.11
- [ ] 8 Reliable delivery: 8.1–8.7
- [ ] 9 Fast delivery: 9.1–9.2
- [ ] 10 Scale: 10.1–10.6
- [ ] 11 Protect servers: 11.1–11.5
- [ ] 12 Protect clients: 12.1–12.5
- [ ] 14 Practice: URL shortener [ ] Fraud [ ] Auth [ ] Monitoring [ ]
