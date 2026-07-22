# Bamware — the system map (as of 2026-07-22)

Read this before working in ANY Bamware repo. Per-repo AGENTS.md files
describe the trees; this describes the forest.

## What Bamware is

Solo-founder startup (Bilal Malik, NYC). Long-term: horizontal SaaS
platform for small businesses, mobile-first, white-label. First consumer
product: **Baat** — a Pan-South Asian dating app ("matches built on
language, faith, family"). The dating app and future SaaS share core
infrastructure (auth, messaging, notifications, payments, multi-tenancy).

## The repos (github.com/mrbam88/…)

| Repo | What | Deploy |
|---|---|---|
| `bamware-dating-app` | Baat mobile app. Expo 54 / RN 0.81, expo-router, Zustand + TanStack Query, strict TS, Jest + Maestro. White-label tenant config (`src/config/tenant.ts`) drives brand + theme. | EAS: merge→OTA preview channel; tag `v*`→TestFlight/Play (see repo's docs/RELEASING.md) |
| `bamware-dating-service` | Dating backend. Express on Lambda, DynamoDB single-table, Zod schemas, S3 presigned photo uploads, SNS push. Admin router behind ADMIN_SECRET. | GitHub Actions → Lambda `bamware-dev-dating-service` on every main push (auto!) |
| `bamware-auth-service` | Auth backend. Express on Lambda, bcryptjs + JWT, multi-tenant (`tenantId`). | Lambda `bamware-dev-auth-service` |
| `bamware-client-core` | Shared TS lib (logger, audit, auth store). **Currently orphaned** — service inlined its logger, app vendored a stub (`vendor/client-core`). Its future = dating-app issue #6 (contract-package ADR). | npm-linked locally |
| `bamware-infra` | Terraform: DynamoDB, Lambda, API GW, IAM, S3 state. | manual |
| `bamware-workspace` | Meta-repo: submodules pinning known-good SHAs across repos + ops docs (RUNBOOK, HANDOFF). NOT a dev checkout — never run dev servers from it. | n/a |
| `bamware-web` | Marketing site + web auth targets (terms/privacy, reset-password, verify-email, member sign-up, universal-links well-known files). Next.js. | Vercel (build breaks block deploy) |
| `bamware-ai` | This repo. | n/a |

## Live endpoints (dev)

- Auth: `https://cje3ppxv47.execute-api.us-east-1.amazonaws.com`
- Dating: `https://1l5fzig94l.execute-api.us-east-1.amazonaws.com`
- Region us-east-1; tenant id `bamware-dating`.

## Brand & design system (pivot 2026-07-22)

Public positioning: bamware is a **multi-agent mobile app studio** —
senior mobile craft × a fleet of AI agents; fixed-scope sprints. The old
pink brand is dead. Canonical design source: Claude Design project
**"Bamware Design System"** (claude.ai/design, Bilal's account; a skill
export zip mirrors it 1:1). One semantic token contract, two themes:

- **bamware studio** (default `:root`) — graphite surfaces + signal-lime
  `#A8E82F`, Geist + JetBrains Mono, mono `// comment` eyebrows,
  build-console card as the signature surface. No emoji.
- **Baat** (`.theme-baat`) — the case-study skin: espresso + champagne
  gold `#C9A86A`, Instrument Serif + Manrope (matches the app's
  `src/theme` / tenant config).

The project's `bamware-web` mockup shipped to production 2026-07-22
(bamware-web PR #1 → bamware.io): landing rebuilt on the token contract,
responsive, auth/legal/admin routes untouched. Still old-brand: favicon,
OG image; waitlist form parked (route intact, not rendered).

## Cross-repo contracts — THE thing agents get wrong

The mobile app hand-declares TS types for the service's API. **If you
change a service response shape, the app breaks silently and its mocked
unit tests keep passing.** (Happened Jun 9 2026: matches pagination
envelope; broken for 6 weeks.) Until issue #6 lands a shared contract
package:

- Service-side change to any response/request shape → you MUST open a
  matching PR in `bamware-dating-app` (`src/api/*.ts` + screens + tests).
- App-side, never trust the declared type — verify against the service's
  `src/schemas/*.ts` and `src/server.ts` routes on its CURRENT main.

## Definition of done (all repos)

1. `tsc --noEmit` exits 0.
2. Tests pass (`jest`). Mocked tests are not proof of integration — if
   you changed an API surface, hit the live dev endpoint or update both
   sides.
3. The app BOOTS. For mobile: build + launch in simulator; a change
   nobody ran is not done. (35 commits shipped unbooted once. Never
   again.)
4. Styling only through theme tokens (`src/theme`, tenant config). Zero
   hex literals in feature code.
5. Maestro flows updated when UI flows change (`.maestro/`, creds via
   `MAESTRO_TEST_EMAIL/PASSWORD` env).

## Security ground rules (non-negotiable)

- **No credential values in git. Ever.** Not in code, not in YAML, not
  in docs, not "for Codespace convenience." CI has a tripwire for
  credential file types; it exists because an agent once edited
  .gitignore to commit an App Store Connect key (a5ee33b — since
  removed + revoked).
- Secrets live in: EAS credentials service, GitHub Actions secrets,
  Codespaces secrets, AWS Secrets Manager, or the human's shell. Names
  are documented in each repo's `.env.example`.
- **Agents get capabilities, humans keep credentials.** Never
  authenticate to an account, generate signing keys, or handle secret
  values — prepare everything around the ceremony and hand it to Bilal.
- **Account separation:** `mrbam88` is the only account for Bamware
  (GitHub, Expo/EAS, Apple). A legacy `vpg-health` Expo session may
  exist on machines — NEVER run Bamware EAS ops under it (Bilal's rule,
  2026-07-23). Check `eas whoami` before local EAS work; CI is immune
  (uses EXPO_TOKEN secret).

## Working with Bilal

- **Chat style: short and sweet.** Bullets over prose. No fluff, no
  essays, no re-summarizing what just happened. He's an engineer —
  limit his reading.
- Direct recommendations over option menus. Plan before building.
- Mobile/Node analogies land best (RN + Express mental model).
- Specs live as GitHub issues with story/scope/out-of-scope/acceptance
  criteria (template in this repo). Vague tickets get vague PRs.
