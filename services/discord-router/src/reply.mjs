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
