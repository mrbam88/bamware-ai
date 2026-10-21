// Discord delivery helpers, kept free of discord.js imports so they are testable.
export const LIMIT = 1900;

export function chunks(s, size = LIMIT) {
  const out = [];
  let rest = s;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size / 2) cut = size;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest.length || !out.length) out.push(rest || '(empty)');
  return out;
}

/** Header line first, then text in ≤LIMIT chunks (or a file when long), then the footer. `channel` needs .send(); `fileOf` builds an attachment. */
export async function deliver(channel, text, footer, fileOf, header) {
  const answer = String(text || '').trim();
  if (answer.length > LIMIT * 2 && fileOf) {
    const content = [header, footer ? `_${footer}_` : ''].filter(Boolean).join('\n');
    await channel.send({ content: content || undefined, files: [fileOf(answer)] });
    return;
  }
  const body = header ? `${header}\n${answer}` : answer;
  for (const chunk of chunks(body, LIMIT)) await channel.send({ content: chunk });
  if (footer) await channel.send({ content: `_${footer}_` });
}

/**
 * Keep Bilal informed while a turn runs, so he never stares at a typing dot (Bilal, 2026-10-20).
 * After `firstAfterMs` with no answer, `post(text)` once; then `edit(text)` every `everyMs`.
 * `stop()` cancels the timers and removes the notice. Returns { stop, setWhat }.
 */
export function waitNotice({ post, edit, remove, firstAfterMs = 15_000, everyMs = 30_000, now = Date.now }) {
  const start = now();
  let what = 'Working on it';
  let posted = false;
  let interval = null;
  const text = () => {
    const s = Math.round((now() - start) / 1000);
    const dur = s < 90 ? `${s}s` : `${Math.round(s / 60)} min`;
    return `${what} (${dur} so far). Keep going; the answer lands here when ready.`;
  };
  const first = setTimeout(async () => {
    posted = true;
    try { await post(text()); } catch { /* best effort */ }
    interval = setInterval(() => { edit(text()).catch?.(() => {}); }, everyMs);
  }, firstAfterMs);
  return {
    setWhat(w) { what = w; },
    async stop() {
      clearTimeout(first);
      if (interval) clearInterval(interval);
      if (posted) { try { await remove(); } catch { /* gone already */ } }
    },
  };
}
