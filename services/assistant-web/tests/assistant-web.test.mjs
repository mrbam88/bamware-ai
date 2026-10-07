import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
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
async function withServer(fn, extraEnv = {}, dependencies = {}) {
  const decisionsDir = mkdtempSync(path.join(tmpdir(), "aw-decisions-http-"));
  const { cfg, problems } = loadConfig({
    ASSISTANT_WEB_ENV_FILE: "/nonexistent",
    ASSISTANT_WEB_PASSWORD: PASSWORD,
    ASSISTANT_WEB_SESSION_SECRET: SECRET,
    HERMES_BIN: FAKE,
    HERMES_CWD: HERE,
    HERMES_HOME: path.join(HERE, "fixtures", "hermes-home-missing"),
    HERMES_TIMEOUT_MS: "2000",
    ASSISTANT_WEB_STATE_DIR: "/nonexistent",
    ASSISTANT_WEB_BOARD: "0",
    ASSISTANT_WEB_HANDOFF_CHECKS: "0",
    ASSISTANT_WEB_HANDOFF_CHECKS_DIR: path.join(decisionsDir, "checks"),
    ASSISTANT_WEB_DECISIONS_FILE: path.join(decisionsDir, "decisions.json"),
    ASSISTANT_WEB_DECISIONS_DEMO_FILE: path.join(decisionsDir, "decisions.demo.json"),
    ...extraEnv,
  });
  assert.deepEqual(problems, []);
  const logs = [];
  const server = createServer(cfg, { log: (f) => logs.push(f), ...dependencies });
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
    for (const [m, p] of [["GET", "/api/me"], ["POST", "/api/chat"], ["GET", "/api/sessions/20260101_000000_abcdef/export"], ["DELETE", "/api/sessions/20260101_000000_abcdef"], ["GET", "/api/agents"], ["GET", "/api/decisions"]]) {
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

test("GET /api/decisions (live) lists the real, explicit candidates, all pending", async () => {
  await withServer(async (base) => {
    const { cookie } = await login(base);
    const res = await fetch(`${base}/api/decisions`, { headers: { cookie } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.mode, "live");
    assert.deepEqual(body.decisions.map(d => d.id), ['brewdesk-first-carousel-72', 'backlog-triage-view-77']);
    assert.deepEqual(body.history.map(d => d.id), ['auth-email-aws-access-85', 'brewdesk-marketing-research-72']);
    for (const action of ['respond', 'handoff/refresh', 'discussion', 'discussion/sync']) {
      const retired = await fetch(`${base}/api/decisions/auth-email-aws-access-85/${action}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
      assert.equal(retired.status, 409);
      assert.equal((await retired.json()).code, 'retired_decision');
    }
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
    const candidate = DECISION_CANDIDATES.find(c => c.id === 'brewdesk-first-carousel-72');
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
    const candidate = DECISION_CANDIDATES.find((c) => c.options.some((o) => o.action === "approve"));
    const approveOption = candidate.options.find((o) => o.action === "approve").id;
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
    const candidate = DECISION_CANDIDATES.find(c => c.id === 'brewdesk-first-carousel-72');
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


test("GET /api/agents answers what the machine is doing from real state files", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agents-state-"));
  mkdirSync(path.join(dir, "overnight", "1790000000000000000"), { recursive: true });
  writeFileSync(path.join(dir, "emergency-stop.json"), JSON.stringify({ reason: "Founder emergency stop: quota capacity incident", pausedAt: 1790999195, automaticResume: false, processes: [] }));
  writeFileSync(path.join(dir, "overnight", "1790000000000000000", "status.json"), JSON.stringify({ phase: "finished", started_at: 1790000000, tasks: [{ id: "implementation-75", state: "failed", exit_code: 1, started_at: 1790000000, finished_at: 1790000600 }] }));
  writeFileSync(path.join(dir, "overnight", "1790000000000000000", "batch.json"), JSON.stringify({ schema: 1, tasks: [{ id: "implementation-75", ticket: "mrbam88/bamware-ai#75" }] }));
  try {
    await withServer(async (base) => {
      const { cookie } = await login(base);
      const res = await fetch(`${base}/api/agents`, { headers: { cookie } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.system.state, "paused");
      assert.equal(body.now.recent[0].state, "failed", "the executor's real state, never 'finished, unverified'");
      assert.equal(body.now.recent[0].ticket, "mrbam88/bamware-ai#75");
      assert.equal(body.capacity.state, "unavailable");
      assert.equal(body.board, null, "board disabled in tests");
    }, { ASSISTANT_WEB_STATE_DIR: dir });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("discussion endpoints require owner auth, current version and never dispatch", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "aw-discussion-http-")); let sends = 0;
  const transport = {
    identity: async () => ({ channelId:"100000000000000000",guildId:"200000000000000000",ownerId:"300000000000000000",botId:"400000000000000000" }),
    sendMessage: async () => ({id: String(500000000000000000n + BigInt(++sends))}),
    ensureThread: async (_, id) => ({id}), checkThread: async () => ({}), messages: async () => [], findMessage: async () => null,
  };
  await withServer(async base => {
    const { cookie } = await login(base);
    const deck = await (await fetch(`${base}/api/decisions`, {headers:{cookie}})).json(); const c = deck.decisions[0];
    const endpoint = `${base}/api/decisions/${c.id}/discussion`;
    const post = (url, version, authenticated=true) => fetch(url, {method:"POST",headers:{"content-type":"application/json",...(authenticated?{cookie}:{})},body:JSON.stringify({candidateVersion:version})});
    assert.equal((await post(endpoint,c.version,false)).status,401);assert.equal(sends,0);
    assert.equal((await post(endpoint,"stale")).status,409);assert.equal(sends,0);
    const opened=await (await post(endpoint,c.version)).json();assert.equal(opened.discussion.status,"ready");const count=sends;
    assert.equal((await post(endpoint,c.version)).status,200);assert.equal(sends,count);
    assert.equal((await post(endpoint+"/sync",c.version,false)).status,401);
    assert.equal((await post(endpoint+"/sync",c.version)).status,200);
    const after=await (await fetch(`${base}/api/decisions`,{headers:{cookie}})).json();const current=after.decisions.find(x=>x.id===c.id);
    assert.equal(current.response,null);assert.equal(current.handoff.status,"not_applicable");assert.equal(current.discussion.threadId,opened.discussion.threadId);assert.equal(current.discussion.stale,false);
  },{ASSISTANT_WEB_DISCUSSIONS:"1",ASSISTANT_WEB_DISCUSSIONS_DIR:directory},{discussionTransport:transport});
});
