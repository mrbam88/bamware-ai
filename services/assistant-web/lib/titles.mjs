// Ticket titles for the Agents tab: people read titles, not numbers. Looked up
// through the server's gh CLI, cached for hours, and never allowed to slow a
// page load; an unknown title just falls back to the ticket reference.
import { execFile } from "node:child_process";

const TTL_MS = 6 * 60 * 60_000;
const REF = /^([\w.-]+)\/([\w.-]+)#(\d+)$/;

function ghTitle(ref, timeoutMs = 10_000) {
  const [, owner, repo, number] = REF.exec(ref);
  return new Promise((resolve, reject) => {
    execFile("gh", ["api", `repos/${owner}/${repo}/issues/${number}`, "-q", ".title"], { timeout: timeoutMs },
      (err, stdout) => (err ? reject(err) : resolve(stdout.trim() || null)));
  });
}

export function createTitleReader({ fetchTitle = ghTitle, ttlMs = TTL_MS, clock = Date.now } = {}) {
  const cache = new Map(); // ref -> { title, at }
  const inflight = new Map();
  const load = (ref) => {
    if (!inflight.has(ref)) {
      inflight.set(ref, fetchTitle(ref)
        .then((title) => cache.set(ref, { title, at: clock() }))
        // A failed lookup keeps any old title and retries in ~5 minutes, not after the full cache life.
        .catch(() => cache.set(ref, { title: cache.get(ref)?.title ?? null, at: clock() - ttlMs + 5 * 60_000 }))
        .finally(() => inflight.delete(ref)));
    }
    return inflight.get(ref);
  };
  /** Titles for the given refs; waits at most waitMs for ones never seen before. */
  return async function titles(refs, { waitMs = 1_500 } = {}) {
    const wanted = [...new Set(refs.filter((r) => REF.test(r ?? "")))];
    const pending = wanted.filter((r) => !cache.has(r) || clock() - cache.get(r).at > ttlMs).map(load);
    if (pending.length) await Promise.race([Promise.allSettled(pending), new Promise((r) => setTimeout(r, waitMs))]);
    return Object.fromEntries(wanted.filter((r) => cache.get(r)?.title).map((r) => [r, cache.get(r).title]));
  };
}

/** Fill in the GitHub title for rows that have a ticket but no title of their own. */
export function withTitles(now, titles) {
  const add = (t) => (t.title || !titles[t.ticket] ? t : { ...t, title: titles[t.ticket] });
  return { running: now.running.map(add), recent: now.recent.map(add) };
}
