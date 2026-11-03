# Bamware — how the system is designed

One person (Bilal) runs a software company with AI agents as the staff. This
file is the shape of that system: what exists, where it runs, why it is built
this way, and what is still undecided. `AGENTS.md` is the rules every agent
loads; this is the picture behind the rules. Keep it under 150 lines. Detail
lives in `docs/` and `skills/`, linked below.

## 1. The idea in one paragraph

Agents are cheap and forgetful; Bilal's time and money are not. So the design
puts everything durable in **git and Notion**, makes every rule that must
always hold a **machine check** rather than a prompt, keeps the always-loaded
context **small** (one 6 KB file) with deeper **skills loaded on demand**, and
routes work by **capability of the machine**, not by which model is fashionable
this week. Products are small, shipped often, and verified before merge.

## 2. Principles, each with its enforcement

| Principle | Why | Enforced by |
|---|---|---|
| Never a surprise bill (Rule #1) | one bad bill ends the company | CFO halt file every runner honours; `$20` stop-and-ask; quota sampler |
| Plan before code | agents invent the problem otherwise | specs are GitHub issues with story / scope / out-of-scope / acceptance; `agent-ready-tickets`, `definition-of-ready` |
| Verify before merge | volume without a referee hurts stability | CI on every repo; `scripts/check-context.py` on this one; QA merges only after green + evidence (`qa-engineer`) |
| Small always-loaded context | every agent pays for it every session | `AGENTS.md` capped at 6000 bytes by CI; skills in `skills/` loaded per task |
| Encode mistakes, not aspirations | incidents repeat unless a check stops them | each check in `check-context.py` names the drift it caught; hooks cap reply length |
| Continuity across agents | Bilal switches models and harnesses daily | `STATE.md` + `CONTEXT_VERSION` marker; `session-handoff` skill; nothing durable in vendor memory |
| Least privilege | agents open PRs, humans and gates merge | public repo holds no secrets (`docs/security.md`); seat routes, never executes; store submission and spend are text gates |
| One path to production | drift between copies is how things break silently | mobile ships from the Mac rail only; web from Vercel; server jobs from `~/.local/bin` and user systemd |

## 3. The shape

```
 Bilal ──chat──▶ Harness (Claude Code CLI, Cowork, Codex, opencode)
   │                 │ reads AGENTS.md, STATE.md, skills; writes back via git/gh
   │                 ▼
   │          github.com/mrbam88/bamware-ai   ◀── CI: context checks, version stamp
   │          (constitution: rules, state, skills, docs, scripts)
   │
   └─Discord─▶ Seat (services/discord-router on the server)
                     │ routes short asks to a Runner (Claude / Codex / opencode),
                     │ quota-aware, never runs a model itself (ADR 0002)
                     ▼
              Runner opens PRs in product repos ──▶ QA gate ──▶ merge ──▶ deploy
```

Three stores, three jobs: **git** owns code and versioned rules, **Notion**
owns organisation and drafts (Job Tracker, daily newspaper), **Discord** is the
alert and notice board. Drive holds shared files. Vendor memories are caches.

## 4. What runs where

| Machine | Role | Runs |
|---|---|---|
| `mac` (M3 Pro, macOS) | the only machine that can ship Apple | Xcode, simulators, signing, TestFlight, App Store; Bilal's daily browser |
| `thinkpad` (X1, Omarchy) | portable daily driver | code, browser, backend dev; hostname is also `omarchy`, so never trust `hostname` |
| `omarchy` (2019 MBP, Omarchy) | the always-on server, on Tailscale | everything below |

On the server, as user systemd units (see `scripts/systemd`, `docs/discord.md`):

- **Seat and voice:** `discord-router`, `ask` (push-to-talk, read-only
  `claude -p`), `assistant-web`, `buttons` (17 whitelisted apartment actions,
  no AI in the loop).
- **Daily rhythm:** `bamware-daily-brief` (8 AM Notion newspaper), CFO burn
  alert and quota sampler, scrum sweep, board cache, venue quality, Neon dump
  and restore drill.
- **Apartment:** `vibes-{morning,afternoon,evening}`, `daylight`, `presence`,
  `roomlevel`, `nba-watch`, `gameday`. All in `skills/bamware-smart-home`.
  Lights never block on anything else; last button press wins.

Mass job applications also run on the server (headless Chrome); Bilal's own
Chrome is never touched (`docs/mass-apply-cli.md`).

## 5. Products and repos

Full table with deploy targets: [`docs/repos.md`](docs/repos.md).

- **BrewDesk** (live on the App Store since 2026-09-12): native SwiftUI app
  `bamware-brewdesk` + Flutter/Android client, backed by `bamware-venue-engine`
  (Express/Zod on Vercel). Grounded chat shipped 2026-11.
- **Baat** (white-label dating): Expo/RN app + Express-on-Lambda services +
  Terraform. Shared Swift packages in `bamware-ios`.
- **bamware-crm**, **bamware-mcp**, **bamware-web**: workspace, agent tools,
  marketing site.
- **interviews** (private): Bilal's career assets. Public skills route to it.

## 6. Decisions on record

- [ADR 0001](docs/adr/0001-one-identity-platform-for-all-apps.md): one identity
  platform for every app.
- [ADR 0002](docs/adr/0002-router-over-framework-for-the-discord-seat.md): the
  Discord seat is a router over agent CLIs, not an agent framework. Hermes
  retired 2026-10-21; never reinstall.
- Dated principles live in `AGENTS.md` (Rule #1 2026-10-20, primers 2026-10-24,
  100-word rule 2026-10-03, native tools first 2026-10-27). Glossary: `CONTEXT.md`.
- Incidents that became rules: [`docs/incidents.md`](docs/incidents.md).

## 7. Not decided, as of 2026-11-03

- **Factory vs assistant.** The role layer (Scrum Master, CFO, Chief of Staff)
  is an org chart for a company of one and Bilal says it is not working. The
  pieces he uses daily were each built in an evening. Proposed: keep the job
  search and the daily brief, freeze the rest. His call.
- **Voice.** Push-to-talk is on a 14-day trial to 2026-11-14; wake word only
  if he actually uses it.
- **Lights.** "No white light" (2026-10-29) conflicts with the daylight
  tracker and afternoon preset, which set 4500K by design.

## 8. Changing this file

Edit it when the shape changes: a new machine, store, service, product, or a
decision that moves a row in section 2 or 7. Dated incidents go in `STATE.md`
and `docs/incidents.md`, not here. If a section grows past a screen, move the
detail to `docs/` and leave the link.
