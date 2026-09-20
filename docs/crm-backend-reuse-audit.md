# CRM backend reuse audit — 2026-09-19

Source inventory, not an implementation decision or runtime certification.
Scope: auth-service, auth-middleware, push-service, infra, MCP. Client, Swift,
venue and legacy RN app backend audits belong to the main audit.

Planning premise: a generic, extensible RN web/mobile business-management app;
Bamware configures it manually first. Calendar/appointments, offline tasks and
member messaging are candidate capabilities. Warehouse/dentist examples do
not select a vertical, data model or deployment model.

## Snapshot and method

Fetched `origin main` in each repo; inspected fetched `origin/main`. Local files
were used only where HEAD matched it and tracked files were clean. Infra/MCP
were inspected with `git show origin/main:<path>`. All links below pin the
audited commits; private repositories may require GitHub access.

| Repo | Audited `origin/main` SHA | Local branch / relevance |
|---|---|---|
| `bamware-auth-service` | `00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92` | `main`, HEAD matches; untracked `.next/` excluded |
| `bamware-auth-middleware` | `5d79d28040e6b1bd62fc701dc0cdff2efcb77fe0` | `main`, HEAD matches; clean |
| `bamware-push-service` | `5e5710a10423bc1d30b6df704d9591a9d9256e11` | `main`, HEAD matches; clean |
| `bamware-infra` | `bc773a0ee8affa177c4bc965a23df684803fdbc3` | `feat/ssm-vault-secrets`, HEAD `8ca71921b0cb8d5f3f5c483e8d55dc25ad273956`; differs from main; untracked `.claude/` excluded |
| `bamware-mcp` | `bcba2c371efe5967f4c991d23b4e35ddeedc3da4` | `main`, HEAD `6e20ef2255078863e7bd6efb6a6f31a387c32702`, behind two; clean |

Context repo HEAD/main: `71097b18a032ea44e28e5713c8f84d0175396328`.
Pre-existing modified `STATE.md` and untracked `bamware-push-service/` were
excluded. Read the six root `AGENTS.md` files, linked workspace instructions
and public-repo security rules. Context marker: `2026-09-19T19:57:02Z a7c7919`.

## Bottom line

| Capability | Classification | CRM implication |
|---|---|---|
| Identity and token verification | **Existing; reuse with hardening** | Register/login, social login, reset/verification, refresh/logout and deletion implementations exist. Do not rebuild identity. [A1–A5] |
| Business workspaces and permissions | **Gap** | App tenant and a single user role are not workspace membership or record authorization. [A1, A2, M1–M3] |
| Native push transport | **Existing; reuse with adaptation** | Device registry, SNS fan-out and server-key send interface exist; readiness/configuration gaps below. [P1–P7] |
| Web push | **Gap in audited code** | Registration accepts only iOS/Android; no browser subscription shape or web delivery adapter found. [P2, P6] |
| Provisioning and infrastructure | **Existing scaffolding; adapt** | Useful Terraform modules and PR-generating MCP tools; not generic CRM/workspace provisioning. [I1–I4, C1–C4] |
| Business audit trail | **Gap** | Operational logs and provisioning PR history exist; no workspace activity ledger found. [O1, I2, C2–C3] |

## Identity, tenants and roles

- **Tenant means app identity/configuration.** Auth registry entries select
  allowed sign-in providers and provider audiences. Users are looked up by
  tenant plus email, with a second globally keyed user-ID row. The same email
  in two app tenants is therefore not a shared cross-app identity. No
  business/workspace/membership entity appears in this model. [A1, A2]
- **Roles are coarse and app-user scoped.** The canonical JWT has one
  `admin`/`owner`/`staff`/`customer` role and one `tenantId`; public password and
  social registration assign `customer`. The middleware checks a fixed app
  tenant and `requireRole` checks only role inclusion. It does not establish
  ownership of an appointment, membership of a workspace, or permissions on
  another member's tasks/messages. No role-management endpoint was found in
  the audited auth handler. [A3, A4, M1–M3]
- **Reuse the verifier, add business authorization at its own seam.** Auth
  already imports the shared token schema/verifier, despite older AGENTS text
  saying adoption was pending. Dynamic multi-tenant handlers use direct
  verification rather than the package's fixed-tenant Express helper. Its
  revocation hook is optional; callers must wire it explicitly. [A4, M2, M4]
- **Lifecycle implementation:** password and verified-email social sign-in,
  provider linking, verification/reset email flows, refresh rotation,
  logout revocation and auth-record deletion. Provider audiences use tenant
  entries first, then global environment fallbacks. Refresh reloads the user
  record, including current role; defaults are 15-minute access / seven-day
  refresh tokens. Refresh family equals user ID, so reuse invalidates refresh
  across that account's sessions. [A3–A6]
- **Lifecycle hardening before reuse:** refresh checks revocation and then
  writes it separately, without a conditional consume; concurrent single-use
  enforcement is not established. The refresh verifier shares the signing
  key and accepts the claims also present on minted access tokens, without a
  token-purpose discriminator (source-level token-confusion concern). Password
  reset changes the hash without revoking sessions. Account deletion removes
  auth rows and revokes refresh, while content deletion is caller-orchestrated
  and outstanding access tokens can remain valid. These are code findings,
  not reproduced exploits or tested failure scenarios. [A3–A5, A7]

**Open design question:** app tenant versus business workspace must remain
explicit. Neither one app per business nor one shared app with many workspaces
is selected here. Membership, invitations, role changes, workspace switching
and per-resource authorization need a model before business data access is
implemented. A tenant ID supplied by a client is not proof of membership.

## Push and RN/web readiness

- **Registration:** bearer-authenticated `POST /devices` derives tenant/user
  from the token; body supplies device ID, native token, platform and optional
  preferences. Re-registering replaces that user's device row.
  `DELETE /devices/:deviceId` deletes within the caller's tenant/user key.
  Registration checks the platform-app map; deletion does not repeat that
  tenant allow-list check. Push verification has no revocation hook. [P1–P4]
- **Sending:** `POST /send` uses one timing-compared `X-Service-Key`, not member
  roles. It accepts a tenant plus either user ID or device IDs, fans out through
  SNS and reports publish success/failure counts; disabled endpoints cause
  device-row pruning. Counts are not device-delivery/read receipts. The key
  authorizes sends across configured tenants, so recipient/workspace policy
  belongs in a trusted caller. Preferences are stored but not consulted by
  send logic. No message store, scheduler, retry queue or deduplication mechanism
  appears in this send path. [P1, P5–P7]
- **RN reuse is transport-level:** native APNs/FCM tokens fit the backend
  interface. Client permission prompts, native-token acquisition, token changes,
  deep links and logout/account-switch cleanup still require integration and
  evidence. Device rows are user-scoped, but the device-ID index returns one
  match without enforcing unique ownership; re-registering under another user
  does not remove the old row. [P2–P4, P6]
- **Web:** no `web` platform/subscription keys, service-worker integration or
  browser-push adapter was found here. The HTTP API Gateway module allows
  wildcard origins and Authorization, which is only CORS configuration—not
  proof of browser integration or workspace isolation. Auth's `webOrigins`
  field has no consumer in the inspected auth source. [A1, P2, P6, I2]
- **Concrete configuration mismatch:** SNS module outputs `""` for an
  unconfigured platform; dev embeds those values in the push map, while the
  parser permits omission but rejects empty strings. Thus a missing platform
  can invalidate the entire map instead of reaching the intended per-platform
  503 path. Static cross-repo finding; not executed. [I1, I3, P7]
- **Readiness unverified:** dev has push table/Lambda/API/SNS declarations marked
  plan-only, while prod has no matching shared-push block at this SHA. The push
  repo has CI and a parked `deploy.yml.next`. No applied infrastructure,
  configured credentials, Android provider compatibility or successful device
  delivery was verified. [I1, I4, P8]

## Provisioning, extension and audit

- **Reusable infra:** parameterized Lambda, HTTP API, DynamoDB, SNS, scheduler,
  storage/CDN, alarms and budgets provide building blocks. These do not supply
  appointments, offline-task synchronization or member-conversation semantics.
  Infrastructure inventory is not evidence those product modules exist. [I1, I4]
- **MCP remains app-shaped.** Tenant schemas require branding, legal URLs,
  auth plus a legacy backend URL, and fixed feature booleans. `create_tenant`
  opens a legacy RN app config PR and board card. Only its optional iOS branch
  additionally creates auth-registry and native config PRs plus infra variable
  declarations. RN-only execution does not register the auth tenant. Web and
  Android provisioning targets are absent from this schema. [C1, C2]
- **Automation is incomplete, not needed for manual-first planning.** The
  iOS path does not add an SNS module instance or push-map entry. Its comment
  that SNS is single-app-per-environment is stale against current infra's
  per-tenant module input. `provision_dedicated` renders an infrastructure PR
  and human-only board card; its template still assembles the legacy backend
  stack, not a CRM stack. Neither tool is a business-workspace lifecycle module.
  Preserve the rendering/PR seam as a candidate for later adaptation. [C2–C4, I3]
- **Audit capability is operational.** Auth emits request/status/duration logs;
  API Gateway declares request/status/error logs with 14-day retention, and
  Lambda log retention is configurable. MCP PRs provide configuration-change
  history. No durable actor + workspace + action + resource + outcome ledger,
  activity-query interface or audit retention/export model was found in these
  repositories. Push's send result is not a stored notification history.
  Logging is reusable plumbing, not a business audit module. [O1, I2, I5, C2–C3, P5]

## Deep-module implications — recommendations, not commitments

1. **Keep identity deep:** clients should consume a small session/account
   interface; JWT claims, provider audiences, refresh serialization, revocation
   and deletion ordering should not spread through feature callers.
2. **Keep workspace authorization distinct:** put membership lookup and
   resource-policy enforcement behind one business authorization interface.
   Do not rename app `tenantId` to workspace ID and assume isolation follows.
3. **Preserve push depth:** callers should express notification intent and
   recipients, while the module owns native transports and lifecycle cleanup.
   Add web as an adapter only when required; defer a general plugin framework.
4. **Manual configuration first:** identify the smallest shared configuration
   contract before extending MCP. Reuse its render/PR implementation later;
   a template generator should not determine the CRM's domain model.

These seams retain leverage and locality without selecting hosting, workspace
topology, a sync protocol, calendar provider or messaging implementation.

## Verification limits

- Read-only source audit; only this report was authored. No pulls, resets,
  source changes, deployments, Terraform execution, tests, commits or pushes.
  No secret files, credentials, state files or production records inspected.
- Unit-test sources exist for auth rotation/revocation, middleware, push and
  MCP, but were not executed. No pass counts or runtime functionality claimed.
- Missing-capability findings are limited to these five repos and inspected
  source trees; the main audit owns reuse findings in other repos.
- Before implementation, resolve workspace/role semantics, identity hardening
  and push configuration gaps. Before any readiness claim, gather integration
  evidence for revocation, account switching, browsers and actual delivery.

## Source evidence

Labels above map to exact paths and line ranges; links contain full commit SHAs.

- **A1:** auth [`src/tenants/registry.ts:15–92`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/tenants/registry.ts#L15-L92).
- **A2:** auth [`src/repositories/userRepository.ts:25–67`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/repositories/userRepository.ts#L25-L67); [`src/schemas/authSchemas.ts:10–52`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/schemas/authSchemas.ts#L10-L52).
- **A3:** auth [`src/services/authService.ts:52–191`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/services/authService.ts#L52-L191), [`204–253`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/services/authService.ts#L204-L253), [`261–324`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/services/authService.ts#L261-L324).
- **A4:** auth [`src/handlers/authHandler.ts:51–278`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/handlers/authHandler.ts#L51-L278); schema adoption [`src/schemas/authSchemas.ts:1–6`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/schemas/authSchemas.ts#L1-L6).
- **A5:** auth [`src/services/tokenService.ts:11–64`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/services/tokenService.ts#L11-L64).
- **A6:** auth [`src/services/socialAuthService.ts:54–129`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/services/socialAuthService.ts#L54-L129).
- **A7:** auth [`src/repositories/revocationRepository.ts:53–85`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/repositories/revocationRepository.ts#L53-L85).
- **M1:** middleware [`src/schema.ts:12–34`](https://github.com/mrbam88/bamware-auth-middleware/blob/5d79d28040e6b1bd62fc701dc0cdff2efcb77fe0/src/schema.ts#L12-L34).
- **M2:** middleware [`src/middleware.ts:9–60`](https://github.com/mrbam88/bamware-auth-middleware/blob/5d79d28040e6b1bd62fc701dc0cdff2efcb77fe0/src/middleware.ts#L9-L60).
- **M3:** middleware [`src/requireRole.ts:5–21`](https://github.com/mrbam88/bamware-auth-middleware/blob/5d79d28040e6b1bd62fc701dc0cdff2efcb77fe0/src/requireRole.ts#L5-L21).
- **M4:** middleware [`src/verify.ts:5–61`](https://github.com/mrbam88/bamware-auth-middleware/blob/5d79d28040e6b1bd62fc701dc0cdff2efcb77fe0/src/verify.ts#L5-L61).
- **P1:** push [`src/handlers/pushHandler.ts:20–61`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/handlers/pushHandler.ts#L20-L61); [`src/middleware/authenticate.ts:19–38`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/middleware/authenticate.ts#L19-L38).
- **P2:** push [`src/schemas/deviceSchemas.ts:7–27`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/schemas/deviceSchemas.ts#L7-L27).
- **P3:** push [`src/services/deviceService.ts:12–50`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/services/deviceService.ts#L12-L50).
- **P4:** push [`src/repositories/deviceRepository.ts:17–99`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/repositories/deviceRepository.ts#L17-L99).
- **P5:** push [`src/services/sendService.ts:13–56`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/services/sendService.ts#L13-L56); [`src/middleware/serviceKeyAuth.ts:9–35`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/middleware/serviceKeyAuth.ts#L9-L35); [`src/schemas/sendSchemas.ts:7–19`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/schemas/sendSchemas.ts#L7-L19).
- **P6:** push [`src/repositories/notificationRepository.ts:11–51`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/repositories/notificationRepository.ts#L11-L51).
- **P7:** push [`src/tenants/platformApps.ts:9–45`](https://github.com/mrbam88/bamware-push-service/blob/5e5710a10423bc1d30b6df704d9591a9d9256e11/src/tenants/platformApps.ts#L9-L45).
- **P8:** push [`.github/workflows/` tree](https://github.com/mrbam88/bamware-push-service/tree/5e5710a10423bc1d30b6df704d9591a9d9256e11/.github/workflows) (file-presence evidence only).
- **I1:** infra [`environments/dev/main.tf:260–339`](https://github.com/mrbam88/bamware-infra/blob/bc773a0ee8affa177c4bc965a23df684803fdbc3/environments/dev/main.tf#L260-L339).
- **I2:** infra [`modules/api-gateway/main.tf:1–40`](https://github.com/mrbam88/bamware-infra/blob/bc773a0ee8affa177c4bc965a23df684803fdbc3/modules/api-gateway/main.tf#L1-L40).
- **I3:** infra [`modules/sns/main.tf:1–27`](https://github.com/mrbam88/bamware-infra/blob/bc773a0ee8affa177c4bc965a23df684803fdbc3/modules/sns/main.tf#L1-L27); [`modules/sns/outputs.tf:1–9`](https://github.com/mrbam88/bamware-infra/blob/bc773a0ee8affa177c4bc965a23df684803fdbc3/modules/sns/outputs.tf#L1-L9).
- **I4:** infra [`modules/` tree](https://github.com/mrbam88/bamware-infra/tree/bc773a0ee8affa177c4bc965a23df684803fdbc3/modules); [`environments/prod/main.tf`](https://github.com/mrbam88/bamware-infra/blob/bc773a0ee8affa177c4bc965a23df684803fdbc3/environments/prod/main.tf) (whole-file absence check for shared push).
- **I5:** infra [`modules/lambda/main.tf:1–35`](https://github.com/mrbam88/bamware-infra/blob/bc773a0ee8affa177c4bc965a23df684803fdbc3/modules/lambda/main.tf#L1-L35).
- **C1:** MCP [`src/schemas/tenant.ts:41–127`](https://github.com/mrbam88/bamware-mcp/blob/bcba2c371efe5967f4c991d23b4e35ddeedc3da4/src/schemas/tenant.ts#L41-L127).
- **C2:** MCP [`src/tools/create-tenant.ts:89–164`](https://github.com/mrbam88/bamware-mcp/blob/bcba2c371efe5967f4c991d23b4e35ddeedc3da4/src/tools/create-tenant.ts#L89-L164), [`166–226`](https://github.com/mrbam88/bamware-mcp/blob/bcba2c371efe5967f4c991d23b4e35ddeedc3da4/src/tools/create-tenant.ts#L166-L226).
- **C3:** MCP [`src/tools/provision-dedicated.ts:9–68`](https://github.com/mrbam88/bamware-mcp/blob/bcba2c371efe5967f4c991d23b4e35ddeedc3da4/src/tools/provision-dedicated.ts#L9-L68).
- **C4:** MCP [`src/templates/infra/main.tf.tmpl:56–156`](https://github.com/mrbam88/bamware-mcp/blob/bcba2c371efe5967f4c991d23b4e35ddeedc3da4/src/templates/infra/main.tf.tmpl#L56-L156).
- **O1:** auth [`src/lib/logger.ts:20–59`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/lib/logger.ts#L20-L59), [`76–95`](https://github.com/mrbam88/bamware-auth-service/blob/00b5d9d1b604e0737fcd9a890cfbe0ed4d32cb92/src/lib/logger.ts#L76-L95).
