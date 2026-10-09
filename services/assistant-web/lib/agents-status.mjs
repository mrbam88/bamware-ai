// Agents tab V3: one snapshot answering "is the machine working right now, on
// what, what is blocking it, and can I afford it?" (Engineering Lead review,
// 2026-10-03). Every section reads an existing source of truth; nothing here
// recomputes another owner's numbers (capacity comes from the CFO's own file).
import { promises as fs } from "node:fs";
import path from "node:path";

const RECENT_TASKS = 6;
const RUNS_SCANNED = 8;
const CAPACITY_STALE_MS = 25 * 60_000; // the CFO publishes every 10 minutes
const STALLED_RUN_MS = 12 * 60 * 60_000;

// ------------------------------------------------------------- reading ----
async function readJson(file, readFile) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/** Is a process recorded by the emergency stop still alive and frozen? */
export async function processState(pid, startTicks, readFile = fs.readFile) {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    // Fields after the parenthesised command name: state is first, starttime is 20th.
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    if (String(fields[19]) !== String(startTicks)) return "gone"; // pid reused
    return fields[0] === "T" || fields[0] === "t" ? "frozen" : "running";
  } catch {
    return "gone";
  }
}

/** Is this run's executor worker (`runner.py worker <run dir>`) still alive? null when unknown. */
export async function workerAlive(pid, runId, readFile = fs.readFile) {
  if (!Number.isInteger(pid)) return null;
  try {
    const cmdline = (await readFile(`/proc/${pid}/cmdline`, "utf8")).split("\0");
    const i = cmdline.findIndex((a) => path.basename(a) === "runner.py");
    return i >= 0 && cmdline[i + 1] === "worker" && path.basename(cmdline[i + 2] ?? "") === runId;
  } catch (err) {
    // Only "no such process" means dead; anything else (e.g. a future ProtectProc sandbox) is unknown.
    return err?.code === "ENOENT" ? false : null;
  }
}

// Older manifests carry no title; the worker's prompt names its ticket (`Ticket: owner/repo#N "Title"`).
const clip = (text, max = 90) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
export function promptLabel(text) {
  if (!text) return null;
  const m = /^Ticket:\s*([\w.-]+\/[\w.-]+)#(\d+)\s*(.*)$/m.exec(text);
  if (m) {
    const quoted = /^"([^"]+)"/.exec(m[3].trim());
    const title = quoted ? quoted[1] : m[3].trim().split(/\.\s/)[0].replace(/\.$/, "");
    return { ticket: `${m[1]}#${m[2]}`, title: title ? clip(title) : null };
  }
  const task = /YOUR TASK:\s*\n+([^\n]+)/.exec(text);
  return task ? { ticket: null, title: clip(task[1].split(/\.\s/)[0].trim()) } : null;
}

/** Per task: the worker's own token usage, denied commands and prompt label, from the batch work directory. */
async function readWorkers(batch, readFile) {
  const workers = {};
  for (const t of batch?.tasks ?? []) {
    const i = (t.argv ?? []).indexOf("--work-dir");
    const dir = i >= 0 ? t.argv[i + 1] : null;
    if (!dir || !path.isAbsolute(dir) || !/^[\w.-]+$/.test(t.id ?? "")) continue;
    const result = await readJson(path.join(dir, `${t.id}.result.json`), readFile);
    let prompt = null;
    try {
      prompt = await readFile(path.join(dir, `${t.id}.prompt`), "utf8");
    } catch {}
    workers[t.id] = { usage: result?.usage ?? null, turns: result?.num_turns ?? null,
      denials: Array.isArray(result?.permission_denials) ? result.permission_denials.length : null, label: promptLabel(prompt) };
  }
  return workers;
}

export async function readAgentsState(stateDir, { readFile = fs.readFile, readdir = fs.readdir, ownerBlockersDir } = {}) {
  const list = async (dir) => {
    try {
      return await readdir(dir);
    } catch {
      return [];
    }
  };
  const estop = await readJson(path.join(stateDir, "emergency-stop.json"), readFile);
  if (estop?.processes) {
    estop.processStates = await Promise.all(estop.processes.map((p) => processState(p.pid, p.startTicks, readFile)));
  }
  const batchFiles = (await list(path.join(stateDir, "batches"))).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const batch = batchFiles.length ? await readJson(path.join(stateDir, "batches", batchFiles.at(-1)), readFile) : null;

  const runIds = (await list(path.join(stateDir, "overnight"))).filter((d) => /^\d+$/.test(d)).sort((a, b) => (BigInt(b) > BigInt(a) ? 1 : -1)).slice(0, RUNS_SCANNED);
  const runs = [];
  for (const id of runIds) {
    const dir = path.join(stateDir, "overnight", id);
    const status = await readJson(path.join(dir, "status.json"), readFile);
    if (!status) continue;
    const pickup = status.phase === "finished" ? null : await readJson(path.join(dir, "pickup.json"), readFile);
    const batch = await readJson(path.join(dir, "batch.json"), readFile);
    runs.push({ id, status, batch, workers: await readWorkers(batch, readFile),
      workerAlive: pickup ? await workerAlive(pickup.worker_pid, id, readFile) : null });
  }
  const blockersDir = ownerBlockersDir ?? path.join(stateDir, "owner-blockers");
  const blockerFiles = (await list(blockersDir)).filter((f) => f.endsWith(".json") && !f.startsWith("."));
  const blockers = (await Promise.all(blockerFiles.map((f) => readJson(path.join(blockersDir, f), readFile)))).filter(Boolean);
  const capacity = await readJson(path.join(stateDir, "cfo", "capacity.json"), readFile);
  return { estop, batch, runs, blockers, capacity };
}

// ----------------------------------------------------------- deriving -----
const seconds = (t) => (typeof t === "number" ? t * 1000 : t ? Date.parse(t) : null);

function largestCost(cost) {
  // Under 0.05% is below what the meter can resolve; show nothing rather than "0.0% of <pool>".
  const pools = Object.entries(cost?.pools ?? {}).filter(([, p]) => typeof p.delta_pct === "number" && p.delta_pct >= 0.05);
  if (!pools.length) return null;
  const [key, pool] = pools.sort((a, b) => b[1].delta_pct - a[1].delta_pct)[0];
  return { pool: pool.label ?? key, pct: pool.delta_pct, attribution: cost.attribution ?? null };
}

/** Total tokens the worker processed, split by kind; cache reads usually dominate. */
function tokenUsage(usage, turns) {
  if (!usage) return null;
  const parts = { input: usage.input_tokens ?? 0, cacheWrite: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0, output: usage.output_tokens ?? 0 };
  const total = parts.input + parts.cacheWrite + parts.cacheRead + parts.output;
  return total ? { ...parts, total, turns: turns ?? null } : null;
}

/** Running and queued tasks of unfinished runs, plus recent finished tasks with real states. */
export function deriveNow(runs, now) {
  const running = [];
  const recent = [];
  for (const run of runs) {
    const smoke = run.batch?.smoke_test === true;
    const planned = run.batch?.tasks ?? [];
    const worker = (id) => run.workers?.[id] ?? {};
    const ticketOf = (id) => planned.find((t) => t.id === id)?.ticket ?? worker(id).label?.ticket ?? null;
    const titleOf = (id) => planned.find((t) => t.id === id)?.title ?? worker(id).label?.title ?? null;
    const records = run.status.tasks ?? [];
    // A run whose worker died never writes phase "finished"; its tasks were interrupted, not running.
    const dead = run.status.phase !== "finished" && run.workerAlive === false;
    if (dead) {
      for (const r of records.filter((r) => r.state === "running")) {
        recent.push({ runId: run.id, task: r.id, ticket: ticketOf(r.id), title: titleOf(r.id), state: "interrupted", exitCode: null,
          startedAt: seconds(r.started_at), finishedAt: null, sortAt: seconds(r.started_at), durationMs: null, cost: null, smoke });
      }
    } else if (run.status.phase !== "finished") {
      // workerAlive must be confirmed true for a positive ("running"/"stalled") state; null/missing
      // evidence (e.g. no pickup.json yet, or a sandbox denial) can't be told apart from a dead worker,
      // so it stays "unverified" rather than claiming the factory is building on a guess.
      const verified = run.workerAlive === true;
      const started = seconds(run.status.started_at);
      const stalled = verified && started && now - started > STALLED_RUN_MS;
      for (const r of records.filter((r) => r.state === "running")) {
        running.push({ runId: run.id, task: r.id, ticket: ticketOf(r.id), title: titleOf(r.id), state: verified ? (stalled ? "stalled" : "running") : "unverified", startedAt: seconds(r.started_at), smoke });
      }
      for (const t of planned.filter((t) => !records.some((r) => r.id === t.id))) {
        running.push({ runId: run.id, task: t.id, ticket: ticketOf(t.id), title: titleOf(t.id), state: "queued", startedAt: null, smoke });
      }
    }
    for (const r of records.filter((r) => r.state !== "running")) {
      const startedAt = seconds(r.started_at);
      const finishedAt = seconds(r.finished_at);
      recent.push({ runId: run.id, task: r.id, ticket: ticketOf(r.id), title: titleOf(r.id), state: r.state, exitCode: r.exit_code ?? null,
        finishedAt, durationMs: startedAt && finishedAt ? finishedAt - startedAt : null, cost: largestCost(r.cost),
        tokens: tokenUsage(worker(r.id).usage, worker(r.id).turns), denials: worker(r.id).denials ?? null, smoke });
    }
  }
  recent.sort((a, b) => (b.finishedAt ?? b.sortAt ?? 0) - (a.finishedAt ?? a.sortAt ?? 0));
  return { running, recent: recent.slice(0, RECENT_TASKS) };
}

/** Owner actions waiting on the founder: open blockers and unanswered batch checkpoints. */
export function deriveNeedsYou(blockers, batch, catalog = []) {
  const items = blockers
    .filter((b) => b.status === "waiting_for_owner")
    .map((b) => {
      // Older blocker records carry no candidate; the Decisions catalog has the same card.
      const c = b.candidate ?? catalog.find((x) => x.id === b.id) ?? {};
      return { kind: "blocker", id: b.id, title: c.title ?? b.ownerAction ?? b.id, project: c.project ?? null,
        urgency: c.urgency ?? null, action: c.title ? b.ownerAction ?? null : null, url: c.source?.url ?? null,
        since: seconds(b.checkedAt) };
    });
  if (batch && /^awaiting/.test(batch.status ?? "")) {
    const next = (batch.checkpoints ?? []).find((c) => c.status !== "done" && c.status !== "complete");
    items.push({ kind: "checkpoint", id: `batch-${batch.date}`, title: `Batch for ${batch.date} is waiting for your ${next ? next.id.replace(/-/g, " ") : "checkpoint"}`,
      project: null, urgency: null, action: batch.executionAuthorized ? null : "No work is authorized until you plan the batch.", url: null, since: seconds(batch.createdAt) });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => (rank[a.urgency] ?? 3) - (rank[b.urgency] ?? 3));
}

/** The CFO's published view; flags the whole section stale if the CFO stopped publishing. */
export function deriveCapacity(capacity, now) {
  if (!capacity) return { state: "unavailable", pools: [], problems: ["The CFO has not published capacity yet."] };
  const generatedAt = seconds(capacity.generated_at);
  const problems = Object.entries(capacity.sources ?? {})
    .filter(([, s]) => s.last_error)
    .map(([name, s]) => `${name}: ${s.last_error}`);
  return {
    state: !Number.isFinite(generatedAt) || now - generatedAt > CAPACITY_STALE_MS ? "stale" : "fresh",
    generatedAt,
    reservePct: capacity.policy?.reserve_used_pct ?? null,
    pools: (capacity.pools ?? []).map((p) => ({ key: p.key, label: p.label, usedPct: p.used_pct, level: p.level,
      stale: p.stale, ratePctH: p.rate_pct_h, etaReserveH: p.eta_reserve_h, etaExhaustH: p.eta_exhaust_h,
      reserveBeforeReset: p.reserve_before_reset ?? null, exhaustBeforeReset: p.exhaust_before_reset ?? null,
      resetAt: seconds(p.reset_at), observedAt: seconds(p.observed_at) })),
    problems,
  };
}

/** The one-line machine state, in priority order: paused, running, awaiting the founder, idle. */
export function deriveSystem({ estop }, work, needsYou) {
  const waiting = needsYou.length;
  if (estop && !estop.resumedAt) {
    const states = estop.processStates ?? [];
    const frozen = states.filter((s) => s === "frozen").length;
    return { state: "paused", title: "Paused by emergency stop", detail: estop.reason ?? "Founder emergency stop",
      since: seconds(estop.pausedAt), frozen, recorded: states.length, waiting,
      note: estop.automaticResume === false ? "Resumes only when you lift it." : null };
  }
  // A genuinely confirmed running/stalled task always wins over merely unverified ones, in either order.
  const active = work.running.find((t) => t.state === "running" || t.state === "stalled");
  if (active) {
    const nQ = work.running.filter((t) => t.state === "queued").length;
    if (active.state === "stalled") {
      return { state: "attention", title: "FACTORY STALLED", detail: `Stuck on ${active.ticket ?? active.task}`, since: active.startedAt, waiting };
    }
    return { state: "running", title: "FACTORY BUILDING", detail: `Now: ${active.ticket ?? active.task}${nQ ? ` · ${nQ} queued` : ""}`, since: active.startedAt, waiting };
  }
  // No confirmed activity: unverified worker evidence must never be reported as idle, CEO-blocked, or
  // building — it's its own visible state so the CEO knows to go check, not assume all-clear or all-busy.
  const unverified = work.running.find((t) => t.state === "unverified");
  if (unverified) {
    return { state: "attention", title: "Activity unverified", detail: "Can't confirm whether the worker is running — check the run before trusting idle or queued status.", since: unverified.startedAt, waiting };
  }
  if (waiting) return { state: "awaiting", title: "WAITING ON YOU", detail: `${waiting} decision(s) block the line — nothing building until then.`, since: null, waiting };
  return { state: "idle", title: "Idle", detail: "Nothing running and nothing waiting on you.", since: null, waiting };
}

export function buildAgentsSnapshot(raw, nowMs, { catalog = [] } = {}) {
  const now = deriveNow(raw.runs ?? [], nowMs);
  const needsYou = deriveNeedsYou(raw.blockers ?? [], raw.batch, catalog);
  return {
    generatedAt: nowMs,
    system: deriveSystem({ estop: raw.estop }, now, needsYou),
    now,
    needsYou,
    capacity: deriveCapacity(raw.capacity, nowMs),
  };
}
