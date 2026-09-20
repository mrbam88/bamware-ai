# Bamware CRM — reuse inventory and architecture proposal

2026-09-19 · Context: `2026-09-19T19:57:02Z a7c7919`

**Planning baseline:** compose CRM from existing identity/push foundations and
independently owned business modules. Prove offline tasks across web/mobile
before expanding the platform. [Current CRM context](bamware-crm.md) is the
entry point; detailed future-module choices below remain proposals.

**Subsequent decision:** Bilal approved the first workspace/offline-tasks proof
and authorized building it on 2026-09-19. This document retains the planning
baseline; [implementation results](crm-first-slice-results.md) record what was
actually built and verified, including the decisions still deferred.

## Product direction already stated by Bilal

- React Native, web and mobile; generic and highly extensible.
- Bamware configures deployments manually initially; automation can follow.
- Initial capabilities: appointments/calendar, offline tasks/checklists,
  messaging among a pool of users. Warehouse and dental-office examples
  illustrate future breadth; neither is the selected first vertical.
- Reuse across current repos and future apps; preserve the ability to defer
  decisions. No user-defined app builder has been requested for the first release.

## Method and scope

Source-level audit of 12 repos on fetched `origin/main`; no runtime, scale or
deployment certification. Read the engineering skills `codebase-design`,
`research`, `react-native-architecture`, and `domain-modeling`. One research
agent inspected five backend/ops repos; the main audit inspected seven below.
The [backend evidence report](crm-backend-reuse-audit.md) pins the other five
SHAs and owns their detailed findings.

| Repo | Audited commit | Checkout at inspection |
|---|---|---|
| `bamware-dating-app` | `fa0d1489a1a243b7cad7f90ebe3592679a468c45` | main behind 3; untracked skill files |
| `bamware-dating-service` | `4b024e0d6f75937ad453c03dac2b03dca274469f` | main behind 2; tracked script/test edits |
| `bamware-web` | `3ea7128e047c383ae97c700c1b086d96a3ab3983` | main behind 1; tracked files clean |
| `bamware-client-core` | `ae0a26180837eb1ba4dc0856fa2f2985b58570d1` | main behind 1; tracked files clean |
| `bamware-ios` | `ac444619a96e5e018b33f6c2acf7d6dac0839415` | main behind 16; substantial local edits |
| `bamware-brewdesk` | `c2ebdff122aa0afea7982f92a5d125a7db12c146` | main behind 13; tracked files clean |
| `bamware-venue-engine` | `97a1e73020184d36567b1a6b93a00b4dffc99642` | another branch; untracked files |

Used revision-aware `git show`, `git ls-tree`, and `git grep`; existing
checkouts were not pulled or rewritten. Claims below refer to these commits,
not local edits. Dormant prototypes, the Flutter client, and separate marketing
microsites were not exhaustively audited. Links to private repos require access.

## Reuse map

| Capability | Source evidence | Reuse verdict |
|---|---|---|
| Identity lifecycle + JWT verification | Auth + middleware: backend report A1–A7, M1–M4 | **Reuse existing backend**, address listed lifecycle concerns before CRM adoption. |
| RN sessions and authenticated HTTP | Legacy RN `src/api/client.ts`, `src/store/authStore.ts`, `src/lib/storage.ts` [R1–R3] | **Extract/adapt.** Coupled to app singleton config, Zustand, storage and a specific backend. |
| Native account-module design | Shared Swift accounts + BrewDesk composition [S1–S3] | **Reuse interface/test patterns.** Swift packages are not directly consumable TypeScript modules. |
| Business membership and permissions | Backend report A1–A4, M1–M3; Swift permissions [S4] | **New business model.** Existing app tenant and coarse role do not establish workspace membership. |
| Member chat | Legacy backend message module and RN chat UI [M1–M3] | **Adapt domain coupling.** Persisted pairwise chat exists; it requires a match, not workspace conversation membership. |
| Native push | Shared push backend; RN device/hook code [R4]; backend report P1–P8 | **Reuse transport + adapt client.** RN still registers against the legacy backend. Browser push is a gap. |
| Attachments | Tenant-aware presign/confirm upload flow [F1] | **Adapt.** Existing image rail has tenant/user ownership and limits; workspace-private document access is not supplied. |
| Offline data | BrewDesk saved-set client + engine storage [O1–O3] | **Reuse patterns, design task semantics.** Snapshot replacement and union merge are not a general operation-sync module. |
| Appointments and tasks | Inspected app routes, schemas and module trees; local visit reminders [C1] | **New product modules in audited scope.** Local reminders do not provide shared booking, availability or task workflows. |
| Web | Next.js auth/admin implementation [W1–W3] | **Reuse flows and lessons.** Separate server-side cookie/auth implementation; not an existing shared RN-web CRM shell. |
| Tenant configuration/provisioning | RN config [R5]; backend report C1–C4 | **Adapt validated configuration.** Current fields and generator are app-specific; no workspace provisioning module. |
| Observability/audit | Web audit shim [W3]; backend report O1 | **Reuse operational logging.** Durable business activity history needs its own implementation. |
| Shared TS client-core | Tombstone + accepted retirement ADR [X1] | **Retired.** Do not revive or depend on this archive as the CRM foundation. |

### Constraints that materially affect reuse

1. **App tenant, business workspace and person are different concepts.** Auth
   stores users per app tenant; the same email in another app is not automatically
   the same identity. A patient/contact can exist without a login. A staff user
   leaving a business should not imply deleting the business's records. These
   distinctions need explicit ownership and membership rules before schema work.
2. **RN account code needs extraction and lifecycle correction.** The HTTP
   refresh queue drops queued callbacks on failure without rejecting their
   promises. Hydration clears both tokens when access expires instead of trying
   refresh; logout clears locally without calling the newer server logout route.
   These are source observations, not reproduced runtime defects. [R1, R2]
3. **Web needs a real platform adapter.** RN storage uses browser localStorage
   versus native SecureStore; native social sign-in has no browser OAuth
   implementation in the inspected module. Next.js admin uses an HTTP-only
   cookie and its own JWT verifier. Decide browser session handling at the
   first web-auth slice; neither implementation alone proves CRM browser
   parity. [R3, R6, W1, W2]
4. **Current chat is match-shaped and polled.** The backend authorizes through
   `getMatch`, checks blocking on sends, partitions messages by tenant/match,
   and sends best-effort notifications. RN polls every five seconds. No large-scale
   capacity claim follows from this implementation. Shared Swift Messaging is
   a fetch protocol and supplied-message view, not a complete chat backend. [M1–M4]
5. **Offline saves have intentionally narrow semantics.** One pending list is
   persisted, sign-in unions local/server IDs, and writes replace the full set.
   Local saves survive sign-out. CRM needs user/workspace-scoped caches and
   pending changes; copying this behavior would mix business/account concerns.
   The engine has both JSON and Postgres implementations, but both retain set
   replacement. Task deletions, concurrent field edits and stock increments
   require different rules. [O1–O3]
6. **File reads need their own access design.** The upload implementation returns
   a stable CloudFront/S3 URL and supports image content types. An upload-owner
   check or moderation status does not establish authorization to read a private
   workspace document. Reuse upload mechanics behind a file-access interface. [F1]

The backend report additionally records refresh hardening, push account-switch
and configuration gaps, and incomplete provisioning. Those findings belong in
the relevant adoption work, not a claim that every existing foundation is ready.

## Proposed module architecture

```text
CRM app composition — configuration, module selection, navigation, branding
    │
    ├── RN/mobile presentation + platform adapters
    └── RN/web presentation + platform adapters
                  │
      Business-module interfaces
      Tasks · Scheduling · Conversations · future vertical modules
                  │
      Identity/session · Workspaces/access · Files · Notifications

Backend composition
    New CRM modules initially deployed together
    Existing auth/push remain separately consumed foundations
    Each module owns its rules and data; adapters hide transport/storage
```

### Small interfaces with real depth

- **Identity/session:** callers request a usable session or end one. The module
  owns refresh concurrency, storage, transient failure handling and cleanup.
- **Workspaces/access:** resolve membership and authorize an action on a scoped
  resource. The server obtains identity from verification and checks membership;
  a client-supplied workspace ID selects context, never grants access.
- **Tasks:** expose task queries and intent-level commands, with visible
  pending/conflict outcomes. Keep validation, version checks and reconciliation
  behind the interface; screens should not construct retry queues.
- **Conversations:** own participants, history and send semantics. A match can
  authorize a conversation in the legacy domain; CRM supplies its own membership
  policy. Do not make CRM create pretend matches to reuse chat.
- **Scheduling:** own appointment/resource rules and time-zone semantics.
  Provider integrations and reminder delivery are separate adapters when needed.
- **Files/notifications:** callers express an authorized file action or a
  recipient/message intent. Storage URLs and SNS details stay in implementations.

Module ownership is a logical separation, not one repo, database or deployment
per module. Feature callers must not query another module's tables. Validate
published input/output shapes at the interface; select a contract distribution
mechanism when the first real consumer is built. Existing cross-repo contracts
retain their coordinated-change rules ([contracts](contracts.md)); retirement
of client-core is not silently reversed.

Start with direct composition of the modules actually used. Extract a shared
sync mechanism only after two module policies demonstrate what is common.
Avoid a universal record engine, mandatory event bus, runtime plugin loader or
provider abstraction without a concrete varying requirement. Calendar, Tasks
and Conversations should not inherit each other's business rules.

### Manual configuration now, automation later

Proposed: versioned, validated configuration for branding, enabled modules and
module settings, separate from credentials and workspace business records.
Initially authored by Bamware. A later admin UI or MCP tool calls the same
validation/application interface. Invalid configuration must fail explicitly;
disabling a module requires defined data-access/retention behavior.

Feature visibility and permission checks are distinct. A hidden screen does
not disable its server operation. Workspace membership is mutable business
data, not a permanently compiled feature flag.

## Decisions to make when they become necessary

| Timing | Decision | Why then |
|---|---|---|
| Before first business schema | App/workspace/user/contact relationships; record ownership; membership and access rules | Data identity and authorization are expensive to retrofit. |
| Before offline-task slice | Local/server durability, operation IDs, versions, deletion handling, conflict policy, user/workspace isolation | A reconnect must not lose changes or replay them under a different user. |
| During the first web/mobile slice | Browser session adapter, local stores, API contract ownership, initial package layout | These determine whether the same task behavior actually works on both platforms. |
| During initial persistence spike | Concrete database and transaction requirements | Interfaces help migration; they do not make database changes free. |
| Before appointment implementation | Internal booking versus external calendar sync; resources, recurrence, time zones | These change the scheduling model; a calendar UI alone does not decide them. |
| Before messaging implementation | Pool membership, who can initiate, one-to-one versus groups, delivery expectations and expected load | Needed to generalize match chat and choose a transport honestly. |
| Later, with evidence | Self-service configuration, custom field/workflow builder, separate deployments, realtime transport, provider replacements | Preserve module interfaces now; pay for this machinery when required. |

Recommended starting topology: new CRM modules in one backend deployment, using
existing platform foundations. Shared-host versus dedicated-business deployment
and monorepo versus multi-repo remain proposals to resolve during setup; logical
module ownership should survive either choice. CRM's first user/workflow is open.

## First architecture proof — proposed next work

**One manually configured workspace, two member roles, offline tasks on web and
mobile.** Tasks are the smallest requested feature that exercises the difficult
platform seams without choosing a warehouse or dental vertical.

Prove through the same interfaces apps consume:

1. Existing auth establishes a session; membership grants access only to the
   intended workspace. A contact record does not need a login.
2. A member creates/completes a task offline, closes the app/browser, reopens,
   reconnects, and sees the same accepted result on the second device.
3. Retried operations do not duplicate work. Concurrent changes and deletion
   follow an explicit policy rather than resurrecting records through union merge.
4. Revoking permission while a device is offline prevents its queued write
   from committing later. Account/workspace switching does not replay another
   identity's queue or expose its cached records.
5. A tiny second consumer can use the Tasks interface without importing CRM
   screens, calendar, messaging or vertical-specific models.

This is a proposed slice, not an issued ticket or implementation authorization.
Use `agent-ready-tickets` and `definition-of-ready` once the first workflow and
acceptance criteria are agreed. Interface behavior, contract integration and
web/mobile offline tests provide evidence; tests mirroring wrapper methods do not.

## Verification and source references

This work ran source inspection and context-document checks only. No product
tests, builds, migrations, deployments or paid runs were executed. Existing
test sources were inspected for location/coverage hints; no pass counts are
claimed. Backend runtime state is unverified by this audit; the separately
recorded deployment milestones in STATE.md remain historical evidence.

- **R1:** [RN HTTP/refresh implementation](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/src/api/client.ts).
- **R2:** [RN account store](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/src/store/authStore.ts).
- **R3:** [RN/web storage](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/src/lib/storage.ts).
- **R4:** [RN device routes](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/src/api/devices.ts), [push lifecycle hook](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/src/hooks/usePushNotifications.ts).
- **R5:** [RN tenant/config interface](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/src/config/types.ts).
- **R6:** [Native social-sign-in implementation](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/src/lib/socialAuth.ts), [RN/web dependency manifest](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/package.json).
- **S1:** [Swift account interfaces](https://github.com/mrbam88/bamware-ios/blob/ac444619a96e5e018b33f6c2acf7d6dac0839415/Sources/BamwareAccounts/AuthContract.swift), [package products](https://github.com/mrbam88/bamware-ios/blob/ac444619a96e5e018b33f6c2acf7d6dac0839415/Package.swift).
- **S2:** [Swift refresh module](https://github.com/mrbam88/bamware-ios/blob/ac444619a96e5e018b33f6c2acf7d6dac0839415/Sources/BamwareAccounts/SessionRefresher.swift).
- **S3:** [BrewDesk account composition](https://github.com/mrbam88/bamware-brewdesk/blob/c2ebdff122aa0afea7982f92a5d125a7db12c146/Packages/BrewDeskKit/Sources/BrewDeskKit/AccountComposition.swift).
- **S4:** [Swift client-side permissions](https://github.com/mrbam88/bamware-ios/blob/ac444619a96e5e018b33f6c2acf7d6dac0839415/Sources/BamwareCore/Auth/Services/DefaultUserPermissionsService.swift).
- **M1:** [Message business rules](https://github.com/mrbam88/bamware-dating-service/blob/4b024e0d6f75937ad453c03dac2b03dca274469f/src/services/messageService.ts), [storage implementation](https://github.com/mrbam88/bamware-dating-service/blob/4b024e0d6f75937ad453c03dac2b03dca274469f/src/repositories/messageRepository.ts).
- **M2:** [Message schema](https://github.com/mrbam88/bamware-dating-service/blob/4b024e0d6f75937ad453c03dac2b03dca274469f/src/schemas/messageSchemas.ts), [mounted message routes](https://github.com/mrbam88/bamware-dating-service/blob/4b024e0d6f75937ad453c03dac2b03dca274469f/src/handlers/profileHandler.ts#L186-L207).
- **M3:** [RN chat polling](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/app/%28app%29/matches.tsx#L197-L220), [client contract](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/src/api/matches.ts).
- **M4:** [Swift message interface](https://github.com/mrbam88/bamware-ios/blob/ac444619a96e5e018b33f6c2acf7d6dac0839415/Sources/BamwareMessaging/Repositories/MessageRepository.swift), [message view](https://github.com/mrbam88/bamware-ios/blob/ac444619a96e5e018b33f6c2acf7d6dac0839415/Sources/BamwareMessaging/Views/MessageListView.swift).
- **F1:** [Upload implementation](https://github.com/mrbam88/bamware-dating-service/blob/4b024e0d6f75937ad453c03dac2b03dca274469f/src/services/uploadService.ts), [upload configuration](https://github.com/mrbam88/bamware-dating-service/blob/4b024e0d6f75937ad453c03dac2b03dca274469f/src/config/tenantUploads.ts), [authorization at upload routes](https://github.com/mrbam88/bamware-dating-service/blob/4b024e0d6f75937ad453c03dac2b03dca274469f/src/handlers/uploadHandler.ts).
- **O1:** [Saved-list sync and queue](https://github.com/mrbam88/bamware-brewdesk/blob/c2ebdff122aa0afea7982f92a5d125a7db12c146/Packages/BrewDeskKit/Sources/BrewDeskKit/ServerSavedVenuePersistence.swift).
- **O2:** [JSON saved-list storage](https://github.com/mrbam88/bamware-venue-engine/blob/97a1e73020184d36567b1a6b93a00b4dffc99642/src/saved-spots-sync.ts).
- **O3:** [Postgres saved-list storage](https://github.com/mrbam88/bamware-venue-engine/blob/97a1e73020184d36567b1a6b93a00b4dffc99642/src/db/saved-spots.ts), [storage composition](https://github.com/mrbam88/bamware-venue-engine/blob/97a1e73020184d36567b1a6b93a00b4dffc99642/src/db/runtime.ts).
- **C1:** [Local visit-reminder interface/implementation](https://github.com/mrbam88/bamware-brewdesk/blob/c2ebdff122aa0afea7982f92a5d125a7db12c146/Packages/BrewDeskKit/Sources/BrewDeskKit/VisitReminderScheduling.swift#L23-L125).
- **W1:** [Web verifier](https://github.com/mrbam88/bamware-web/blob/3ea7128e047c383ae97c700c1b086d96a3ab3983/lib/auth.ts).
- **W2:** [Web admin session](https://github.com/mrbam88/bamware-web/blob/3ea7128e047c383ae97c700c1b086d96a3ab3983/app/api/admin/login/route.ts), [web dependencies](https://github.com/mrbam88/bamware-web/blob/3ea7128e047c383ae97c700c1b086d96a3ab3983/package.json).
- **W3:** [Web audit shim](https://github.com/mrbam88/bamware-web/blob/3ea7128e047c383ae97c700c1b086d96a3ab3983/lib/audit.ts), [web request/session helpers](https://github.com/mrbam88/bamware-web/blob/3ea7128e047c383ae97c700c1b086d96a3ab3983/lib/api.ts).
- **X1:** [Client-core tombstone](https://github.com/mrbam88/bamware-client-core/blob/ae0a26180837eb1ba4dc0856fa2f2985b58570d1/TOMBSTONE.md), [accepted retirement ADR](https://github.com/mrbam88/bamware-dating-app/blob/fa0d1489a1a243b7cad7f90ebe3592679a468c45/docs/adr/0001-retire-client-core.md).
