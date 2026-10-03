#!/usr/bin/env node
// Read-only production verification. Credentials stay inside this process.
// No seed, profile, chat, import, ingest or account-connection mutations run.
import assert from "node:assert/strict";
import { loadConfig } from "../server.mjs";
const { cfg, problems } = loadConfig();
assert.equal(problems.length, 0, "Existing Assistant configuration required");
const base = process.env.ASSISTANT_VERIFY_URL || `http://${cfg.host}:${cfg.port}`;
const evidence = { checkedAt: new Date().toISOString(), base, checks: [], limitations: [] };
async function request(route, options = {}) { return fetch(base + route, { ...options, redirect: "manual", signal: AbortSignal.timeout(35_000) }); }
let cookie;
try {
  for (const route of ["/api/admin/status", "/api/admin/stats", "/api/admin/profiles", "/api/admin/ai-spend", "/api/admin/ai-usage", "/api/admin/metered-cost"]) {
    const r = await request(route); assert.equal(r.status, 401, `unauthorized ${route}`); evidence.checks.push({ route, unauthorized: r.status });
  }
  assert.equal((await request("/admin")).status, 303);
  const login = await request("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: cfg.password }) });
  assert.equal(login.status, 200); cookie = login.headers.get("set-cookie").split(";")[0];
  const page = await request("/admin", { headers: { cookie } }); assert.equal(page.status, 200); assert.equal(page.headers.get("cache-control"), "no-store"); assert.match(await page.text(), /Private admin/);
  evidence.checks.push({ route: "/admin", authorized: 200, cache: "no-store" });
  const disconnect = await request("/api/admin/logout", { method: "POST", headers: { cookie, "content-type": "application/json", "x-admin-action": "1", origin: base }, body: "{}" });
  assert.equal(disconnect.status, 200);
  evidence.checks.push({ route: "/api/admin/logout", sameOrigin: 200, scope: "verification session only" });
  for (const route of ["/api/admin/status", "/api/admin/stats", "/api/admin/profiles", "/api/admin/ai-spend", "/api/admin/ai-usage", "/api/rate-limits"]) {
    const res = await request(route, { headers: { cookie } });
    const data = await res.json();
    const check = { route, authorized: res.status };
    if (route === "/api/admin/ai-spend") { assert.equal(res.status, 200); assert.ok(data.totals.events > 0); check.snapshotAt = data.generatedAt; check.stale = data.stale; check.hasData = true; }
    if (route === "/api/rate-limits") { assert.equal(res.status, 200); assert.ok(data.coverage.length > 0); check.windowCount = data.windows.length; check.hasServerCoverage = data.coverage.some(c => c.harness === "hermes"); }
    if (!res.ok) evidence.limitations.push({ route, status: res.status, reason: data.error });
    evidence.checks.push(check);
  }
  for (const route of ["/admin.js", "/admin.css", "/quota-meter.js"]) assert.equal((await request(route)).status, 200);
  evidence.outcome = "read-only migration smoke passed; see explicit unavailable capabilities";
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (cookie) await request("/api/logout", { method: "POST", headers: { cookie } });
}
