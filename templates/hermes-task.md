# Hermes worker brief — fill every field before dispatch

## Assignment
- GitHub ticket URL:
- Role: DEV / QA / grooming (one owner, not all three)
- Target repository and absolute working directory:
- Assigned branch/worktree:
- Execution machine and verified required capabilities:
- Allowed files/resources; other agents' reserved resources:

## Canonical context
Read current bamware-ai CONTEXT_VERSION, AGENTS.md and the relevant skill.
Canonical repository location:
Context-Version read at assignment:
Relevant skill paths (not copies of their contents):
Service-specific runbook and provider/consumer contract paths:
If current canonical context cannot be reached, stop rather than guess.

## Acceptance criteria
- Observable behavior:
- Required targeted tests:
- Final validation gates:
- Evidence/artifact paths:
- Explicit out-of-scope items:

## Authority and budget
- Authorized operations:
- Publication authority (none / exact permitted action):
- Store, spend, signing/deploy-config and cross-repo-contract gates:
- Model/subscription and approved quota/spend bound:
- Stop/report threshold:
- Current blockers and withdrawn approvals:

No paid fallback, parallel fan-out, credential movement, or permission bypass
is implied. On denial identify the actual component, give the legitimate
human next step, and park that action. Do not interpret silent command output
as failure: verify the exact target before retrying.

## Completion contract
Return verified results, exact changed paths and actual test output summary.
Separate edited locally / committed locally / published / deployed. Include
revision/PR URL when one exists, concrete next action, and remaining blockers.
Update canonical context under skills/session-handoff within the assigned
write scope. Do not publish without authority. Parent verifies artifacts and
external effects; a child saying "done" is not proof.
