#!/usr/bin/env node
// Bamware assistant website: authenticated text (and browser voice) front end
// for the real Hermes runtime on omarchy. Zero npm dependencies (Node >= 22).
//
// Each chat turn runs `hermes chat -Q -q <text> [--resume <session>]` in the
// bamware-ai checkout, so the turn uses the same state.db, context hook,
// skills and plugins (Langfuse) as every other Hermes session on this host.
// See README.md for setup, gates and the API-server upgrade path.

import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseEnvFile,
  parseHermesOutput,
  validateChatInput,
  signSession,
  verifySession,
  safeEqual,
  parseCookies,
  LoginLimiter,
  SESSION_ID_RE,
} from "./lib.mjs";
import { buildSnapshot } from "./lib/rate-limits.mjs";
import { codexQuotaAdapter } from "./lib/providers/codex-quota-adapter.mjs";
import { readServerQuota } from "./lib/providers/server-quota-adapter.mjs";
import { claudeMaxAdapter } from "./lib/providers/claude-max-adapter.mjs";
import { demoAdapter } from "./lib/providers/demo-adapter.mjs";
import { buildWorkUsageSnapshot } from "./lib/work-usage.mjs";
import { overnightUsageAdapter } from "./lib/providers/overnight-usage-adapter.mjs";
import { workUsageSelfAdapter } from "./lib/providers/work-usage-self-adapter.mjs";
import { workUsageDemoAdapter, demoRoutingRules } from "./lib/providers/work-usage-demo-fixtures.mjs";
import { buildDecisionsSnapshot, respondToDecision, refreshHandoff } from "./lib/decisions.mjs";
import { loadDecisionStore } from "./lib/decision-store.mjs";
import { DECISION_CANDIDATES } from "./lib/providers/decision-candidates.mjs";
import { demoDecisionCandidates, fixtureWorkerUnavailable, makeFixtureWorkerAccepting } from "./lib/providers/decision-candidates-demo-fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const COOKIE = "aw_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

// ---------------------------------------------------------------- config ---
export function loadConfig(env = process.env) {
  const envFile = env.ASSISTANT_WEB_ENV_FILE ?? path.join(os.homedir(), ".config", "bamware", "assistant-web.env");
  const fileVars = existsSync(envFile) ? parseEnvFile(readFileSync(envFile, "utf8")) : {};
  const get = (k, d) => (env[k] != null && env[k] !== "" ? env[k] : fileVars[k] != null && fileVars[k] !== "" ? fileVars[k] : d);
  const cfg = {
    envFile,
    host: get("ASSISTANT_WEB_HOST", "127.0.0.1"),
    port: Number(get("ASSISTANT_WEB_PORT", "8765")),
    password: get("ASSISTANT_WEB_PASSWORD", ""),
    sessionSecret: get("ASSISTANT_WEB_SESSION_SECRET", ""),
    secureCookies: /^(1|true|yes)$/i.test(get("ASSISTANT_WEB_SECURE_COOKIES", "")),
    hermesBin: get("HERMES_BIN", "hermes"),
    hermesCwd: get("HERMES_CWD", REPO_ROOT),
    hermesTimeoutMs: Number(get("HERMES_TIMEOUT_MS", "180000")),
    hermesHome: get("HERMES_HOME", path.join(os.homedir(), ".hermes")),
    maxQueue: Number(get("ASSISTANT_WEB_MAX_QUEUE", "3")),
    publicDir: path.join(HERE, "public"),
    codexQuotaFile: get("ASSISTANT_WEB_CODEX_QUOTA_FILE", path.join(os.homedir(), ".local/state/bamware/codex-quota.json")),
    serverQuotaFile: get("ASSISTANT_WEB_SERVER_QUOTA_FILE", path.join(os.homedir(), ".local/state/bamware/server-quota.json")),
    quotaSamplesFile: get("ASSISTANT_WEB_QUOTA_SAMPLES_FILE", ""),
    overnightUsageFile: get("ASSISTANT_WEB_OVERNIGHT_USAGE_FILE", path.join(os.homedir(), ".local/state/bamware/overnight/usage.json")),
    decisionsFile: get("ASSISTANT_WEB_DECISIONS_FILE", path.join(os.homedir(), ".config", "bamware", "assistant-web-decisions.json")),
    decisionsDemoFile: get("ASSISTANT_WEB_DECISIONS_DEMO_FILE", path.join(os.homedir(), ".config", "bamware", "assistant-web-decisions.demo.json")),
  };
  const problems = [];
  if (cfg.password.length < 12) problems.push("ASSISTANT_WEB_PASSWORD must be at least 12 characters.");
  if (cfg.sessionSecret.length < 32) problems.push("ASSISTANT_WEB_SESSION_SECRET must be at least 32 characters (openssl rand -hex 32).");
  if (!Number.isInteger(cfg.port) || cfg.port <= 0) problems.push("ASSISTANT_WEB_PORT must be a positive integer.");
  return { cfg, problems };
}

// ---------------------------------------------------------------- hermes ---
/** Serialises Hermes CLI runs: the CLI claims one active "cli" session per host. */
class HermesRunner {
  constructor(cfg, log) {
    this.cfg = cfg;
    this.log = log;
    this.queue = [];
    this.busy = false;
  }
  get depth() {
    return this.queue.length + (this.busy ? 1 : 0);
  }
  run(args, { input, requestId } = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({ args, input, requestId, resolve, reject });
      this._drain();
    });
  }
  async _drain() {
    if (this.busy) return;
    const job = this.queue.shift();
    if (!job) return;
    this.busy = true;
    try {
      job.resolve(await this._exec(job));
    } catch (err) {
      job.reject(err);
    } finally {
      this.busy = false;
      this._drain();
    }
  }
  _exec({ args, input, requestId }) {
    const { hermesBin, hermesCwd, hermesTimeoutMs } = this.cfg;
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const env = { ...process.env, HERMES_QUIET: "1" };
      // Tag web-originated turns in Langfuse unless the operator set a global tag.
      if (!env.HERMES_LANGFUSE_ENV) env.HERMES_LANGFUSE_ENV = "assistant-web";
      const child = spawn(hermesBin, args, { cwd: hermesCwd, env, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        // Answer the client now; the child is torn down in the background.
        timedOut = true;
        reject(Object.assign(new Error("Hermes did not answer in time."), { status: 504 }));
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000).unref();
      }, hermesTimeoutMs);
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(Object.assign(new Error(`Could not start Hermes (${hermesBin}): ${err.message}`), { status: 502 }));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        const elapsedMs = Date.now() - started;
        this.log({ event: "hermes.exit", requestId, code, timedOut, elapsedMs, stdoutChars: stdout.length, stderrChars: stderr.length });
        if (timedOut) return;
        resolve({ code, stdout, stderr, elapsedMs });
      });
      if (input != null) child.stdin.end(input);
      else child.stdin.end();
    });
  }
}

// --------------------------------------------------------------- helpers ---
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/quota-meter.js": ["quota-meter.js", "text/javascript; charset=utf-8"],
  "/app.css": ["app.css", "text/css; charset=utf-8"],
};

function send(res, status, body, headers = {}) {
  const isJson = body !== null && typeof body === "object" && !Buffer.isBuffer(body);
  const payload = isJson ? JSON.stringify(body) : body ?? "";
  res.writeHead(status, {
    "content-type": isJson ? "application/json; charset=utf-8" : headers["content-type"] ?? "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    ...headers,
  });
  res.end(payload);
}

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error("Body too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Body is not valid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function isSecure(req, cfg) {
  return cfg.secureCookies || req.socket.encrypted || req.headers["x-forwarded-proto"] === "https";
}

function cookieHeader(name, value, { maxAge, secure }) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict"];
  if (secure) parts.push("Secure");
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

function clientKey(req) {
  return req.socket.remoteAddress ?? "unknown";
}

/** Presence-only checks on Hermes config; never returns values. */
function hermesStatus(cfg) {
  const out = { pluginEnabled: false, keysPresent: false, hermesHome: cfg.hermesHome };
  try {
    const yaml = readFileSync(path.join(cfg.hermesHome, "config.yaml"), "utf8");
    out.pluginEnabled = /^\s*-\s*observability\/langfuse\s*$/m.test(yaml);
  } catch {}
  try {
    const envVars = parseEnvFile(readFileSync(path.join(cfg.hermesHome, ".env"), "utf8"));
    const pk = process.env.HERMES_LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY || envVars.HERMES_LANGFUSE_PUBLIC_KEY || envVars.LANGFUSE_PUBLIC_KEY || "";
    const sk = process.env.HERMES_LANGFUSE_SECRET_KEY || process.env.LANGFUSE_SECRET_KEY || envVars.HERMES_LANGFUSE_SECRET_KEY || envVars.LANGFUSE_SECRET_KEY || "";
    out.keysPresent = pk.startsWith("pk-lf-") && sk.startsWith("sk-lf-");
  } catch {}
  return out;
}

// ---------------------------------------------------------------- server ---
export function createServer(cfg, { log = defaultLog } = {}) {
  const runner = new HermesRunner(cfg, log);
  const limiter = new LoginLimiter();
  // One fixture-worker instance per server process so a dispatch's receiptId
  // can later be found by a refresh check (demo lifecycle proof only).
  const demoAcceptingWorker = makeFixtureWorkerAccepting();

  const authed = (req) => {
    const cookies = parseCookies(req.headers.cookie);
    return verifySession(cfg.sessionSecret, cookies[COOKIE]) != null;
  };

  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const url = new URL(req.url, "http://localhost");
    const route = `${req.method} ${url.pathname}`;
    const t0 = Date.now();
    res.on("finish", () => log({ event: "http", requestId, route, status: res.statusCode, ms: Date.now() - t0 }));

    try {
      // Static assets ------------------------------------------------------
      if (req.method === "GET" && STATIC[url.pathname]) {
        const [file, type] = STATIC[url.pathname];
        return send(res, 200, readFileSync(path.join(cfg.publicDir, file)), { "content-type": type, "cache-control": "no-cache" });
      }
      if (route === "GET /api/health") {
        return send(res, 200, { ok: true, service: "assistant-web", queueDepth: runner.depth });
      }

      // Auth ----------------------------------------------------------------
      if (route === "POST /api/login") {
        const key = clientKey(req);
        if (limiter.blocked(key)) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
        const body = await readJson(req, 4096);
        if (typeof body.password !== "string" || !safeEqual(body.password, cfg.password)) {
          limiter.fail(key);
          log({ event: "login.fail", requestId });
          return send(res, 401, { error: "Wrong password." });
        }
        limiter.reset(key);
        const value = signSession(cfg.sessionSecret, { iat: Date.now(), exp: Date.now() + SESSION_TTL_MS, nonce: randomBytes(8).toString("hex") });
        return send(res, 200, { ok: true }, { "set-cookie": cookieHeader(COOKIE, value, { maxAge: SESSION_TTL_MS / 1000, secure: isSecure(req, cfg) }) });
      }
      if (route === "POST /api/logout") {
        return send(res, 200, { ok: true }, { "set-cookie": cookieHeader(COOKIE, "", { maxAge: 0, secure: isSecure(req, cfg) }) });
      }

      // Everything below needs a valid session cookie ----------------------
      if (!url.pathname.startsWith("/api/")) return send(res, 404, { error: "Not found." });
      if (!authed(req)) return send(res, 401, { error: "Sign in first." });

      if (route === "GET /api/me") {
        return send(res, 200, { ok: true, hermes: { bin: cfg.hermesBin, cwd: cfg.hermesCwd }, langfuse: hermesStatus(cfg) });
      }

      // Rate-limit / reset visibility (Agents view, bamware-ai#75). `mode=demo`
      // serves only synthetic, clearly-labelled fixtures for UI preview/QA;
      // it never substitutes for or blends with the live snapshot.
      if (route === "GET /api/rate-limits") {
        const mode = url.searchParams.get("mode") === "demo" ? "demo" : "live";
        const serverQuota = mode === "live" ? await readServerQuota({ serverQuotaFile: cfg.serverQuotaFile }) : { coverage: [], windows: [] };
        const adapters = mode === "demo" ? [{ name: "demo", run: demoAdapter }] : [{ name: "claude-max", run: claudeMaxAdapter }, { name: "codex", run: codexQuotaAdapter }, { name: "server", run: () => serverQuota.windows }];
        const snapshot = await buildSnapshot(adapters, { quotaSamplesFile: cfg.quotaSamplesFile, codexQuotaFile: cfg.codexQuotaFile }, { now: Date.now() });
        return send(res, 200, { ...snapshot, mode, coverage: serverQuota.coverage });
      }

      // Work/agents analytics (Agents view, bamware-ai#76): usage by
      // project/ticket, active agents, work-vs-waiting and outcomes/rework.
      // `mode=demo` is an explicit opt-in synthetic preview, never blended
      // with the live snapshot (same rule as /api/rate-limits).
      if (route === "GET /api/work-usage") {
        const mode = url.searchParams.get("mode") === "demo" ? "demo" : "live";
        const adapters =
          mode === "demo"
            ? [{ name: "demo", run: workUsageDemoAdapter }]
            : [{ name: "self", run: (c) => workUsageSelfAdapter(c) }, { name: "overnight", run: () => overnightUsageAdapter(cfg.overnightUsageFile) }];
        const workCtx = { repoDir: cfg.hermesCwd, repoName: path.basename(REPO_ROOT) };
        const snapshot = await buildWorkUsageSnapshot(adapters, workCtx, {
          now: Date.now(),
          mode,
          routingRules: mode === "demo" ? demoRoutingRules : [],
        });
        return send(res, 200, snapshot);
      }

      // Decisions card deck (Command Center MVP, bamware-ai#78). `mode=demo`
      // serves the synthetic candidate deck and a fixture worker so the full
      // response/handoff lifecycle can be exercised safely; the real deck
      // never dispatches to that fixture and always reports an honest
      // "handoff_pending" because no live worker interface is confirmed.
      const decisionsMatch = url.pathname.match(/^\/api\/decisions(?:\/([^/]+)(\/respond|\/handoff\/refresh)?)?$/);
      if (decisionsMatch) {
        const mode = url.searchParams.get("mode") === "demo" ? "demo" : "live";
        const candidates = mode === "demo" ? demoDecisionCandidates() : DECISION_CANDIDATES;
        const storeFile = mode === "demo" ? cfg.decisionsDemoFile : cfg.decisionsFile;
        const [, decisionId, action] = decisionsMatch;

        if (req.method === "GET" && !decisionId) {
          const store = loadDecisionStore(storeFile);
          return send(res, 200, { ...buildDecisionsSnapshot(candidates, store), mode });
        }

        if (decisionId) {
          const candidate = candidates.find((c) => c.id === decisionId);
          if (!candidate) return send(res, 404, { error: "Unknown decision id for this mode." });

          if (req.method === "POST" && action === "/respond") {
            const body = await readJson(req);
            const worker = mode === "demo" ? (body.simulateWorker === "unavailable" ? fixtureWorkerUnavailable : demoAcceptingWorker) : undefined;
            try {
              const { decision, duplicate } = await respondToDecision(storeFile, candidate, body, { worker });
              log({ event: "decision.respond", requestId, mode, decisionId, action: body.action, duplicate });
              return send(res, 200, { decision, duplicate, mode });
            } catch (err) {
              if (err.status) return send(res, err.status, { error: err.message, code: err.code });
              throw err;
            }
          }

          if (req.method === "POST" && action === "/handoff/refresh") {
            const worker = mode === "demo" ? demoAcceptingWorker : undefined;
            const { decision, refreshed } = await refreshHandoff(storeFile, candidate, { worker });
            return send(res, 200, { decision, refreshed, mode });
          }
        }
        return send(res, 404, { error: "Not found." });
      }

      if (route === "POST /api/chat") {
        const body = await readJson(req);
        const v = validateChatInput(body);
        if (v.error) return send(res, 400, { error: v.error });
        if (runner.depth >= cfg.maxQueue) return send(res, 429, { error: "Assistant is busy. Try again in a moment." });
        const args = ["chat", "-Q", "-q", v.text];
        if (v.sessionId) args.push("--resume", v.sessionId);
        log({ event: "chat.start", requestId, resume: Boolean(v.sessionId), textChars: v.text.length });
        const r = await runner.run(args, { requestId });
        const parsed = parseHermesOutput(r.stdout, r.stderr);
        if (r.code !== 0 || !parsed.reply) {
          log({ event: "chat.fail", requestId, code: r.code, errorLine: parsed.errorLine });
          return send(res, 502, { error: parsed.errorLine ?? `Hermes exited with code ${r.code}.`, sessionId: parsed.sessionId, requestId });
        }
        return send(res, 200, {
          reply: parsed.reply,
          sessionId: parsed.sessionId,
          requestId,
          elapsedMs: r.elapsedMs,
          // Langfuse groups traces by the Hermes session id; the trace name is "Hermes turn".
          trace: { langfuseSessionId: parsed.sessionId, environment: process.env.HERMES_LANGFUSE_ENV || "assistant-web" },
        });
      }

      const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)(\/export)?$/);
      if (sessionMatch) {
        const sid = sessionMatch[1];
        if (!SESSION_ID_RE.test(sid)) return send(res, 400, { error: "Not a Hermes session id." });
        if (req.method === "GET" && sessionMatch[2]) {
          const r = await runner.run(["sessions", "export", "--session-id", sid, "--format", "jsonl", "-"], { requestId });
          if (r.code !== 0) return send(res, 502, { error: "Export failed.", requestId });
          return send(res, 200, r.stdout, { "content-type": "application/x-ndjson; charset=utf-8", "content-disposition": `attachment; filename="hermes-${sid}.jsonl"` });
        }
        if (req.method === "DELETE" && !sessionMatch[2]) {
          const r = await runner.run(["sessions", "delete", "--yes", sid], { requestId });
          if (r.code !== 0) return send(res, 502, { error: "Delete failed.", requestId });
          return send(res, 200, { ok: true, deleted: sid });
        }
      }

      return send(res, 404, { error: "Not found." });
    } catch (err) {
      const status = err.status ?? 500;
      log({ event: "error", requestId, route, status, message: err.message });
      return send(res, status, { error: status === 500 ? "Internal error." : err.message, requestId });
    }
  });
  server.requestTimeout = cfg.hermesTimeoutMs + 30_000;
  server.headersTimeout = 30_000;
  return server;
}

function defaultLog(fields) {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), ...fields }) + "\n");
}

// ------------------------------------------------------------------ main ---
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { cfg, problems } = loadConfig();
  if (problems.length) {
    console.error(`assistant-web: refusing to start.\n  ${problems.join("\n  ")}\n  Env file: ${cfg.envFile}`);
    process.exit(2);
  }
  const server = createServer(cfg);
  server.listen(cfg.port, cfg.host, () => {
    defaultLog({ event: "listening", host: cfg.host, port: cfg.port, hermesCwd: cfg.hermesCwd, envFile: cfg.envFile });
  });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
}
