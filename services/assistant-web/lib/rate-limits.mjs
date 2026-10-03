// Rate-limit / reset data contract for the Agents view (bamware-ai#75, #76).
//
// Goal: never let a provider adapter *assert* "fresh" or "exhausted" by
// itself. Adapters only report raw facts (tokens, reset time, where the
// reading came from); this module derives the displayed state so a buggy or
// optimistic adapter cannot silently fabricate confidence. Numbers are wiped
// whenever the state is "unknown"/"unsupported" so the UI never prints a
// number it cannot back up (bamware-ai#75: "no guessed quota percentage ...
// presented as fact").
//
// No network or filesystem I/O lives here; see lib/providers/*.mjs for
// adapters that gather raw readings.

export const RATE_LIMIT_CONTRACT_VERSION = "1";

/** @type {readonly string[]} */
export const RATE_LIMIT_STATES = Object.freeze(["fresh", "stale", "exhausted", "unknown", "unsupported"]);

/**
 * "live": a real provider/account reading. "synthetic": fixture/demo data
 * that must never be presented as live. "unsupported": a real provider for
 * which no authoritative read-only source is wired yet.
 * @type {readonly string[]}
 */
export const SOURCE_KINDS = Object.freeze(["live", "synthetic", "unsupported"]);

const DEFAULT_STALE_AFTER_SEC = 15 * 60; // past this reading age, trust drops to "stale"
const DEFAULT_WARNING_PCT = 80;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function parseMs(iso) {
  if (typeof iso !== "string" || !iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Percentage of the window consumed, or null if either input is unknown. */
export function deriveUtilizationPct(usedTokens, limitTokens) {
  if (!isFiniteNumber(usedTokens) || !isFiniteNumber(limitTokens) || limitTokens <= 0) return null;
  return round1((usedTokens / limitTokens) * 100);
}

/**
 * Raw reading shape an adapter returns (one per provider/account/scope):
 * {
 *   provider, account, scope,            // identity, no secrets
 *   usedTokens, limitTokens,             // numbers or null (unknown)
 *   resetAt,                             // ISO 8601 instant or null
 *   resetTimezone,                       // IANA zone for display, or null
 *   source: { kind, label, fetchedAt },  // provenance (kind is overridable
 *                                        // only by the trusted wrapper, see
 *                                        // wrapSyntheticAdapter/unsupportedWindow)
 *   notes,                               // short human string or null
 * }
 *
 * Normalizes a raw reading into a displayable window with a derived `state`.
 * @param {object} raw
 * @param {{now?: number, staleAfterSec?: number, warningPct?: number}} [opts]
 */
export function buildWindow(raw, opts = {}) {
  const now = opts.now ?? Date.now();
  const staleAfterSec = opts.staleAfterSec ?? DEFAULT_STALE_AFTER_SEC;
  const warningPct = opts.warningPct ?? DEFAULT_WARNING_PCT;

  const source = raw && raw.source ? raw.source : {};
  const kind = SOURCE_KINDS.includes(source.kind) ? source.kind : "unsupported";
  const fetchedAtMs = parseMs(source.fetchedAt);
  const freshnessSec = fetchedAtMs != null ? Math.max(0, round1((now - fetchedAtMs) / 1000)) : null;
  const resetAtMs = parseMs(raw && raw.resetAt);

  let usedTokens = isFiniteNumber(raw?.usedTokens) ? raw.usedTokens : null;
  let limitTokens = isFiniteNumber(raw?.limitTokens) ? raw.limitTokens : null;
  let reportedPct = isFiniteNumber(raw?.utilizationPct) && raw.utilizationPct >= 0 ? raw.utilizationPct : null;
  let notes = raw && typeof raw.notes === "string" ? raw.notes : null;

  let state;
  let supersededByReset = false;
  if (kind === "unsupported") {
    state = "unsupported";
  } else if (((usedTokens == null || limitTokens == null) && reportedPct == null) || fetchedAtMs == null) {
    state = "unknown";
  } else if (resetAtMs != null && fetchedAtMs < resetAtMs && now >= resetAtMs) {
    // The reading was taken before the window's own reset time, and that
    // reset has since passed: the number on file no longer describes the
    // *current* window. Report the transition honestly instead of either
    // carrying a stale "exhausted" forward or inventing a fresh zero.
    state = "stale";
    supersededByReset = true;
    notes = [notes, "Reading predates the window's reset; current usage is unknown until the next refresh."]
      .filter(Boolean)
      .join(" ");
  } else {
    const pct = reportedPct ?? deriveUtilizationPct(usedTokens, limitTokens);
    if (freshnessSec != null && freshnessSec > staleAfterSec) state = "stale";
    else if (pct != null && pct >= 100) state = "exhausted";
    else state = "fresh";
  }

  // Never print numbers we cannot stand behind: unknown/unsupported never had
  // any, and a reading superseded by its own window's reset no longer
  // describes anything current.
  if (state === "unknown" || state === "unsupported" || supersededByReset) {
    reportedPct = null;
    usedTokens = null;
    limitTokens = null;
  }

  const utilizationPct = state === "unknown" || state === "unsupported" ? null : reportedPct ?? deriveUtilizationPct(usedTokens, limitTokens);
  const warning = state === "exhausted" || (utilizationPct != null && utilizationPct >= warningPct);

  return {
    id: `${raw?.provider ?? "unknown-provider"}:${raw?.scope ?? "unknown-scope"}`,
    provider: raw?.provider ?? "unknown-provider",
    account: raw?.account ?? null,
    identityEvidence: raw?.identityEvidence ?? null,
    harness: raw?.harness ?? null,
    machine: raw?.machine ?? null,
    scope: raw?.scope ?? "unknown-scope",
    state,
    usedTokens,
    limitTokens,
    utilizationPct,
    warning,
    resetAt: raw?.resetAt ?? null,
    resetTimezone: raw?.resetTimezone ?? null,
    source: { kind, label: source.label ?? null, fetchedAt: source.fetchedAt ?? null },
    freshnessSec,
    notes,
  };
}

/** Honest placeholder for a real provider with no wired read-only source. Never carries numbers. */
export function unsupportedWindow({ provider, account = null, scope, reason }) {
  return {
    provider,
    account,
    scope,
    usedTokens: null,
    limitTokens: null,
    resetAt: null,
    resetTimezone: null,
    source: { kind: "unsupported", label: reason, fetchedAt: new Date().toISOString() },
    notes: reason,
  };
}

/**
 * Wraps an adapter so its windows are always tagged `source.kind: "synthetic"`
 * regardless of what the adapter itself sets — a fixture bug can never make
 * demo data present as "live".
 * @param {() => Promise<object[]> | object[]} adapter
 */
export function wrapSyntheticAdapter(adapter) {
  return async (ctx) => {
    const windows = await adapter(ctx);
    return windows.map((w) => ({ ...w, source: { ...(w.source ?? {}), kind: "synthetic" } }));
  };
}

/**
 * Runs every adapter, builds normalized windows, and turns a throwing or
 * malformed adapter into an honest "unsupported" window instead of failing
 * the whole snapshot or silently dropping the provider.
 * @param {Array<{name: string, run: Function}>} adapters
 * @param {object} [ctx]
 * @param {{now?: number}} [opts]
 */
export async function buildSnapshot(adapters, ctx = {}, opts = {}) {
  const now = opts.now ?? Date.now();
  const windows = [];
  for (const { name, run } of adapters) {
    try {
      const raw = await run(ctx);
      if (!Array.isArray(raw) || raw.length === 0) {
        windows.push(buildWindow(unsupportedWindow({ provider: name, scope: "unknown", reason: "Adapter returned no windows." }), { now }));
        continue;
      }
      for (const r of raw) windows.push(buildWindow(r, { now }));
    } catch (err) {
      windows.push(
        buildWindow(unsupportedWindow({ provider: name, scope: "unknown", reason: `Adapter failed: ${err.message}` }), { now }),
      );
    }
  }
  // Only explicit provider account identity proves sharing. Provider names,
  // display aliases and coincidentally equal percentages are not evidence.
  const grouped = new Map();
  for (const [index, w] of windows.entries()) {
    const proven = w.account && w.identityEvidence === "provider-account-id-sha256";
    const key = proven ? JSON.stringify([w.provider, w.account, w.scope, w.source.kind]) : `unmatched:${index}`;
    const observation = { harness: w.harness, machine: w.machine, source: w.source };
    const previous = grouped.get(key);
    if (!previous) {
      grouped.set(key, { ...w, id: `${w.id}:${index}`, observations: [observation] });
    } else {
      const newest = (parseMs(w.source.fetchedAt) ?? -Infinity) > (parseMs(previous.source.fetchedAt) ?? -Infinity) ? w : previous;
      grouped.set(key, { ...newest, id: previous.id, observations: [...previous.observations, observation] });
    }
  }
  return { version: RATE_LIMIT_CONTRACT_VERSION, generatedAt: new Date(now).toISOString(), windows: [...grouped.values()] };
}

/** Human label for a reset time, explicit about timezone; null-safe. */
export function formatResetLabel(window, { locale = "en-US" } = {}) {
  if (!window.resetAt) return "Reset time unknown";
  const ms = parseMs(window.resetAt);
  if (ms == null) return "Reset time unknown";
  const timeZone = window.resetTimezone || "UTC";
  try {
    const formatted = new Intl.DateTimeFormat(locale, {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
    return `Resets ${formatted} (${timeZone})`;
  } catch {
    return `Resets ${window.resetAt} (${timeZone})`;
  }
}
