# Bamware — the system map (as of 2026-08-14)

Read this before working in ANY Bamware repo. This is the map, kept deliberately
small because every agent loads it every session. Detail lives in `docs/`;
follow a link only when the task needs it.

## What Bamware is

Solo-founder startup (Bilal Malik, NYC). Long-term: horizontal, mobile-first,
white-label SaaS for small businesses. First consumer product: **Baat**, a
Pan-South Asian dating app. Dating app and future SaaS share core infrastructure.

## The repos (github.com/mrbam88/…)

| Repo | What |
|---|---|
| `bamware-dating-app` | Baat mobile app. Expo/RN, expo-router, strict TS. |
| `bamware-dating-service` | Dating backend. Express on Lambda, DynamoDB. |
| `bamware-auth-service` | Auth backend. Express on Lambda, JWT, multi-tenant. |
| `bamware-client-core` | Shared TS lib. **Orphaned** — see dating-app issue #6. |
| `bamware-infra` | Terraform: DynamoDB, Lambda, API GW, IAM, S3 state. |
| `bamware-workspace` | Meta-repo of submodule pins. NOT a dev checkout. |
| `bamware-web` | Marketing site + web auth targets. Next.js, Vercel. |
| `bamware-ios` | Reusable Swift packages: Core, UI, Messaging. |
| `bamware-cafe` | Native SwiftUI proving ground (BrewDesk). |
| `bamware-venue-engine` | Express/Zod venue API. Vercel. |
| `interviews` | **Private.** Application tracker + PII/EEO/comp answers. |
| `bamware-ai` | This repo. AGENTS.md, STATE.md, skills. |

Deploy targets, live endpoints, and per-repo detail: `docs/repos.md`.

## Source of truth — repos, not vendor accounts

Bilal works across multiple model vendors and runtimes. Context lives in **git**,
never in a vendor's account settings, so every agent reads the same bytes.

- `AGENTS.md` is the entry point. `STATE.md` is the current picture.
- All skills live in `skills/`; `skills/INDEX.md` routes. The private
  `interviews` repo holds only the tracker and `profile/private-answers.md`.
- **A vendor-synced copy is a CACHE, never the truth.** It goes stale silently
  and cannot be written back to from a session.
- If a cache and the repo disagree, **the repo wins.** Do not edit the cache.
- If you cannot reach a repo, say so and **stop**. Never fall back to a cache.

### Freshness — check it, and say it out loud

A stale copy does not fail loudly. It answers confidently, cites real paths, and
is wrong. Two such incidents are recorded in `docs/incidents.md`; read it once if
you are tempted to skip this section.

1. **Fetch the marker first**, no credentials required:
   `https://raw.githubusercontent.com/mrbam88/bamware-ai/main/CONTEXT_VERSION`
   It holds the timestamp and short sha of the newest **content** commit. CI's
   own stamp commit sits one ahead of it by design, so a checker compares the
   marker with the newest non-stamp commit, never `HEAD`.
2. **State it when you answer.** One line: `context: <marker contents>`. This is
   what turns a silent wrong answer into an obvious one.
3. **Reading from a clone? Re-sync first** — `scripts/sync-context.sh`. If you
   cannot fast-forward, say so and stop.
4. **Fetching at read time cannot go stale.** Prefer fetching over cloning when
   you only need to read. Clone when you need to write.

An agent that answers without a version is making an unverifiable claim.

### Writing back

- One writer per resource. Never append to a file another agent also appends to.
- New facts go to the repo, not to chat. Non-sensitive to `skills/`, anything
  identifying or financial to the private repo.
- Commits that change context carry `Context-Version: <marker>` — see the
  `session-handoff` skill.
- Run `python3 scripts/check-context.py` before pushing context changes.

## Runtime capability matrix — assign work the runtime can actually do

Agents differ by RUNTIME, not just by skill. A job handed to the wrong runtime
doesn't fail loudly, it half-completes and leaves debris.

| Capability | Claude Code CLI | Sol / opencode | Claude Cowork (cloud) |
|---|---|---|---|
| `git push` / release tags | ✅ owns it | ✅ | ✅ API connector; container git needs repo authorized |
| Repo read/write via GitHub API | ✅ | ✅ | ✅ owns it — no checkout, no lock cruft |
| Xcode, simulators, `xcodebuild` | ✅ owns it | ✅ | ❌ no macOS |
| fastlane, App Store Connect, signing | ✅ owns it | — | ❌ |
| Credential-bearing ops (EAS, AWS, Vercel) | ✅ owns it | — | ⚠️ connector-based only |
| SwiftUI / client feature work | ❌ reads only | ✅ owns it | ❌ |
| Backend / API / data work | ✅ owns it | ❌ reads only | ✅ scratch + research |
| Long unattended runs, bulk research | ⚠️ rate-limited | ⚠️ | ✅ owns it |

- **Never give Cowork an Xcode job or a git op through the device bridge.**
  Bridge git ops fail *and* shed lock cruft that blocks the next native session.
  Cleanup if it happens: `rm -rf .git/_bridge_cruft && rm -f .git/index.lock
  .git/HEAD.lock`, then `git fsck`.
- **Resolve your write path BEFORE any work, and state it.** Cowork: the GitHub
  connector (Composio → `GITHUB_COMMIT_MULTIPLE_FILES`). CLI/Sol: native git.
  Reading needs no connector; writing does, and that gap is where sessions
  improvise. A missing `gh` or a container-git 403 proves nothing. No path → say
  so and STOP; never write context to a vendor cache. Builds stay native.
- Ownership is one-way: Claude writes backend and reads Swift; Sol writes Swift
  and reads backend. Neither edits the other's tree.
- Credentials never move to close a capability gap. Reassign the job instead.
- Hand off through **files in a repo**, never chat.

## Cross-repo contracts — THE thing agents get wrong

The mobile app hand-declares TS types for the service's API. **Change a service
response shape and the app breaks silently while its mocked tests keep passing.**
(Happened Jun 2026: matches pagination envelope, broken for six weeks.)

- Service-side shape change → you MUST open a matching PR in
  `bamware-dating-app` (`src/api/*.ts` + screens + tests).
- App-side, never trust the declared type. Verify against the service's
  `src/schemas/*.ts` on its CURRENT main.

## Security ground rules (non-negotiable)

- **No credential values in git. Ever.** CI has a tripwire; it exists because an
  agent once committed an App Store Connect key.
- **No PII in a public repo.** This repo is public. Home address, phone, EEO
  self-identification, and compensation live in the private `interviews` repo.
- **Agents get capabilities, humans keep credentials.** Never authenticate to an
  account, generate signing keys, or handle secret values.
- **Account separation:** `mrbam88` is the only Bamware account. Never run
  Bamware EAS ops under the legacy `vpg-health` session; check `eas whoami`.

## App Store constraints (non-negotiable)

Baat was rejected **2026-08-04, Guideline 4.3(b) — saturated category.** A
concept rejection: unfixable in the binary, and Apple said "submit a new app."
Baat's native iOS track is closed (PWA only). Rail and backend are unharmed.

- `mrbam88` carries a 4.3(b) — expect scrutiny on every future submission.
- Never ship into a saturated category from this account.
- The differentiator must be **in the binary** and visible in the **listing**.
  A roadmap is not a 4.3 defense. No two Bamware apps may be near-duplicates.
- 🔴 BrewDesk is exposed (cafe finder, speed test cut from v1).

Full record, verbatim text, binding rules: `docs/app-store-rejections.md`.

## Working with Bilal

- **Chat style: short and sweet.** Bullets over prose. No fluff, no essays, no
  re-summarizing what just happened. He's an engineer — limit his reading.
- Direct recommendations over option menus. Plan before building.
- Mobile/Node analogies land best (RN + Express mental model).
- Specs live as GitHub issues with story/scope/out-of-scope/acceptance criteria.
- Keep tool use proportional. Broad audits and agent fan-out need an explicit ask.

## Deeper detail — read on demand

| Need | File |
|---|---|
| Repo detail, deploy targets, live endpoints | `docs/repos.md` |
| Definition of done, per-repo test gates | `docs/definition-of-done.md` |
| Brand, design tokens, themes | `docs/brand.md` |
| Why the context rules exist (drift incidents) | `docs/incidents.md` |
| App Store rejections, verbatim + binding rules | `docs/app-store-rejections.md` |
| Running this setup on other AI vendors | `docs/portability.md` |
| Business models, environments, product plans | `docs/` |
