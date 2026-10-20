// Runner adapter: Claude Code (official CLI, Claude Max). Bypass mode per ADR 0002.
import { randomUUID } from 'node:crypto';

export const name = 'claude';

/** argv for one turn. `meta.sessionId` persists across turns in the thread sidecar. */
export function command({ prompt, meta }) {
  const sessionId = meta.sessionId || randomUUID();
  const argv = ['claude', '-p', '--dangerously-skip-permissions', '--output-format', 'text'];
  argv.push(meta.sessionId ? '--resume' : '--session-id', sessionId);
  argv.push(prompt);
  return { argv, meta: { ...meta, sessionId } };
}

/** Pull a session id out of the output (not needed: we assign it). */
export function sessionFrom() { return null; }

export const authCheck = { argv: ['claude', 'auth', 'status'], deadPattern: /"loggedIn":\s*false|not (?:logged in|authenticated)|please (?:log|sign) in/i };
