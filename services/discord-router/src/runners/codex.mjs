// Runner adapter: OpenAI Codex CLI. `codex exec` first turn, `codex exec resume <id>` after.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const name = 'codex';

// cwd comes from spawn(); `codex exec resume` rejects -C, so no -C anywhere.
export function command({ prompt, meta }) {
  const common = ['--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', '--json'];
  const argv = meta.sessionId
    ? ['codex', 'exec', 'resume', ...common, meta.sessionId, prompt]
    : ['codex', 'exec', ...common, prompt];
  return { argv, meta };
}

/** `--json` prints one event per line; the first carries the thread/session id. */
export function sessionFrom(output) {
  for (const line of String(output || '').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      const ev = JSON.parse(t);
      const id = ev.thread_id || ev.session_id || (ev.thread && ev.thread.id) || (ev.session && ev.session.id);
      if (id) return String(id);
    } catch { /* not an event line */ }
  }
  return null;
}

/** Final answer text from the JSON event stream; falls back to raw output. */
export function answerFrom(output) {
  const texts = [];
  for (const line of String(output || '').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      const ev = JSON.parse(t);
      const item = ev.item || ev;
      if ((item.type === 'agent_message' || item.type === 'message') && typeof item.text === 'string') texts.push(item.text);
      else if (ev.type === 'item.completed' && item.type === 'agent_message' && item.content) texts.push(String(item.content));
    } catch { /* ignore */ }
  }
  return texts.length ? texts[texts.length - 1] : output;
}

/** Walk ~/.codex/sessions/YYYY/MM/DD for the rollout file of one thread. */
function rolloutFor(sessionId, codexHome) {
  const root = path.join(codexHome, 'sessions');
  const walk = (dir, depth) => {
    let names = [];
    try { names = readdirSync(dir); } catch { return null; }
    for (const n of names.sort().reverse()) {
      const p = path.join(dir, n);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory() && depth < 3) { const hit = walk(p, depth + 1); if (hit) return hit; }
      else if (st.isFile() && n.endsWith(`${sessionId}.jsonl`)) return p;
    }
    return null;
  };
  return walk(root, 0);
}

/** Model used this turn: from the event stream if it says, else the thread's rollout log, else config.toml. */
export function modelFrom(output, { env = process.env } = {}) {
  for (const line of String(output || '').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      const ev = JSON.parse(t);
      const m = ev.model || (ev.item && ev.item.model) || (ev.turn && ev.turn.model);
      if (typeof m === 'string' && m) return m;
    } catch { /* ignore */ }
  }
  const codexHome = env.CODEX_HOME || path.join(env.HOME || homedir(), '.codex');
  const sid = sessionFrom(output);
  const file = sid ? rolloutFor(sid, codexHome) : null;
  if (file) {
    try {
      const m = /"model":"([^"]+)"/.exec(readFileSync(file, 'utf8'));
      if (m) return m[1];
    } catch { /* ignore */ }
  }
  try {
    const m = /^\s*model\s*=\s*"([^"]+)"/m.exec(readFileSync(path.join(codexHome, 'config.toml'), 'utf8'));
    if (m) return m[1];
  } catch { /* ignore */ }
  return null;
}

export const authCheck = { argv: ['codex', 'login', 'status'], deadPattern: /not logged in/i };
