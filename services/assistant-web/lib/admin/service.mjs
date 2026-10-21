// Private admin capabilities. HTTP authentication is applied by the owner server.
// Upstream errors are intentionally redacted: auth payloads must never reach logs.
import jwt from "jsonwebtoken";
import { createUsageStore } from "./ai-usage/store.ts";
import { parseUsageCsv } from "./ai-usage/csv.ts";
import { parseIngest } from "./ai-usage/validate.ts";
import { priceFor } from "./ai-usage/pricing.ts";
import { fetchMeteredCost } from "./ai-spend/anthropic-admin.ts";
import { totals, groupBy, topSessions, hourlySeries } from "./ai-usage/aggregate.ts";
import { readSnapshot } from "./ai-spend/store.ts";
import { totalsFor, byHarness, byModel, byRepo, byDay, composition, unpricedModels, mergeEvents } from "./ai-spend/rollup.ts";

function fail(status, message) { return Object.assign(new Error(message), { status }); }
export function createAdminService(cfg, { fetcher = fetch, usageStore = createUsageStore(cfg.usageEnv) } = {}) {
  const sessions = new Map();
  let meteredCache = null;
  async function upstream(base, route, options = {}) {
    if (!base) throw fail(503, "Backend URL is not configured on this host.");
    let response;
    try { response = await fetcher(new URL(route, base.endsWith("/") ? base : `${base}/`), { ...options, redirect: "error", signal: AbortSignal.timeout(30_000) }); }
    catch { throw fail(502, "Backend unavailable; no result was assumed. Check before retrying a mutation."); }
    if (!response.ok) {
      await response.body?.cancel();
      throw fail(response.status === 401 || response.status === 403 ? 403 : 502, `Backend rejected request (HTTP ${response.status}); no result was assumed.`);
    }
    try { return await response.json(); } catch { throw fail(502, "Backend returned an invalid response."); }
  }
  function adminHeaders() {
    if (!cfg.adminSecret) throw fail(503, "ADMIN_SECRET capability is unavailable on this host. Public cutover is pending.");
    return { "content-type": "application/json", "x-admin-secret": cfg.adminSecret };
  }
  function verified(token) {
    if (!cfg.jwtSecret || !token) return null;
    try {
      const p = jwt.verify(token, cfg.jwtSecret, { algorithms: ["HS256"] });
      return p && ["admin", "owner"].includes(p.role) && p.tenantId === cfg.tenantId && typeof p.exp === "number" ? p : null;
    } catch { return null; }
  }
  function requireStore() {
    if (!usageStore.isConfigured()) throw fail(503, "Existing AI_USAGE_TABLE capability is unavailable. Ingest/CSV were preserved but no new store was provisioned.");
  }
  return {
    status(session) {
      const connected = Boolean(verified(sessions.get(session)));
      if (!connected) sessions.delete(session);
      return { stats: Boolean(cfg.adminSecret && cfg.datingUrl), seed: Boolean(cfg.adminSecret && cfg.datingUrl), profiles: connected, profileLogin: Boolean(cfg.jwtSecret && cfg.authUrl), usageStore: usageStore.isConfigured(), machineIngest: Boolean(cfg.ingestToken && usageStore.isConfigured()), note: "Capabilities are configuration presence, not proof of upstream authorization. Seed operations are never run by verification." };
    },
    async stats() {
      return upstream(cfg.datingUrl, `admin/stats?tenantId=${encodeURIComponent(cfg.tenantId)}`, { headers: adminHeaders() });
    },
    async seed(method, body) {
      const confirmation = method === "POST" ? "GENERATE PAID SEED DATA" : "DELETE ALL FAKE PROFILES";
      if (body?.confirmation !== confirmation) throw fail(400, `Explicit confirmation required: ${confirmation}`);
      if (method === "POST" && (!Number.isInteger(body.count) || body.count < 1 || body.count > 200)) throw fail(400, "Count must be an integer from 1 to 200.");
      return upstream(cfg.datingUrl, `admin/seed?tenantId=${encodeURIComponent(cfg.tenantId)}`, {
        method, headers: adminHeaders(), ...(method === "POST" ? { body: JSON.stringify({ count: body.count, tenantId: cfg.tenantId }) } : {}),
      });
    },
    async login(session, body) {
      if (!cfg.jwtSecret) throw fail(503, "Existing JWT verification capability is unavailable.");
      if (typeof body.email !== "string" || typeof body.password !== "string" || body.email.length > 320 || body.password.length > 1024) throw fail(400, "Email and password required.");
      const data = await upstream(cfg.authUrl, "auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: body.email, password: body.password, tenantId: cfg.tenantId }) });
      const token = data.tokens?.accessToken ?? data.token ?? data.accessToken;
      if (!verified(token)) throw fail(403, "An existing admin/owner account for this tenant is required.");
      // Tokens remain server-side, expire with upstream JWT, and are scoped to
      // the current owner session. No token is minted or returned to the browser.
      for (const [key, value] of sessions) if (!verified(value)) sessions.delete(key);
      if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
      sessions.set(session, token);
      return { ok: true };
    },
    logout(session) { sessions.delete(session); return { ok: true }; },
    async profiles(session) {
      const token = sessions.get(session);
      if (!verified(token)) { sessions.delete(session); throw fail(503, "Connect an existing admin account to browse profiles; absence is not an empty feed."); }
      const data = await upstream(cfg.datingUrl, "discover?limit=50", { headers: { Authorization: `Bearer ${token}` } });
      if (!Array.isArray(data)) throw fail(502, "Unexpected profiles response; no empty result was assumed.");
      return { profiles: data.map(p => Object.fromEntries(["name", "age", "seeking", "borough", "isActive"].map(k => [k, p[k]]))), coverage: "Existing discover feed, up to 50; not a complete user export." };
    },
    async spend() {
      const snapshot = await readSnapshot(cfg.snapshotFile);
      if (!snapshot || !Array.isArray(snapshot.events)) throw fail(503, "Existing AI spend snapshot unavailable; collector has not been replaced or reset.");
      const events = mergeEvents([], snapshot.events);
      return { generatedAt: snapshot.generatedAt, machine: snapshot.machine, stale: !Number.isFinite(Date.parse(snapshot.generatedAt)) || Date.now() - Date.parse(snapshot.generatedAt) > 15 * 60_000, coverage: "Existing single-machine PR43 snapshot. Do not add these totals to PR45 rollups; their coverage overlaps.", billing: "Subscription dollars are API-equivalent estimates, NOT bills. Provider quota remains in Agents, not inferred from tokens.", totals: totalsFor(events), composition: composition(events), breakdowns: { harness: byHarness(events), model: byModel(events), repo: byRepo(events), day: byDay(events) }, unpricedModels: unpricedModels(events), warningCount: snapshot.warnings?.length ?? 0 };
    },
    async metered() {
      if (!meteredCache?.value.ok || Date.now() - meteredCache.at > 300_000) {
        meteredCache = { at: Date.now(), value: await fetchMeteredCost(30, new Date(), fetcher, cfg.meteredKey || null) };
      }
      return meteredCache.value;
    },
    async usage() {
      requireStore();
      try {
        const now = new Date();
        const rows = await usageStore.getRollups(new Date(now.getTime() - 7 * 86400_000), now);
        const unpricedModels = [...new Set(rows.filter(r => r.costUsd == null && !priceFor(r.model)).map(r => r.model))];
        return { coverage: "Existing PR45 store, last 7 UTC days; overlaps local spend. Estimated dollars are not subscription charges. All dollar totals exclude unpriced models when listed.", unpricedModels, totals: totals(rows), bySource: groupBy(rows, r => r.source), byRepo: groupBy(rows, r => r.repo), byModel: groupBy(rows, r => r.model), sessions: topSessions(rows), hourly: hourlySeries(rows, now, 168) };
      } catch { throw fail(502, "Existing AI usage store could not be read."); }
    },
    async importCsv(body) {
      requireStore();
      if (typeof body.csv !== "string" || Buffer.byteLength(body.csv) > 1_000_000) throw fail(400, "CSV text required, at most 1 MB.");
      const parsed = parseUsageCsv(body.csv);
      if (!parsed.rollups.length || parsed.errors.length) throw fail(400, parsed.errors[0] ?? "No CSV rows found.");
      return this.ingest({ rollups: parsed.rollups });
    },
    async ingest(body) {
      requireStore();
      const parsed = parseIngest(body);
      if (!parsed.ok) throw fail(400, parsed.error);
      try { return { written: await usageStore.putRollups(parsed.rollups) }; }
      catch { throw fail(502, "Existing AI usage store write failed; retry is idempotent."); }
    },
  };
}
