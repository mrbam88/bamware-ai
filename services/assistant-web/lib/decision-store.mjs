// Durable, file-backed storage for Decisions responses (bamware-ai#78),
// following the service's existing local-secrets convention (a single file
// under ~/.config/bamware, default path overridable by env var — same
// pattern as ASSISTANT_WEB_ENV_FILE). Never committed; chmod 600.
//
// Read-modify-write around every response keeps this simple and correct for
// an owner-only, low-volume tool: every request reads the current file from
// disk, so a process restart or a second process always sees the latest
// state. Writes are atomic (write to a temp file, then rename).

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

export const DECISION_STORE_VERSION = "1";

/** @returns {{version: string, responses: Record<string, object>}} */
export function loadDecisionStore(filePath) {
  if (!existsSync(filePath)) return { version: DECISION_STORE_VERSION, responses: {} };
  let raw;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    throw Object.assign(new Error(`Decision store at ${filePath} is not valid JSON: ${err.message}`), { status: 500 });
  }
  if (!raw || typeof raw !== "object" || typeof raw.responses !== "object" || raw.responses === null) {
    throw Object.assign(new Error(`Decision store at ${filePath} is malformed (missing responses object).`), { status: 500 });
  }
  return { version: DECISION_STORE_VERSION, responses: raw.responses };
}

export function saveDecisionStore(filePath, store) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  writeFileSync(tmp, JSON.stringify({ version: DECISION_STORE_VERSION, responses: store.responses }, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, filePath);
}
