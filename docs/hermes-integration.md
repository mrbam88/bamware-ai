# Hermes integration — Bamware remains canonical

## Decision and boundary

Bilal requested full integration on 2026-09-24, not a replacement for Bamware.
Hermes supplies the local execution surface, skill discovery and context
bootstrap. Git owns durable context; GitHub issues/Projects own work. Do not
create a second task board, duplicate skill copies, or overlapping schedules.

This installation targets the **active default profile on the ThinkPad**.
Other machines/profiles are not implicitly configured. The remote Linux server
requires Tailscale SSH re-authentication; Mac execution has not been verified.

## Installed pieces

- Desktop project **Bamware**: primary `bamware-ai`, plus the existing sibling
  Bamware Git checkouts. Selecting a folder does not assign it to an agent or
  authorize a release. Career/private repos remain on-demand, not auto-read.
- `skills.external_dirs` points directly at this repo's `skills/`. All **25
  first-party skills** were resolved through the real Hermes loader to their
  canonical source files. No copies or symlinks were added to Hermes' skill tree.
- `scripts/hermes-context.py`: approved shell hook for `pre_llm_call`.
- `scripts/install-hermes.py`: repeatable installer, preview by default.
- `tests/test_hermes_bridge.py`: offline behavior tests with real temporary Git
  repos. `tests/verify_hermes_live.py`: real installed-runtime wiring check.
- Hermes memory holds a repo/runbook pointer only. Project facts and learned
  procedures stay here. Session search is supplementary evidence, not truth.

## Startup behavior

The hook is scoped to this profile. It bootstraps desktop sessions even when
Hermes' server process cwd is not the selected workspace; shell-hook payloads
carry the server cwd, not a reliable per-chat project path. For CLI/gateway
sessions it activates inside sibling Bamware/interviews directories or on an
explicit Bamware/Bilal/mrbam88 mention. It does not read the private repo.

It performs a bounded `git fetch origin main`, pins the fetched SHA, and reads
CONTEXT_VERSION, AGENTS.md, the skill index, and a **labelled 5,000-character
STATE excerpt** from that immutable revision. Read the rest on demand. It
reports HEAD divergence and unpublished working edits without merging,
resetting, stashing or pushing. It never executes a fetched file.

- `[BAMWARE_CONTEXT_CHECK]`: successful fetch, **not** proof of GitHub push
  permission or deployment access. Version contents are preserved verbatim.
- `CHECKOUT_DIFFERS`: stop before trusting local skills/docs; reconcile safely
  or read the needed files from the fetched revision. Never auto-reset WIP.
- `LOCAL_EDITS_UNPUBLISHED`: local work is not a cross-machine handoff.
- `[BAMWARE_CONTEXT_BLOCKED]`: do not answer Bamware questions from a cache;
  report the missing access. Git stderr is not echoed (remote URLs may contain
  secrets). The model is instructed to stop; this is **not a security sandbox**.

Once a successful marker is in history, the hook does not reload on every
turn. Fresh sessions, or history after compaction without the marker, verify
again. Context joins the current user turn through Hermes' supported hook;
the system prompt and prior messages are not rewritten. Long-running work
still needs a fresh fetch before publication; startup is not continuous sync.

### Reload boundary

Settings and hook registration apply to new Hermes runtime/session builds.
The current conversation's prompt/toolset is not replaced. If a new desktop
chat does not pick up the hook, restart the desktop app normally after saving
work. Do not terminate a running gateway or wipe sessions to force a reload.

## Install on another authorized machine

Prerequisites: current checkout, installed/authenticated Hermes, native Git,
Python with PyYAML (Hermes' own Python includes it). No new provider login,
credential movement, OS configuration, or paid service is part of installation.
Run via the terminal tool from this repo:

```sh
python3 scripts/install-hermes.py          # inspect changes and target profile
python3 scripts/install-hermes.py --apply  # opt in after reviewing
hermes hooks list
```

The installer uses `hermes config set`, preserves existing external directories
and other hook commands, and leaves the original two-setting baseline at
`$HERMES_HOME/backups/bamware-integration-before.json` (default home:
`~/.hermes`). It does not grant hook consent. Approve the exact displayed hook
through Hermes' prompt or its documented exact-command allowlist. Bilal
explicitly approved the local hook in the integration session. Never enable
`hooks_auto_accept` or disable ordinary tool approvals to solve this.

Create/select the desktop project through Hermes' project UI/tool, anchored
at this repo. Add the desired existing siblings with `hermes project
add-folder`; do not clone every repo or auto-include private career data.
Use the active profile only. Do not copy provider auth to a second machine.

## Work execution contract

| Stage | Canonical procedure | Hermes execution |
|---|---|---|
| Groom | `skills/agent-ready-tickets`, `skills/definition-of-ready` | Native gh; explicit scope, acceptance criteria, worker/capability, budget |
| DEV | `skills/standing-engineer` | One ticket, one writer, bounded session; independent worktree for parallel edits |
| Parallel work | `skills/agent-fanout` | Only after an explicit fan-out request and budget; child receives full brief, paths, constraints and required evidence |
| QA | `skills/qa-engineer` | Verify acceptance criteria and actual results; do not trust a child's success summary without evidence |
| Merge/release | AGENTS.md plus service runbook | QA merge only under existing gates; store/spend/config/contracts remain Bilal-gated |
| Handoff | `skills/session-handoff` | Update canonical files; validate; publish only under applicable authorization; distinguish local/published/deployed |

Use `templates/hermes-task.md` for a self-contained worker brief. Hermes
subagents do **not** inherit the entire conversation and are not durable
workers. Their process-local lifetime is not suitable for a night queue.
Keep overnight ownership in the existing night-supervisor procedure until a
specific scheduled migration is approved and exercised. A timer being installed
is not evidence that an unattended agent can create, merge or publish a PR.

On the first actual permission denial, identify the denying layer (Hermes,
Tailscale, GitHub, OS, provider, etc.), give the legitimate human next step and
park that action. Continue independent authorized work. Claude-specific
classifier diagnoses in old docs are not universal. No alternate route to
bypass a denial, permission-mode weakening, or credential relocation.

## Machines and integrations

Read `docs/machines.md`, `docs/runtimes.md` and the service runbook each time.

- **ThinkPad:** local native git/gh verified; GitHub reports push/admin access to
  bamware-ai. Actual push/merge/release operations were not tested here.
- **Linux server:** Tailscale advertises it online, but the attempted SSH
  capability check stopped at additional Tailscale authentication. No retries
  or remote writes. Do not treat tailnet presence as execution readiness.
- **M3 Mac:** advertised online in the tailnet, no remote execution/signing/UI
  test performed. Apple work remains Mac-only and one simulator worker at a
  time. Resolve its documented remote-access prerequisites before assignment.
- **GitHub:** native gh suffices; no duplicate MCP server installed. Existing
  provider auth remains untouched. Private repo access is checked only when a
  task actually needs it; no career data was bulk-imported.
- **Discord:** preserve the existing webhook-based post/digest scripts. Do not
  copy the webhook into Hermes or add a bot just to duplicate posting.
- **Models/cost:** current model/provider unchanged; do not hard-code a
  vendor/model as a role owner. No additional model calls were made for tests.
  Bilal chose no-model verification when offered a subscription-quota smoke.

## Automation ownership — no duplicate runs

Audit on 2026-09-24 found both user timers **enabled and active on the
ThinkPad**, not merely proposed. Hermes cron had **zero jobs**. Existing
morning/evening digests and deadline sent-state remain owned by systemd and
the existing scripts. This integration did not fire them, change their model,
post a test message, or create a replacement schedule.

Before moving any routine to Hermes:

1. Read `docs/discord.md`, the script, timer/service unit and actual state.
2. Confirm execution machine, access, model budget, schedule/timezone and
   delivery destination. Cron has fresh context: set workdir and bootstrap
   skill explicitly, plus a full task brief. No implicit chat history.
3. Test read-only/no-delivery first. For these digests, `--dry-run` still calls
   Claude; it is **not** a no-model check. Review the script before testing.
4. Preserve/migrate deadline deduplication state without reading or moving
   secret values. Choose one owner; disable the old timer only at an approved
   cutover, then verify the new schedule/delivery. Never run both.
5. Keep unattended approvals deny-by-default. Test necessary permitted actions
   honestly; never create real PRs/releases as an alleged harmless dry run.

An integration does not authorize a standing goal, overnight batch, paid
fallback, new notification subscription, or maintenance loop.

## Verification and known limits

Via the terminal tool, from this repo (use Hermes' Python if system Python
cannot import PyYAML/runtime modules):

```sh
python3 -m unittest discover -s tests -p test_hermes_bridge.py -v
python3 tests/verify_hermes_live.py
python3 scripts/check-context.py
hermes hooks doctor
hermes project show bamware
```

The live check runs in a fresh Python process, loads real context and skills,
registers the approved hook through Hermes, fetches GitHub, and dispatches the
hook and a repeated turn. It asserts every first-party skill resolves to this
repo, not a shadow copy. **No fake model responses, zero provider calls.**
This proves runtime wiring; it does not prove an LLM will obey every instruction,
a newly opened desktop chat's behavior, or a successful ticket/release cycle.
An actual model-driven continuity test was declined, not silently substituted.

Known upkeep: profile-local same-named skills can shadow external ones; re-run
the live check after skill changes. Canonical skills edited through Hermes
still need Bamware validation/publication. No copying into Hermes' skill store.
The baseline context validator had a false skill-reference hit on the literal
UI name "oneclick-ui"; quotation was corrected without changing that guidance.

## Rollback

Read `$HERMES_HOME/backups/bamware-integration-before.json`; restore **only**
its recorded keys with `hermes config set` after checking for changes made
since installation. Remove the exact hook consent via `hermes hooks revoke`
with the displayed command string. Do not overwrite the entire config or
remove unrelated hooks/skills. Archive the Bamware project only if unwanted.
New sessions take the restored settings. Nothing in the repo, provider auth,
Discord credentials or existing timers needs to be deleted.

## GitHub sync / next action

Bilal authorized publishing this session's integration source and context to
GitHub. This change packages the installer, hook, tests, runbook and preferences
for that handoff. Publication must be verified by reading back the remote
commit; local installation alone is not proof of synchronization.

On another device, fetch/pull current main without overwriting local work,
then ask its agent to read this runbook and inspect the existing setup before
applying the installer. Pulling the repo makes the source available; it does
not automatically configure Hermes, grant hook consent or transfer credentials.
Bilal reports Hermes is already installed on the Mac; its integration is not
verified from this machine.

Keep scope narrow: the broader VM/cloud/fleet discussion was background, not
an implementation request. No new remote rollout or model installation is
part of this publication. Follow `skills/session-handoff` and preserve the
original Context-Version provenance.
