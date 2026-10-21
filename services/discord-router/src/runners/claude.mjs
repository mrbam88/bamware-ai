// Runner adapter: Claude Code (official CLI, Claude Max). Bypass mode per ADR 0002.
// JSON output so the seat can read the answer and the model actually used.
import { randomUUID } from 'node:crypto';

export const name = 'claude';

/** argv for one turn. `meta.sessionId` persists across turns in the thread sidecar. */
export function command({ prompt, meta }) {
  const sessionId = meta.sessionId || randomUUID();
  const argv = ['claude', '-p', '--dangerously-skip-permissions', '--output-format', 'json'];
  argv.push(meta.sessionId ? '--resume' : '--session-id', sessionId);
  argv.push(prompt);
  return { argv, meta: { ...meta, sessionId } };
}

/** The final `{"type":"result", ...}` object, or null when the output is not JSON (errors, logged out). */
function resultOf(output) {
  const lines = String(output || '').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{'));
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const ev = JSON.parse(lines[i]);
      if (ev && ev.type === 'result') return ev;
    } catch { /* not JSON */ }
  }
  return null;
}

/** Pull a session id out of the output (not needed: we assign it). */
export function sessionFrom() { return null; }

export function answerFrom(output) {
  const r = resultOf(output);
  return r && typeof r.result === 'string' ? r.result : output;
}

/** Model with the most output tokens in `modelUsage`; Haiku is a helper, so skip it when anything else ran. */
export function modelFrom(output) {
  const r = resultOf(output);
  const usage = r && r.modelUsage && typeof r.modelUsage === 'object' ? Object.entries(r.modelUsage) : [];
  if (!usage.length) return null;
  const main = usage.filter(([id]) => !/haiku/i.test(id));
  const pool = main.length ? main : usage;
  pool.sort((a, b) => Number(b[1]?.outputTokens || 0) - Number(a[1]?.outputTokens || 0));
  return pool[0][0];
}

export const authCheck = { argv: ['claude', 'auth', 'status'], deadPattern: /"loggedIn":\s*false|not (?:logged in|authenticated)|please (?:log|sign) in/i };
