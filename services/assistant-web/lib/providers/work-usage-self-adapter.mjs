// Real, metadata-only "self" adapter for the work-usage contract
// (bamware-ai#76): the one safe, credential-free correlation assistant-web
// can make on its own — its own repo, current git branch (parsed into a
// ticket the same way the existing collector does) and machine identity.
//
// It reports no usage/timing/outcome numbers at all. The only place that has
// real token/timing data is the existing collector (bamware-ai#60 ->
// bamware-web#45 DynamoDB), which needs AWS credentials this service does
// not have and must not acquire (same gap already documented for the #75
// rate-limit adapter in claude-max-adapter.mjs). No prompt or message
// content is read; only `git rev-parse` is run, read-only, with a timeout.
import { execFileSync } from "node:child_process";
import { resolveMachineIdentity, deriveTicketFromBranch } from "../work-usage.mjs";

export const WORK_USAGE_SELF_COVERAGE_NOTE =
  "assistant-web can identify its own repo, branch and machine locally, but has no access to token usage, " +
  "timing or outcome data for that work: the only existing collector (bamware-ai#60 -> bamware-web#45) requires " +
  "AWS DynamoDB credentials not available here. This is a coverage/correlation note, not a usage reading.";

function readGit(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 5000 }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * @param {{repoDir?: string, repoName?: string}} [ctx]
 * @returns {Promise<object[]>} always exactly one honest, numberless event
 */
export async function workUsageSelfAdapter(ctx = {}) {
  const repoDir = ctx.repoDir ?? null;
  const repo = ctx.repoName ?? null;
  const branch = repoDir ? readGit(["rev-parse", "--abbrev-ref", "HEAD"], repoDir) : null;
  const commit = repoDir ? readGit(["rev-parse", "--short", "HEAD"], repoDir) : null;
  const ticket = deriveTicketFromBranch(repo, branch);
  const machine = resolveMachineIdentity();

  return [
    {
      id: `self:${repo ?? "unknown-repo"}:${branch ?? "unknown-branch"}`,
      project: repo,
      repo,
      ticket,
      batch: null,
      task: null, // no single numeric task is attributable from a batch/multi-ticket branch; stays unallocated rather than guessed
      attempt: { id: null, kind: "unknown", number: null, retryOfAttemptId: null },
      agent: { provider: null, model: null, sessionId: null, machine },
      trace: { commit, pr: null, langfuseSessionId: null },
      usage: { input: null, output: null, cacheWrite5m: null, cacheWrite1h: null, cacheRead: null },
      timing: { activeMs: null, waitMs: null, waitReason: null, startedAt: null, endedAt: null },
      outcome: { state: "unknown", verified: false, notes: WORK_USAGE_SELF_COVERAGE_NOTE },
      classification: { difficulty: "unknown", risk: "unknown", capabilities: [], selectionReason: null },
      cost: { kind: "unknown", amountUsd: null, pricingSource: null, pricingVersion: null },
      source: { kind: "live", label: "assistant-web self (repo/branch/machine only)", fetchedAt: new Date().toISOString() },
    },
  ];
}
