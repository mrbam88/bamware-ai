// Board cache: pull GitHub Project 2 to ~/.local/state/bamware/board/latest.json
// so runners read a file instead of calling gh for every question. Run by a
// systemd timer every 10 minutes. Writes go through gh as before.
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { paths } from './config.mjs';
import { run } from './spawn.mjs';

export async function refresh(P = paths(), runFn = run) {
  const res = await runFn(['gh', 'project', 'item-list', '2', '--owner', 'mrbam88', '--format', 'json', '--limit', '500'], { timeoutMs: 120_000 });
  if (res.code !== 0) throw new Error(`gh project item-list failed (exit ${res.code}): ${res.output.slice(-300)}`);
  const doc = JSON.parse(res.output);
  doc.fetched_at = new Date().toISOString();
  mkdirSync(path.dirname(P.board), { recursive: true, mode: 0o700 });
  const tmp = `${P.board}.tmp`;
  writeFileSync(tmp, JSON.stringify(doc) + '\n', { mode: 0o600 });
  renameSync(tmp, P.board);
  return { items: (doc.items || []).length, file: P.board };
}

if (process.argv[1] && process.argv[1].endsWith('board-cache.mjs')) {
  refresh().then((r) => console.log(`board cache: ${r.items} items → ${r.file}`)).catch((err) => { console.error(err.message); process.exit(1); });
}
