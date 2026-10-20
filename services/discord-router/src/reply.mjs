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

/** Send text in ≤LIMIT chunks, or as a file when it is long. `channel` needs .send(); `fileOf` builds an attachment. */
export async function deliver(channel, text, footer, fileOf) {
  const body = String(text || '').trim();
  if (body.length > LIMIT * 2 && fileOf) {
    await channel.send({ content: footer ? `_${footer}_` : undefined, files: [fileOf(body)] });
    return;
  }
  for (const chunk of chunks(body, LIMIT)) await channel.send({ content: chunk });
  if (footer) await channel.send({ content: `_${footer}_` });
}
