import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, loadConfig } from "../server.mjs";

test("real Assistant wiring protects pages, APIs and preserves quota assets", async () => {
  const { cfg } = loadConfig({ ASSISTANT_WEB_ENV_FILE: "/nonexistent", ASSISTANT_ADMIN_ENV_FILE: "/nonexistent", ASSISTANT_WEB_PASSWORD: "synthetic-owner-password", ASSISTANT_WEB_SESSION_SECRET: "synthetic-owner-session-secret-over-32-characters", HERMES_HOME: "/nonexistent" });
  const calls = [];
  const adminService = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return { ok: true, synthetic: true }; } });
  const logs = [];
  const server = createServer(cfg, { adminService, log: row => logs.push(row) });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const endpoint of ["status", "stats", "profiles", "ai-spend", "ai-usage", "metered-cost"]) assert.equal((await fetch(`${base}/api/admin/${endpoint}`)).status, 401);
    assert.equal((await fetch(base + "/admin", { redirect: "manual" })).status, 303);
    assert.equal((await fetch(base + "/admin/profiles", { redirect: "manual" })).headers.get("location"), "/");
    assert.equal((await fetch(base + "/api/ai-usage/ingest", { method: "POST" })).status, 401);
    assert.equal(calls.length, 0);
    const login = await fetch(base + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: cfg.password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const page = await fetch(base + "/admin", { headers: { cookie } });
    assert.equal(page.status, 200); assert.equal(page.headers.get("cache-control"), "no-store");
    assert.match(await page.text(), /Private admin/);
    assert.equal((await fetch(base + "/api/admin/stats", { headers: { cookie } })).status, 200);
    assert.equal((await fetch(base + "/api/admin/seed", { method: "POST", headers: { cookie }, body: "{}" })).status, 403);
    assert.equal((await fetch(base + "/api/admin/seed", { method: "DELETE", headers: { cookie, "x-admin-action": "1" }, body: JSON.stringify({ confirmation: "synthetic" }) })).status, 200);
    for (const asset of ["/admin.js", "/admin.css", "/quota-meter.js"]) assert.equal((await fetch(base + asset)).status, 200);
    const home = await (await fetch(base)).text(); assert.match(home, /href="\/admin"/); assert.match(home, /type="module"/);
    assert.match(await (await fetch(base + "/app.js")).text(), /quota-meter.js/);
    await fetch(base + "/api/logout", { method: "POST", headers: { cookie } });
    assert.equal(calls.at(-1)[0], "logout");
    const serializedLogs = JSON.stringify(logs);
    assert.equal(serializedLogs.includes(cfg.password), false); assert.equal(serializedLogs.includes(cookie), false);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
