// Pick a runner. Pure function so it is testable without Discord or a CLI.
//
// Order of checks:
//   1. CFO halt → nobody runs (company Rule #1).
//   2. Forced prefix (!claude / !codex / ...) → that runner, unless dead or halted.
//   3. In configured order: skip dead, skip cooling down, skip under floor.
//      Known-headroom runners above floor win first; unknown-headroom runners
//      are tried after every known one failed (always last).
//   4. Nothing left → queued, with the earliest reset among known pools.
import { headroom } from './headroom.mjs';

// Force prefix: !claude, >codex, ❯ opencode, @claude … (Discord clients rewrite some symbols).
export const FORCE_RE = /^[!>❯@]\s*([a-z0-9-]+)\s*/i;

/** Split "!codex status?" into { forced: "codex", text: "status?" }. */
export function parseForce(text, runners) {
  const m = FORCE_RE.exec(text || '');
  if (!m) return { forced: null, text: (text || '').trim() };
  const name = m[1].toLowerCase();
  if (!runners.order.some((r) => r.name === name)) return { forced: null, text: text.trim() };
  return { forced: name, text: text.slice(m[0].length).trim() };
}

/**
 * @param {object} args
 * @param {object} args.runners     loadRunners() result
 * @param {object} args.capacity    parsed capacity.json (or null)
 * @param {object|null} args.halt   parsed halt.json ({halted, reason}) or null
 * @param {string|null} args.forced runner name from a ! prefix
 * @param {object} args.state       { cooldowns: {name: untilEpochSec}, dead: {name: reason} }
 * @param {number} args.now         epoch seconds
 */
export function pick({ runners, capacity, halt, forced, state, now }) {
  if (halt && halt.halted) return { kind: 'halt', reason: halt.reason || 'CFO halt' };
  const cooldowns = (state && state.cooldowns) || {};
  const dead = (state && state.dead) || {};

  if (forced) {
    if (dead[forced]) return { kind: 'dead', runner: forced, reason: dead[forced] };
    return { kind: 'run', runner: forced, reason: 'forced' };
  }

  const unknowns = [];
  let earliestReset = null;
  for (const r of runners.order) {
    if (dead[r.name]) continue;
    if (cooldowns[r.name] && cooldowns[r.name] > now) continue;
    const h = headroom(r, capacity);
    if (h.unknown) {
      unknowns.push(r.name);
      continue;
    }
    if (h.pct >= runners.floor_pct) return { kind: 'run', runner: r.name, reason: `headroom ${h.pct}%` };
    if (h.reset_at && (earliestReset === null || h.reset_at < earliestReset)) earliestReset = h.reset_at;
  }
  if (unknowns.length) return { kind: 'run', runner: unknowns[0], reason: 'unknown headroom' };
  return { kind: 'queued', reset_at: earliestReset };
}

/** Rate-limit signature shared by the CLIs we know. */
export const RATE_LIMIT_RE = /rate.?limit|too many requests|\b429\b|usage limit|limit (?:has been )?reached|quota (?:exceeded|exhausted)|out of (?:credits|quota)/i;

export function looksRateLimited(output, exitCode) {
  if (!output) return false;
  return RATE_LIMIT_RE.test(output) && (exitCode !== 0 || /\b(reached|exceeded|exhausted)\b/i.test(output));
}

/** Record a rate limit: cooldown that runner for cooldown_min. Returns the new state. */
export function coolDown(state, name, runners, now) {
  const next = { ...state, cooldowns: { ...(state.cooldowns || {}) } };
  next.cooldowns[name] = now + runners.cooldown_min * 60;
  return next;
}
