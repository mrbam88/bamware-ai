// "do ticket mrbam88/bamware-ai#196" → claim on the board, write a one-ticket
// manifest, start the Overnight executor. The seat routes; the executor executes.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const DISPATCH_RE = /^(?:do|run|dispatch|start|execute)\s+(?:ticket\s+)?((?:[\w.-]+\/[\w.-]+)?#\d+)\b/i;
const DEFAULT_REPO = 'mrbam88/bamware-ai';

/** @returns {{ticket: string, repo: string, number: number}|null} */
export function parseDispatch(text, defaultRepo = DEFAULT_REPO) {
  const m = DISPATCH_RE.exec(String(text || '').trim());
  if (!m) return null;
  const [repoPart, num] = m[1].split('#');
  const repo = repoPart || defaultRepo;
  return { ticket: `${repo}#${num}`, repo, number: Number(num) };
}

export function manifestFor({ ticket, requestedBy, at = new Date() }) {
  return {
    schema: 1,
    unresolved_decisions: [],
    source: { seat: 'discord-router', requested_by: requestedBy, at: at.toISOString() },
    tasks: [{ ticket }],
  };
}

export function writeManifest(stateDir, manifest) {
  const dir = path.join(stateDir, 'manifests');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${manifest.source.at.replace(/[:.]/g, '-')}-${manifest.tasks[0].ticket.replace(/[^\w]+/g, '_')}.json`);
  writeFileSync(file, JSON.stringify(manifest, null, 1) + '\n', { mode: 0o600 });
  return file;
}

/** Board item id for an issue number from the board cache (latest.json), or null. */
export function boardItemFor(boardCachePath, repo, number) {
  let doc;
  try { doc = JSON.parse(readFileSync(boardCachePath, 'utf8')); } catch { return null; }
  const items = doc.items || [];
  const hit = items.find((i) => {
    const c = i.content || {};
    const url = String(c.url || '');
    return c.number === number && (!url || url.includes(`/${repo}/`));
  });
  return hit ? hit.id : null;
}

/** The exact commands a claim needs (skills/board-ops: Status → In Progress + comment). */
export function claimCommands({ repo, number, itemId, project, who = 'discord-router' }) {
  const cmds = [
    ['gh', 'issue', 'comment', String(number), '-R', repo, '--body', `claimed by ${who}: dispatched to the Overnight executor from Discord`],
  ];
  if (itemId && project) {
    cmds.push(['gh', 'project', 'item-edit', '--project-id', project.id, '--id', itemId,
      '--field-id', project.statusFieldId, '--single-select-option-id', project.inProgressOptionId]);
  }
  return cmds;
}

export function executorCommand({ repo, manifestFile, overnightState }) {
  return ['python3', path.join(repo, 'services', 'overnight', 'runner.py'), 'start', manifestFile, '--state-dir', overnightState];
}

// Board 2 ids as of 2026-10-20 (skills/board-ops: re-fetch if edits fail).
export const BOARD = {
  id: 'PVT_kwHOAR0OWc4BeGkc',
  statusFieldId: 'PVTSSF_lAHOAR0OWc4BeGkczhYjQ1A',
  inProgressOptionId: '33504b24',
};
