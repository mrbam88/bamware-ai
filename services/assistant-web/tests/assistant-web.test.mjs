import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseEnvFile, parseHermesOutput, validateChatInput, signSession, verifySession, safeEqual, LoginLimiter } from "../lib.mjs";
import { createServer, loadConfig } from "../server.mjs";
import { DECISION_CANDIDATES } from "../lib/providers/decision-candidates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAKE = path.join(HERE, "fixtures", "fake-hermes.sh");
const SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";
const PASSWORD = "correct-horse-battery";

test("parseEnvFile handles comments, quotes and blanks", () => {
  const vars = parseEnvFile(`# c\nA=1\nB="two words"\nC='x'\n\nBAD\nD= spaced \n`);
  assert.deepEqual(vars, { A: "1", B: "two words", C: "x", D: "spaced" });
});

test("parseHermesOutput follows the -Q -q contract", () => {
  const r = parseHermesOutput("PONG\n", "↻ Resumed session x\n\nsession_id: 20261001_210753_e89a74\n");
  assert.equal(r.reply, "PONG");
  assert.equal(r.sessionId, "20261001_210753_e89a74");
  assert.equal(r.errorLine, null);
  const f = parseHermesOutput("", "Error: boom\n\nsession_id: 20261001_210753_e89a74\n");
  assert.equal(f.reply, "");
  assert.equal(f.errorLine, "Error: boom");
  assert.equal(parseHermesOutput("x", "session_id: not-an-id").sessionId, null);
});

test("validateChatInput rejects bad text and bad session ids", () => {
  assert.ok(validateChatInput({}).error);
  assert.ok(validateChatInput({ text: "x".repeat(4001) }).error);
  assert.ok(validateChatInput({ text: "hi", sessionId: "../etc" }).error);
  assert.deepEqual(validateChatInput({ text: " hi ", sessionId: "20260101_000000_abcdef" }), { text: "hi", sessionId: "20260101_000000_abcdef" });
  assert.deepEqual(validateChatInput({ text: "hi", sessionId: "" }), { text: "hi", sessionId: null });
});

test("session cookie signs, verifies, expires and rejects tampering", () => {
  const now = 1_000_000;
  const v = signSession(SECRET, { exp: now + 1000 });
  assert.ok(verifySession(SECRET, v, now));
  assert.equal(verifySession(SECRET, v, now + 2000), null);
  assert.equal(verifySession("other-secret-other-secret-other-secret", v, now), null);
  assert.equal(verifySession(SECRET, v.slice(0, -2) + "zz", now), null);
  assert.equal(verifySession(SECRET, "garbage", now), null);
});

test("safeEqual and LoginLimiter", () => {
  assert.ok(safeEqual("abc", "abc"));
  assert.ok(!safeEqual("abc", "abd"));
  assert.ok(!safeEqual("abc", "abcd"));
  const l = new LoginLimiter({ max: 2, windowMs: 1000 });
  l.fail("ip", 0); l.fail("ip", 1);
  assert.ok(l.blocked("ip", 2));
  assert.ok(!l.blocked("ip", 1500));
});

test("loadConfig refuses weak secrets", () => {
  const { problems } = loadConfig({ ASSISTANT_WEB_ENV_FILE: "/nonexistent", ASSISTANT_WEB_PASSWORD: "short", ASSISTANT_WEB_SESSION_SECRET: "short" });
  assert.equal(problems.length, 2);
});

// ------------------------------------------------------------ HTTP flow ---
async function withServer(fn, extraEnv = {}) {
  const decisionsDir = mkdtempSync(path.join(tmpdir(), "aw-decisions-http-"));
  const { cfg, problems } = loadConfig({
    ASSISTANT_WEB_ENV_FILE: "/nonexistent",
    ASSISTANT_WEB_PASSWORD: PASSWORD,
    ASSISTANT_WEB_SESSION_SECRET: SECRET,
    HERMES_BIN: FAKE,
    HERMES_CWD: HERE,
    HERMES_HOME: path.join(HERE, "fixtures", "hermes-home-missing"),
    HERMES_TIMEOUT_MS: "2000",
    ASSISTANT_WEB_DECISIONS_FILE: path.join(decisionsDir, "decisions.json"),
    ASSISTANT_WEB_DECISIONS_DEMO_FILE: path.join(decisionsDir, "decisions.demo.json"),
    ...extraEnv,
  });
  assert.deepEqual(problems, []);
  const logs = [];
  const server = createServer(cfg, { log: (f) => logs.push(f) });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, logs);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

async function login(base) {
  const res = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie").split(";")[0];
  assert.match(res.headers.get("set-cookie"), /HttpOnly/);
  assert.match(res.headers.get("set-cookie"), /SameSite=Strict/);
  return { cookie };
}

test("unauthenticated clients get 401 on every /api route except health and login", async () => {
  await withServer(async (base) => {
    for (const [m, p] of [["GET", "/api/me"], ["POST", "/api/chat"], ["GET", "/api/sessions/20260101_000000_abcdef/export"], ["DELETE", "/api/sessions/20260101_000000_abcdef"], ["GET", "/api/rate-limits"], ["GET", "/api/work-usage"], ["GET", "/api/decisions"]]) {
      const res = await fetch(base + p, { method: m, headers: { "content-type": "application/json" }, body: m === "POST" ? "{}" : undefined });
      assert.equal(res.status, 401, `${m} ${p}`);
    }
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
  });
});

test("wrong password is rejected and rate limited", async () => {
  await withServer(async (base) => {
    let last;
    for (let i = 0; i < 6; i++) {
      last = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "nope-nope-nope" }) });
    }
    assert.equal(last.status, 429);
  });
});

test("chat round trip returns the reply and session id, then resumes it", async () => {
  await withServer(async (base, logs) => {
    const { cookie } = await login(base);
    const first = await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ text: "hello" }) });
    assert.equal(first.status, 200);
    const a = await first.json();
    assert.equal(a.reply, "echo: hello");
    assert.equal(a.sessionId, "20260101_000000_abcdef");
    assert.equal(a.trace.langfuseSessionId, a.sessionId);
    assert.ok(a.requestId);

    const second = await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ text: "again", sessionId: a.sessionId }) });
    const b = await second.json();
    assert.equal(b.sessionId, a.sessionId);
    assert.ok(logs.some((l) => l.event === "chat.start" && l.resume === true));
    // Message content must never be logged.
    assert.ok(!JSON.stringify(logs).includes("hello"));
  });
});

test("a failed Hermes turn surfaces as 502 with the error line", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ text: "FAIL" }) });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.error, "Error: simulated provider failure");
    assert.equal(body.sessionId, "20260101_000000_abcdef");
  });
});

test("a hung Hermes turn times out as 504", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ text: "SLOW" }) });
    assert.equal(res.status, 504);
  });
});

test("export streams JSONL and delete calls the CLI", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const exp = await fetch(`${base}/api/sessions/20260101_000000_abcdef/export`, { headers: { cookie } });
    assert.equal(exp.status, 200);
    assert.match(exp.headers.get("content-type"), /ndjson/);
    assert.match(await exp.text(), /"role":"assistant"/);
    const del = await fetch(`${base}/api/sessions/20260101_000000_abcdef`, { method: "DELETE", headers: { cookie } });
    assert.deepEqual(await del.json(), { ok: true, deleted: "20260101_000000_abcdef" });
    const bad = await fetch(`${base}/api/sessions/..%2Fetc/export`, { headers: { cookie } });
    assert.equal(bad.status, 400);
  });
});

test("me reports Langfuse presence booleans only", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const me = await (await fetch(`${base}/api/me`, { headers: { cookie } })).json();
    assert.deepEqual(Object.keys(me.langfuse).sort(), ["hermesHome", "keysPresent", "pluginEnabled"]);
    assert.equal(me.langfuse.keysPresent, false);
  });
});

test("GET /api/rate-limits defaults to live mode: honest unsupported, no fake cap", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/rate-limits`, { headers: { cookie } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.mode, "live");
    assert.ok(body.version);
    assert.equal(body.windows.length, 2);
    assert.equal(body.windows[0].state, "unsupported");
    assert.equal(body.windows[0].usedTokens, null);
    assert.ok(!JSON.stringify(body).includes("1500000"), "must never present the old unverified 1.5M cap as fact");
  });
});

test("GET /api/rate-limits?mode=demo returns only synthetic, clearly tagged windows", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/rate-limits?mode=demo`, { headers: { cookie } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.mode, "demo");
    assert.ok(body.windows.length >= 5);
    for (const w of body.windows) assert.equal(w.source.kind, "synthetic");
    const states = new Set(body.windows.map((w) => w.state));
    for (const required of ["fresh", "stale", "exhausted", "unknown"]) assert.ok(states.has(required));
  });
});

test("GET /api/work-usage defaults to live mode: real repo/branch/machine correlation, no fabricated numbers", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/work-usage`, { headers: { cookie } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.mode, "live");
    assert.ok(body.version);
    assert.equal(body.adapterNotes[0].name, "self");
    assert.equal(body.adapterNotes[0].ok, true);
    // The self adapter has no project/task (batch branch), so it must land as unallocated, not fabricated into a task total.
    assert.equal(body.usageByProjectTask.length, 0);
    assert.ok(body.unallocatedUsage);
    assert.equal(body.unallocatedUsage.usage.input, null);
    assert.equal(body.routing.length, 0, "no routing rules are configured for live mode");
  });
});

test("GET /api/work-usage?mode=demo returns the full synthetic widget feature set", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/work-usage?mode=demo`, { headers: { cookie } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.mode, "demo");
    assert.equal(body.duplicatesDropped, 1, "the rewritten-transcript duplicate must be collapsed, not summed");
    assert.equal(body.usageByProjectTask.length, 3, "tasks #76, #77 and #78 each get their own scope");
    const task76 = body.usageByProjectTask.find((s) => s.task.id === "76");
    assert.equal(task76.attempts.length, 3, "implementation + retry + qa, deduplicated");
    assert.equal(task76.retryCount, 1);
    assert.equal(task76.qaAttemptCount, 1);
    assert.ok(task76.usage.input > 0);
    assert.ok(body.unallocatedUsage, "the project/task-less event must surface as unallocated, not be dropped");
    assert.equal(body.unallocatedUsage.usage.input, 5000);
    const active = body.activeAgents.find((a) => a.sessionId === "demo-session-5");
    assert.equal(active.state, "active");
    const stale = body.activeAgents.find((a) => a.sessionId === "demo-session-6");
    assert.equal(stale.state, "stale", "an old heartbeat must never read as active");
    assert.ok(body.timing.activeMsTotal > 0);
    assert.ok(body.timing.waitMsTotal > 0);
    assert.ok(body.timing.waitByReason.qa > 0);
    assert.equal(body.outcomes.counts["verified-pass"], 2);
    assert.equal(body.outcomes.counts["qa-fail"], 1);
    assert.ok(body.routing.length >= 2);
    const insufficient = body.routing.find((r) => r.evidence === "insufficient");
    assert.ok(insufficient, "a rule with no matching verified evidence must say so, not claim a recommendation");
  });
});

// -------------------------------------------------------------- decisions -
test("GET /api/decisions (live) lists the real, explicit candidates, all pending", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/decisions`, { headers: { cookie } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.mode, "live");
    assert.equal(body.decisions.length, DECISION_CANDIDATES.length);
    for (const d of body.decisions) {
      assert.notEqual(d.source.kind, "synthetic");
      assert.equal(d.response, null);
      assert.equal(d.handoff.status, "not_applicable");
    }
  });
});

test("GET /api/decisions?mode=demo lists only clearly-tagged synthetic candidates", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/decisions?mode=demo`, { headers: { cookie } });
    const body = await res.json();
    assert.equal(body.mode, "demo");
    assert.ok(body.decisions.length >= 1);
    for (const d of body.decisions) assert.equal(d.source.kind, "synthetic");
  });
});

test("respond -> reload: a durable response survives a fresh GET (restart simulation)", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const candidate = DECISION_CANDIDATES[0];
    const r = await fetch(`${base}/api/decisions/${candidate.id}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "defer", candidateVersion: candidate.version }),
    });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.decision.response.action, "defer");
    assert.equal(body.decision.handoff.status, "not_applicable");

    const after = await (await fetch(`${base}/api/decisions`, { headers: { cookie } })).json();
    const found = after.decisions.find((d) => d.id === candidate.id);
    assert.equal(found.response.action, "defer");
  });
});

test("duplicate respond calls are idempotent over HTTP; real mode never claims a worker picked it up", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const candidate = DECISION_CANDIDATES.find((c) => c.options.some((o) => o.id === "approve")) ?? DECISION_CANDIDATES[0];
    const approveOption = candidate.options.find((o) => o.id === "approve")?.id ?? candidate.options[0].id;
    const payload = JSON.stringify({ action: "approve", selectedOptionId: approveOption, candidateVersion: candidate.version });
    const first = await fetch(`${base}/api/decisions/${candidate.id}/respond`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: payload });
    const firstBody = await first.json();
    assert.equal(firstBody.duplicate, false);
    assert.equal(firstBody.decision.handoff.status, "handoff_pending", "no confirmed live worker interface exists in real mode");

    const second = await fetch(`${base}/api/decisions/${candidate.id}/respond`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: payload });
    const secondBody = await second.json();
    assert.equal(secondBody.duplicate, true);
  });
});

test("a stale candidateVersion is rejected over HTTP with 409", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const candidate = DECISION_CANDIDATES[0];
    const res = await fetch(`${base}/api/decisions/${candidate.id}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "defer", candidateVersion: "0-stale" }),
    });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, "stale_decision");
  });
});

test("demo mode proves the full handoff lifecycle: recorded -> pickup_confirmed -> completed, clearly synthetic", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const list = await (await fetch(`${base}/api/decisions?mode=demo`, { headers: { cookie } })).json();
    const candidate = list.decisions[0];
    const approveOption = candidate.options.find((o) => o.id === "integrate_partner" || o.id === "approve")?.id ?? candidate.options[0].id;

    const respond = await fetch(`${base}/api/decisions/${candidate.id}/respond?mode=demo`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "approve", selectedOptionId: approveOption, candidateVersion: candidate.version }),
    });
    const respondBody = await respond.json();
    assert.equal(respondBody.decision.handoff.status, "pickup_confirmed");
    assert.ok(respondBody.decision.handoff.receiptId);

    const refresh = await fetch(`${base}/api/decisions/${candidate.id}/handoff/refresh?mode=demo`, { method: "POST", headers: { cookie } });
    const refreshBody = await refresh.json();
    assert.equal(refreshBody.refreshed, true);
    assert.equal(refreshBody.decision.handoff.status, "completed");
  });
});

test("demo mode can also simulate an unavailable worker on request, still honest about it", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const list = await (await fetch(`${base}/api/decisions?mode=demo`, { headers: { cookie } })).json();
    const candidate = list.decisions[0];
    const approveOption = candidate.options.find((o) => o.id === "integrate_partner" || o.id === "approve")?.id ?? candidate.options[0].id;
    const res = await fetch(`${base}/api/decisions/${candidate.id}/respond?mode=demo`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "approve", selectedOptionId: approveOption, candidateVersion: candidate.version, simulateWorker: "unavailable" }),
    });
    const body = await res.json();
    assert.equal(body.decision.handoff.status, "handoff_pending");
  });
});

test("an unknown decision id is 404, not silently ignored", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/decisions/does-not-exist/respond`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "defer", candidateVersion: "1" }),
    });
    assert.equal(res.status, 404);
  });
});
