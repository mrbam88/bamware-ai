// Runner adapter: OpenAI Codex CLI. `codex exec` first turn, `codex exec resume <id>` after.
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

export const authCheck = { argv: ['codex', 'login', 'status'], deadPattern: /not logged in/i };
