# Bamware — the system map (as of 2026-08-14)

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
| `bamware-ios` | Reusable Swift package products: Core, UI, Messaging. Tenant-aware native foundation. | Swift Package |
| `bamware-cafe` | Native SwiftUI proving-ground app. Uses local CafeKit/VenueKit and the shared iOS package. | Local/TestFlight later |
| `bamware-venue-engine` | Express/Zod venue API with committed NYC cafe seed data. Backend partner for bamware-cafe. | Vercel (`venuekit-ashen.vercel.app`) |
| `interviews` | Job-search agent system (private): application tracker plus PII, EEO, and compensation answers. | n/a |
| `bamware-ai` | This repo. The constitution: AGENTS.md, STATE.md, shared skills. | n/a |

## Live endpoints (dev)

- Auth: `https://cje3ppxv47.execute-api.us-east-1.amazonaws.com`
- Dating: `https://1l5fzig94l.execute-api.us-east-1.amazonaws.com`
- Venue Engine: `https://venuekit-ashen.vercel.app`
- Region us-east-1; tenant id `bamware-dating`.

## Source of truth — repos, not vendor accounts

Bilal works across multiple model vendors and runtimes. Context lives in
**git**, never in a vendor's account settings, so every agent reads the
same bytes.

- `AGENTS.md` (this file) is the entry point. Read it first, in any repo.
- `STATE.md` is the current picture. Read it second.
- All skills live in `skills/` here. The private repo `interviews` holds only
  `tracker/applications.md` and `profile/private-answers.md` (PII, EEO, comp).
- **A vendor-synced copy of a skill is a CACHE, never the truth.** Claude
  account skills, for example, sync a point-in-time snapshot; they go
  stale silently and cannot be written back to from a session.
  Verified 2026-08-14: the synced `apply-to-job` snapshot (2026-07-24)
  was missing three standard answers that had been committed to
  `interviews` the same day.
- If a synced copy and the repo disagree, **the repo wins.** Re-read from
  git and carry on; do not edit the cache.
- Agents that cannot reach a repo must say so and stop, not silently
  fall back to a cache.

### Freshness — check it, and say it out loud

A stale copy does not fail loudly. It answers confidently, cites real file
paths, and is wrong. On 2026-08-14 an agent reading a stale clone quoted
compensation figures out of this public repo hours after they had been moved to
the private one, with line ranges that no longer existed. Nothing about the
answer looked different from a correct one.

So freshness is not optional and not silent:

1. **Fetch the marker first.** One line, no credentials, any runtime:
   `https://raw.githubusercontent.com/mrbam88/bamware-ai/main/CONTEXT_VERSION`
   It holds the timestamp and short sha of the newest content commit. CI's own
   `[skip version]` stamp commit sits one commit ahead by design. Compare the
   marker with the newest non-stamp commit, never `HEAD`.
2. **State it.** When answering from this context, say which version you read.
   One line is enough: `context: 2026-08-14T19:30:00Z 6e85a73`. This is what
   turns a silent wrong answer into an obvious one.
3. **If you read from a clone, re-sync before answering.** `git fetch` and
   fast-forward, or run `scripts/sync-context.sh`. If you cannot fast-forward,
   say so and stop rather than answering from what you have.
4. **Runtimes that fetch at read time cannot go stale.** Prefer fetching over
   cloning when you only need to read context. Clone when you need to write.

An agent that answers without a version is making an unverifiable claim.

## Runtime capability matrix — assign work the runtime can actually do

Agents differ by RUNTIME, not just by skill. A job handed to the wrong
runtime doesn't fail loudly — it half-completes and leaves debris.
Check this table before assigning; Bilal orchestrates against it.

| Capability | Claude Code CLI (native macOS) | Sol / opencode (native macOS) | Claude Cowork (cloud) |
|---|---|---|---|
| `git push` / release tags | ✅ owns it | ✅ | ⚠️ **API only** — commits/PRs via the GitHub connector; no git or SSH through the device bridge |
| Repo read/write via GitHub API | ✅ | ✅ | ✅ owns it — connector-based, no local checkout, no lock cruft |
| Xcode, simulators, `xcodebuild` | ✅ owns it | ✅ | ❌ no macOS |
| fastlane, App Store Connect, signing | ✅ owns it | — | ❌ |
| Credential-bearing ops (EAS, AWS, Vercel CLI) | ✅ owns it | — | ⚠️ connector-based deploys only |
| SwiftUI / client feature work | ❌ reads only | ✅ owns it | ❌ |
| Backend / API / data work | ✅ owns it | ❌ reads only | ✅ scratch + research |
| Long unattended runs, bulk research | ⚠️ rate-limit bound | ⚠️ | ✅ owns it |

**Rules that follow from the table:**

- **Never assign Cowork an Xcode job, or any git operation through the
  device bridge.** Bridge git ops fail *and* shed lock cruft
  (`.git/_bridge_cruft/`, stale `index.lock`, `HEAD.lock`) that blocks
  the next native session.
- **Cowork MAY commit through the GitHub API connector.** Verified
  2026-08-14: authenticated as `mrbam88`, read + write across all repos.
  API writes touch no local checkout, so they leave no lock cruft and
  need no cleanup afterwards. Use this for docs, trackers, state files,
  and this constitution. Tags, releases, signing, and anything requiring
  a build still belong to a native runtime.
- After any Cowork session touched a repo, the next native agent runs:
  `rm -rf .git/_bridge_cruft && rm -f .git/index.lock .git/HEAD.lock`
  then `git fsck` before pushing. (Done 2026-08-05 on this repo.)
- Cowork hands work off through **files in this repo**, never chat.
- Ownership is one-way per surface: Claude writes backend, reads Swift;
  Sol writes Swift, reads backend. Neither edits the other's tree.
- Credentials never move to satisfy a capability gap — reassign the job
  to the runtime that already holds them (see Security ground rules).

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
3. The app BOOTS. For mobile: build + launch in simulator/emulator; a
   change nobody ran is not done. (35 commits shipped unbooted once.
   Never again.) Both platforms boot as of 2026-07-22 — Android parity
   verified (sign-in/sign-up render + navigate on emulator). Android
   facts: `ios/` is committed but `android/` is gitignored (CNG — EAS
   prebuilds it from app.json; regenerate locally with
   `npx expo run:android`). Gradle needs JDK 21 (Android Studio's JBR
   works; newer system JDKs break AGP).
4. Styling only through theme tokens (`src/theme`, tenant config). Zero
   hex literals in feature code.
5. Maestro flows updated when UI flows change (`.maestro/`, creds via
   `MAESTRO_TEST_EMAIL/PASSWORD` env).
6. Native Swift packages run `swift test` with strict concurrency; native
   apps build and launch through their documented development workspace.

## Security ground rules (non-negotiable)

- **No credential values in git. Ever.** Not in code, not in YAML, not
  in docs, not "for Codespace convenience." CI has a tripwire for
  credential file types; it exists because an agent once edited
  .gitignore to commit an App Store Connect key (a5ee33b — since
  removed + revoked).
- **No PII in a public repo.** This repo is public. Home address, phone,
  EEO self-identification, and compensation figures live in the private
  `interviews` repo at `profile/private-answers.md`. Verified 2026-08-14
  after they were briefly committed here in error.
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
- Keep tool use proportional. Prefer focused reads and tests; broad audits,
  large build logs, and agent fan-out require an explicit request.
