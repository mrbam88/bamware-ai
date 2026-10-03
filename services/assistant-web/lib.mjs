// Pure helpers for the assistant website. No I/O here so tests stay fast.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_ID_RE = /^[0-9]{8}_[0-9]{6}_[0-9a-f]{6,16}$/;
export const MAX_TEXT_CHARS = 4000;

/** Parse a KEY=VALUE env file. Ignores blanks and # comments; strips matching quotes. */
export function parseEnvFile(text) {
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Hermes quiet single-query contract (cli.py, -Q -q): stdout is the final
 * response; stderr ends with "session_id: <id>"; exit 1 on a failed turn.
 */
export function parseHermesOutput(stdout, stderr) {
  const reply = String(stdout).replace(/\s+$/, "");
  let sessionId = null;
  const matches = [...String(stderr).matchAll(/^session_id:\s*(\S+)\s*$/gm)];
  if (matches.length) sessionId = matches[matches.length - 1][1];
  const errorLine = String(stderr)
    .split(/\r?\n/)
    .find((l) => l.startsWith("Error:"));
  return { reply, sessionId: sessionId && SESSION_ID_RE.test(sessionId) ? sessionId : null, errorLine: errorLine ?? null };
}

export function validateChatInput(body) {
  if (!body || typeof body !== "object") return { error: "Body must be a JSON object." };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return { error: "text is required." };
  if (text.length > MAX_TEXT_CHARS) return { error: `text must be at most ${MAX_TEXT_CHARS} characters.` };
  let sessionId = null;
  if (body.sessionId != null && body.sessionId !== "") {
    if (typeof body.sessionId !== "string" || !SESSION_ID_RE.test(body.sessionId)) {
      return { error: "sessionId is not a Hermes session id." };
    }
    sessionId = body.sessionId;
  }
  return { text, sessionId };
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

/** Sign a small JSON payload into an opaque cookie value: <payload>.<hmac>. */
export function signSession(secret, payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** Verify a cookie value; returns the payload or null (bad signature, expired, malformed). */
export function verifySession(secret, value, now = Date.now()) {
  if (typeof value !== "string") return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp <= now) return null;
  return payload;
}

/** Constant-time string equality for the shared password. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // Compare against self to keep timing flat, then fail.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/** Sliding-window failed-login limiter keyed by client address. */
export class LoginLimiter {
  constructor({ max = 5, windowMs = 15 * 60_000 } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
  }
  _prune(key, now) {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, list);
    return list;
  }
  blocked(key, now = Date.now()) {
    return this._prune(key, now).length >= this.max;
  }
  fail(key, now = Date.now()) {
    this._prune(key, now).push(now);
  }
  reset(key) {
    this.hits.delete(key);
  }
}
