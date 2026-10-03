// Board section for the Agents tab: GitHub Projects board 2 is the execution
// record, read through the server's authenticated gh CLI and cached so a page
// load never waits on GitHub. No issue titles are copied into source.
import { execFile } from "node:child_process";

const TTL_MS = 5 * 60_000;
const IN_PROGRESS = "In Progress";

function ghItems({ owner, project, timeoutMs = 20_000 }) {
  return new Promise((resolve, reject) => {
    execFile("gh", ["project", "item-list", project, "--owner", owner, "--format", "json", "--limit", "500"],
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(new Error(err.killed ? "gh timed out" : "gh project read failed"));
        try {
          resolve(JSON.parse(stdout).items ?? []);
        } catch {
          reject(new Error("gh returned unreadable JSON"));
        }
      });
  });
}

export function summarizeBoard(items, fetchedAt) {
  const counts = {};
  const inProgress = [];
  for (const item of items) {
    const status = item.status ?? "No status";
    counts[status] = (counts[status] ?? 0) + 1;
    if (status === IN_PROGRESS) {
      const c = item.content ?? {};
      inProgress.push({ title: item.title ?? c.title ?? "Untitled", url: c.url ?? null,
        repo: c.repository ? String(c.repository).split("/").pop() : null, number: c.number ?? null,
        priority: item.priority ?? null });
    }
  }
  inProgress.sort((a, b) => String(a.priority ?? "P9").localeCompare(String(b.priority ?? "P9")));
  return { fetchedAt, total: items.length, counts, inProgress };
}

/** Cached reader: returns the last good summary (with its age) and refreshes in the background. */
export function createBoardReader({ owner, project, fetchItems = () => ghItems({ owner, project }), ttlMs = TTL_MS, clock = Date.now } = {}) {
  const url = owner && project ? `https://github.com/users/${owner}/projects/${project}` : null;
  let last = null;
  let error = null;
  let inflight = null;
  const refresh = () => {
    inflight ??= fetchItems()
      .then((items) => { last = summarizeBoard(items, clock()); error = null; })
      .catch((err) => { error = err.message; })
      .finally(() => { inflight = null; });
    return inflight;
  };
  return async function read({ waitMs = 1_500 } = {}) {
    if (!last || clock() - last.fetchedAt > ttlMs) {
      const pending = refresh();
      if (!last) await Promise.race([pending, new Promise((r) => setTimeout(r, waitMs))]);
    }
    return last ? { ...last, url, error } : { fetchedAt: null, total: null, counts: {}, inProgress: [], url, error: error ?? "Board not loaded yet." };
  };
}
