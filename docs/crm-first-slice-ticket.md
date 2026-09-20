# CRM first slice — supervised implementation

## Story
As a member of a configured business workspace, I can manage tasks on mobile
and web while offline, then synchronize without losing changes or crossing
account/workspace permissions.

## Scope
- New `bamware-crm` local repository: Expo React Native web/mobile app,
  `packages/contracts`, `packages/tasks`, Express API in `server/`.
- SQLite server persistence; native SQLite and browser IndexedDB local state.
- Workspace membership with admin/member roles. Members edit their own tasks;
  admins edit any workspace task and manage other members' active access.
- Task create/rename/complete/delete; durable per-user/workspace pending
  operations, optimistic versions, idempotency receipts, deletion tombstones,
  explicit conflict resolution by keeping the server copy.
- Existing shared JWT verifier; real auth-service client plus explicit
  loopback-only demo sessions for this local development slice.
- Configured branding/modules; responsive task board and synchronization state.
- A headless second Tasks consumer and web/native verification evidence.

## Out of scope
- Calendar, messaging, inventory, patient records, custom-field builders.
- Live auth registration/deployment, push integration, store release, paid runs.
- Changing existing apps or service response contracts.

## Acceptance criteria
- [x] `npm run typecheck`, `npm test`, `npm run build:server` pass.
- [x] `npm run build:web` produces an offline-capable web app.
- [x] Web and an iOS simulator boot the app and exercise task create/complete.
- [x] Offline operations survive app/browser restart and synchronize to a
      second client, without duplicate effects on retry.
- [x] Concurrent edits/deletion produce explicit conflicts; keeping the
      server copy cannot resurrect a deleted task.
- [x] Revoked membership rejects queued writes on reconnect; a forged
      workspace or another user's task cannot bypass role checks.
- [x] Switching identities/workspaces isolates local caches and queued work.
- [x] Server data survives restart; a second consumer imports Tasks without UI.
- [x] Theme tokens, accessible names, keyboard/touch targets and textual
      pending/error/conflict indicators are used throughout.

## Context
Bilal approved `docs/bamware-crm-architecture.md` and authorized building the
first slice on 2026-09-19. Test seams were agreed in that proposal: Tasks public
interface, HTTP authorization/sync, and web/mobile persistence/user workflows.
Supervised work; local commands above substitute for CI on the new repo.
Current shared auth registry has no CRM tenant: demo sessions are local-only,
and real shared-auth readiness must be reported separately. Work stays local
until publication is requested. No other worker owns this new directory.

## Local completion evidence
18 tests passed; typecheck and server/web builds passed. Real browser offline
cold reopen and cross-tab identity regression passed. Local iOS build succeeded
with 0 errors/warnings. Final `npm run test:ios -- <UDID>` passed native offline
create/complete, app restart with two pending changes, synchronization, and
independent browser verification of the exact completed task. Headless Tasks
consumer passed. Standards and spec review findings were fixed and rechecked.
Source lives in local `code/bamware-crm` on `feat/crm-offline-tasks`; no source
commits or remote yet. Live auth activation and Android device verification
remain outside this verified local slice.
