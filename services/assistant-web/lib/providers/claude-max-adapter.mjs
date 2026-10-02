// Real-provider adapter for Bilal's Claude Max subscription.
//
// Investigated 2026-10-02 (overnight batch, task #75), read-only, no account
// authorization or token reads:
//   - `claude --help` exposes no usage/quota/limit subcommand or flag.
//   - Anthropic's usage API covers API-billed orgs, not Max subscriptions
//     (docs/ai-usage.md, confirmed again here).
//   - The existing collector (bamware-ai PR#60 `scripts/ai-usage-collect.py`
//     -> DynamoDB -> bamware-web `/admin/ai-usage`, bamware-web PR#45) is the
//     only place with a real reconstructed 5-hour-window number, and it needs
//     AWS DynamoDB credentials this service does not have and must not
//     acquire (no new credentials per batch rules).
//   - `hermes --help` was denied by the local permission layer before this
//     could be checked the same way; reported as a gap, not retried.
//
// Conclusion: no authoritative read-only source is reachable from this
// service today. Report "unsupported", not a guessed number — this directly
// replaces the old unverified 1.5M-token default cap.
import { unsupportedWindow } from "../rate-limits.mjs";

export const CLAUDE_MAX_UNSUPPORTED_REASON =
  "No authoritative read-only quota source is wired for Claude Max from assistant-web. " +
  "`claude --help` has no usage/quota command; Anthropic's usage API covers API-billed orgs, not Max; " +
  "the existing collector (bamware-ai#60, bamware-web#45) requires AWS DynamoDB credentials not available here.";

/**
 * @returns {Promise<object[]>} always a single honest "unsupported" window.
 */
export async function claudeMaxAdapter() {
  return [
    unsupportedWindow({
      provider: "claude-max",
      account: "bilal",
      scope: "5h-window",
      reason: CLAUDE_MAX_UNSUPPORTED_REASON,
    }),
  ];
}
