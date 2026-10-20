// Runner adapter: opencode (multi-provider; Copilot through the gh token on omarchy).
// Model is optional: set BAMWARE_OPENCODE_MODEL (provider/model) to pin one.
export const name = 'opencode';

export function command({ prompt, meta, cwd, env = process.env }) {
  const argv = ['opencode', 'run', '--format', 'json', '--dir', cwd];
  if (env.BAMWARE_OPENCODE_MODEL) argv.push('--model', env.BAMWARE_OPENCODE_MODEL);
  if (meta.sessionId) argv.push('--session', meta.sessionId);
  argv.push(prompt);
  return { argv, meta };
}

export function sessionFrom(output) {
  for (const line of String(output || '').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      const ev = JSON.parse(t);
      const id = ev.sessionID || ev.sessionId || (ev.properties && ev.properties.sessionID) || (ev.info && ev.info.sessionID);
      if (id) return String(id);
    } catch { /* ignore */ }
  }
  return null;
}

export function answerFrom(output) {
  const texts = [];
  for (const line of String(output || '').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      const ev = JSON.parse(t);
      const part = ev.part || ev.properties?.part || ev;
      if (part && part.type === 'text' && typeof part.text === 'string') texts.push(part.text);
    } catch { /* ignore */ }
  }
  return texts.length ? texts.join('') : output;
}

export const authCheck = { argv: ['opencode', 'auth', 'list'], deadPattern: /no credentials|not logged in/i };
