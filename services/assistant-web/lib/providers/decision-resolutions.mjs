// Reviewed source reconciliation, not generated decisions or issue-close inference.
// Keep retired candidates and these ID tombstones for audit/restart safety.
// A new owner ask must have a new ID, not reuse a retired one.
// Verified against GitHub source on 2026-10-07; no live AWS/config/email test claimed.
export const DECISION_RESOLUTIONS = Object.freeze({
  'auth-email-aws-access-85': {
    status: 'superseded',
    reason: 'AWS sign-in was already verified on omarchy. The old X1 sign-in request is superseded; configuration checks and email-test consent are still separate, unverified work.',
    evidence: { ref: 'https://github.com/mrbam88/bamware-ai/issues/85#issuecomment-5985083660' },
    verifiedAt: '2026-10-07T17:08:04Z',
  },
  'brewdesk-marketing-research-72': {
    status: 'superseded',
    reason: 'The research handoff was replaced by the prepared first-carousel review. Publishing that carousel still needs its own approval.',
    replacementId: 'brewdesk-first-carousel-72',
    evidence: { ref: 'https://github.com/mrbam88/bamware-ai/issues/72' },
    verifiedAt: '2026-10-07T17:08:04Z',
  },
  'auth-push-ci-permission-85': {
    status: 'resolved',
    reason: 'The permission fix was merged and the gitleaks check passed. This resolves only the CI permission ask, not the auth rollout or other blockers.',
    evidence: { ref: 'https://github.com/mrbam88/bamware-push-service/pull/2', check: 'https://github.com/mrbam88/bamware-push-service/actions/runs/37239600876/job/111545451519', commit: 'd99ed59bbe7b17209a6cb66f1347428e3fe91881' },
    verifiedAt: '2026-10-07T17:08:04Z',
  },
});
