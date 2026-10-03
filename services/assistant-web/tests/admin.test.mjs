import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAdminService } from "../lib/admin/service.mjs";
import { createAdminRouter } from "../lib/admin/router.mjs";
import { signSession, verifySession } from "../lib.mjs";
import { createUsageStore } from "../lib/admin/ai-usage/store.ts";

const secret = "synthetic-test-key-not-a-real-credential";
const cfg = { adminSecret: "synthetic-admin", jwtSecret: secret, tenantId: "synthetic-tenant", datingUrl: "https://dating.invalid/", authUrl: "https://auth.invalid/", usageEnv: {}, snapshotFile: "/no/snapshot", ingestToken: "synthetic-ingest" };
function token(payload = {}) {
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ role: "admin", tenantId: cfg.tenantId, exp: Math.floor(Date.now() / 1000) + 300, ...payload })).toString("base64url");
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
}
const ok = body => new Response(JSON.stringify(body), { status: 200 });

test("metered costs keep unknown separate from zero and recover after an error", async () => {
  let calls = 0;
  const service = createAdminService({ ...cfg, meteredKey: "synthetic-metered" }, { fetcher: async () => {
    calls++;
    return calls === 1 ? new Response("private upstream detail", { status: 403 }) : ok({ data: [{ starting_at: "2026-10-01", results: [{ amount: "125", description: "synthetic" }] }] });
  } });
  const first = await service.metered(); assert.equal(first.ok, false); assert.equal(first.error.includes("private upstream"), false);
  assert.equal((await service.metered()).totalUsd, 1.25);
  assert.equal((await service.metered()).totalUsd, 1.25); assert.equal(calls, 2);
  const malformed = createAdminService({ ...cfg, meteredKey: "synthetic-metered" }, { fetcher: async () => ok({ data: [{ results: [{}] }] }) });
  assert.equal((await malformed.metered()).ok, false);
  const missing = await createAdminService(cfg).metered(); assert.equal(missing.configured, false);
});

test("stats reuse server secret and tenant without exposing the credential", async () => {
  const calls = [];
  const service = createAdminService(cfg, { fetcher: async (url, options) => { calls.push([url, options]); return ok({ profiles: { real: 2, fake: 0 } }); } });
  assert.equal((await service.stats()).profiles.real, 2);
  assert.equal(calls[0][0].pathname, "/admin/stats");
  assert.equal(calls[0][0].searchParams.get("tenantId"), cfg.tenantId);
  assert.equal(calls[0][1].headers["x-admin-secret"], cfg.adminSecret);
  assert.equal(calls[0][1].redirect, "error");
  assert.equal(JSON.stringify(service.status("a")).includes(cfg.adminSecret), false);
});

test("missing stats/store fail explicitly and make no upstream requests", async () => {
  const service = createAdminService({ ...cfg, adminSecret: "" }, { fetcher: () => { throw Error("must not call"); } });
  await assert.rejects(service.stats(), { status: 503 });
  await assert.rejects(service.usage(), { status: 503 });
  await assert.rejects(service.ingest({ rollups: [] }), { status: 503 });
  await assert.rejects(service.profiles("a"), { status: 503 });
});

test("synthetic seed mutations require exact confirmation, bounded count and fixed tenant", async () => {
  const calls = [];
  const service = createAdminService(cfg, { fetcher: async (url, options) => { calls.push([url, options]); return ok({ created: 3 }); } });
  for (const count of [-1, 0, 201, 1.5, "3"]) await assert.rejects(service.seed("POST", { count, confirmation: "GENERATE PAID SEED DATA" }), { status: 400 });
  await assert.rejects(service.seed("POST", { count: 3 }), { status: 400 });
  await assert.rejects(service.seed("DELETE", { confirmation: "yes" }), { status: 400 });
  assert.equal(calls.length, 0);
  await service.seed("POST", { count: 3, confirmation: "GENERATE PAID SEED DATA", tenantId: "wrong" });
  assert.deepEqual(JSON.parse(calls[0][1].body), { count: 3, tenantId: cfg.tenantId });
  await service.seed("DELETE", { confirmation: "DELETE ALL FAKE PROFILES" });
  assert.equal(calls[1][1].method, "DELETE");
  assert.equal(calls[1][0].searchParams.get("tenantId"), cfg.tenantId);
});

test("profile connection verifies signature, role, expiry and tenant; isolates owner sessions", async () => {
  for (const invalid of [token({ role: "customer" }), token({ exp: 1 }), token({ tenantId: "other" }), token() + "x"]) {
    const service = createAdminService(cfg, { fetcher: async () => ok({ token: invalid }) });
    await assert.rejects(service.login("a", { email: "synthetic@example.invalid", password: "fixture" }), { status: 403 });
  }
  const valid = token(); const calls = [];
  const service = createAdminService(cfg, { fetcher: async (url, options) => {
    calls.push([url, options]);
    return url.pathname === "/auth/login" ? ok({ token: valid }) : ok([{ userId: "fake", name: "Synthetic", privateField: "not-returned" }]);
  } });
  assert.deepEqual(await service.login("a", { email: "synthetic@example.invalid", password: "fixture" }), { ok: true });
  await assert.rejects(service.profiles("b"), { status: 503 });
  const data = await service.profiles("a");
  assert.equal(calls.at(-1)[1].headers.Authorization, `Bearer ${valid}`);
  assert.equal(data.profiles[0].name, "Synthetic");
  assert.equal(data.profiles[0].privateField, undefined);
  service.logout("a"); await assert.rejects(service.profiles("a"), { status: 503 });
});

test("backend failures are redacted, never empty profile results or fake zero stats", async () => {
  const service = createAdminService(cfg, { fetcher: async () => new Response("SENSITIVE BODY", { status: 403 }) });
  await assert.rejects(service.stats(), error => error.status === 403 && !error.message.includes("SENSITIVE"));
});

test("CSV and ingest retain original idempotent rollup key; bad rows cause no writes", async () => {
  const records = new Map(); const original = createUsageStore({});
  const usageStore = { isConfigured: () => true, getRollups: async () => [...records.values()], putRollups: async rows => { for (const row of rows) records.set(JSON.stringify(original.keyOf(row)), row); return rows.length; } };
  const service = createAdminService(cfg, { usageStore });
  const csv = "date,source,model,input_tokens,output_tokens,cost_usd\n2026-10-01,cursor,synthetic,100,10,0.5";
  assert.deepEqual(await service.importCsv({ csv }), { written: 1 });
  assert.deepEqual(await service.importCsv({ csv }), { written: 1 });
  assert.equal(records.size, 1);
  await assert.rejects(service.importCsv({ csv: csv + "\ninvalid,row" }), { status: 400 });
  await assert.rejects(service.ingest({ rollups: [{ input: -1 }] }), { status: 400 });
  assert.equal(records.size, 1);
  assert.equal((await service.usage()).totals.tokens, 110);
});

test("spend reuses snapshot, deduplicates and does not return cursors or raw event identifiers", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "admin82-"));
  try {
    const snapshotFile = path.join(dir, "snapshot.json");
    const event = { id: "private-event-id", at: new Date().toISOString(), harness: "codex", billing: "subscription", model: "unpriced-fixture", tokens: { input: 1, output: 2, cacheRead: 3, cacheWrite5m: 0, cacheWrite1h: 0, thinking: 2 } };
    writeFileSync(snapshotFile, JSON.stringify({ version: 1, generatedAt: "2020-01-01T00:00:00Z", machine: "fixture", events: [event, event], cursors: { secretPath: {} } }));
    const data = await createAdminService({ ...cfg, snapshotFile }).spend();
    assert.equal(data.totals.total, 6); assert.equal(data.stale, true); assert.equal(data.totals.hasUnpriced, true);
    assert.equal(JSON.stringify(data).includes("private-event-id"), false); assert.equal(JSON.stringify(data).includes("secretPath"), false);
  } finally { rmSync(dir, { recursive: true }); }
});

async function withRouter(run) {
  const cookie = signSession(secret, { exp: Date.now() + 60_000 }); let count = 0;
  const service = new Proxy({}, { get: (_, name) => () => { count++; return { operation: name }; } });
  const router = createAdminRouter({ admin: cfg, publicDir: path.resolve("public") }, {
    authed: req => Boolean(verifySession(secret, req.headers.cookie)), sessionKey: req => req.headers.cookie,
    send: (res, status, body, headers = {}) => { res.writeHead(status, { "content-type": "application/json", ...headers }); res.end(typeof body === "string" ? body : JSON.stringify(body)); },
    readJson: async req => { const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); }, service,
  });
  const server = http.createServer(async (req, res) => { if (!await router(req, res, new URL(req.url, "http://localhost"))) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`, cookie, () => count); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test("HTTP owner gate protects every migrated admin endpoint and bookmarked pages", async () => withRouter(async (base, cookie, count) => {
  for (const [method, route] of [["GET", "status"], ["GET", "stats"], ["GET", "profiles"], ["GET", "ai-spend"], ["GET", "ai-usage"], ["POST", "login"], ["POST", "logout"], ["POST", "seed"], ["DELETE", "seed"], ["POST", "ai-usage/import"]]) {
    const res = await fetch(`${base}/api/admin/${route}`, { method }); assert.equal(res.status, 401, route);
  }
  assert.equal((await fetch(base + "/admin/profiles", { redirect: "manual" })).status, 303);
  assert.equal((await fetch(base + "/api/admin/stats", { headers: { cookie: cookie + "tampered" } })).status, 401);
  assert.equal(count(), 0);
  assert.equal((await fetch(base + "/api/admin/stats", { headers: { cookie } })).status, 200);
}));

test("HTTP mutations require CSRF header/same origin, machine capability is ingest-only", async () => withRouter(async (base, cookie, count) => {
  assert.equal((await fetch(base + "/api/admin/seed", { method: "DELETE", headers: { cookie } })).status, 403);
  assert.equal((await fetch(base + "/api/admin/seed", { method: "DELETE", headers: { cookie, "x-admin-action": "1", origin: "https://evil.invalid" } })).status, 403);
  const bearer = { authorization: `Bearer ${cfg.ingestToken}` };
  assert.equal((await fetch(base + "/api/admin/stats", { headers: bearer })).status, 401);
  assert.equal((await fetch(base + "/api/ai-usage/ingest", { method: "POST" })).status, 401);
  assert.equal(count(), 0);
  assert.equal((await fetch(base + "/api/ai-usage/ingest", { method: "POST", headers: bearer })).status, 200);
  assert.equal((await fetch(base + "/api/admin/seed", { method: "POST", headers: { cookie, "x-admin-action": "1" } })).status, 200);
}));
