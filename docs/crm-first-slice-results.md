# Bamware CRM — first slice results

2026-09-19 local session (verification continued into 2026-09-20 UTC).
Implementation context: `2026-09-19T20:30:41Z 4bf9841`.

## Delivery

- Bilal approved the architecture proof and said to start building it.
- Local repo: sibling `code/bamware-crm`, branch `feat/crm-offline-tasks`.
- Ticket: https://github.com/mrbam88/bamware-ai/issues/31.
- No source commits, remote repo, pushes or PRs were requested/performed.
- No paid builds, services or deployments were used.

## Implemented

- Expo React Native web/mobile app; configurable theme/module visibility.
- Business workspaces distinct from auth tenants; admin/member membership.
- Members create/change their own tasks; admins change all workspace tasks
  and pause/restore other members' access.
- Independent `@bamware/crm-tasks` and runtime-validated contracts packages.
- Create, rename, complete, delete; local-first durable pending operations.
- SQLite on the API/native client; IndexedDB on web; offline web shell cache.
- Stable operation IDs, atomic task/receipt persistence, optimistic versions,
  deletion tombstones, explicit conflict resolution.
- Current server membership checked before replay. Revocation invalidates local
  state even when the observing tab has a stale snapshot.
- Browser HTTP-only session cookies plus expected-identity checks prevent a
  stale tab replaying its queue under another tab's signed-in identity.
- Native SecureStore sessions; shared `@bamware/auth-middleware` v0.1.2 verifier.
- Local-only demo identities; adapters for existing auth login/refresh/logout.
- Headless Node consumer using the same Tasks module without app/UI imports.

## Verification evidence

Commands are reproducible from the CRM README. Generated logs/screenshots are
ignored locally under `evidence/` and `.data/`; they are not public repo assets.

| Gate | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test` | 18 passed in 4 files |
| `npm run build:server` | Runnable Node bundle produced |
| `npm run build:web` | Expo web export + versioned offline-shell precache produced |
| `npm run test:web` | Passed via its equivalent Python script invocation; real offline browser cold reopen, second client, conflicts/deletion, permission revocation, account/workspace isolation, narrow layout, shared-cookie cross-tab regression |
| Local iOS build | `npx expo run:ios --device <UDID> --port 8093`: Build Succeeded; 0 errors, 0 warnings |
| `npm run test:ios -- <UDID>` | Final combined gate passed: native create/complete offline, two pending changes survive app termination/relaunch, sync drains queue, independent browser sees the exact completed task |
| `npm run example:tasks` | Passed; independent consumer created a task and returned zero pending operations |

Final cross-device proof task: `iOS offline task 1789873832955` (synthetic test
data). Screenshot exhibits: `ios-created.png`, `ios-after-complete.png`,
`ios-after-restart.png`, `ios-synced.png`, `web-native-shared.png`.
Native test used the dedicated **CRM Local** iPhone simulator on iOS 26.4.

### Standards review

Two hard-standard findings (cross-tab account replay, stale-writer revocation
cleanup) and one correctness finding (malformed refresh-cookie rejection)
were fixed. Regression tests passed; reviewer recheck: no unresolved original
findings or concrete regressions identified within the fixes.

### Spec review

Three findings (cross-tab replay, conflict tombstone loss, artificial version
conflicts after interrupted retries) were fixed. Tests failed before the fixes
and passed afterward; reviewer recheck: all original findings resolved.

### Native verification lessons

- The generated/prebuilt native app can still default to Metro 8081 even when
  Expo CLI is using another port. Another project's server on 8081 produced
  a misleading `MessageQueue` runtime error. The portable `scripts/ios.mjs`
  sets `RCT_jsLocation` for this app/simulator to CRM's 8093.
- Expo CLI forbids `--port` together with `--no-bundler`; `--port 8093` reuses
  the existing matching Metro instance.
- Maestro/XCTest had stale accessibility handles across app restarts. The
  final gate controls lifecycle with `simctl` outside each Maestro session.
- Center scroll targets and verify text entry before adding a task; native
  checkbox taps use retry-on-no-change. A simulator shutdown also interrupted
  one attempt. Final combined gate subsequently passed.

## Current use and next boundaries

- Local preview: `http://127.0.0.1:4310`, Metro 8093; identities are explicitly
  marked demo. `npm run local:start` / `npm run local:stop` own the local processes.
- Live auth needs CRM registration, real workspace member IDs and the existing
  identity-hardening follow-ups before deployment. No live credential flow was
  certified. Existing services and response contracts were not modified.
- Android entry point is present but native Android build/device verification
  remains unperformed. No App Store/TestFlight release was prepared.
- Snapshot sync is full-workspace, not a scale guarantee. Calendar, messaging,
  push integration, custom records and automated tenant provisioning remain future
  modules; this slice establishes their reusable starting point.
- Bilal has now tried the web preview: very positive first impression,
  "very impressed" and "wow". No specific iteration-two changes requested yet.
- Next checkpoints: source publication and concrete feedback to select the next
  workflow. [CRM entry point](bamware-crm.md) owns the current product direction.
