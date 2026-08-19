# Repos — detail, deploy targets, endpoints

This is the canonical repo list — the only one. `AGENTS.md` links here; read
this when you are about to work in a repo, not at session start.

| Repo | What | Deploy |
|---|---|---|
| `bamware-dating-app` | Baat mobile app. Expo 54 / RN 0.81, expo-router, Zustand + TanStack Query, strict TS, Jest + Maestro. White-label tenant config (`src/config/tenant.ts`) drives brand + theme. | EAS: merge→OTA preview channel; tag `v*`→TestFlight/Play (see repo's docs/RELEASING.md) |
| `bamware-dating-service` | Dating backend. Express on Lambda, DynamoDB single-table, Zod schemas, S3 presigned photo uploads, SNS push. Admin router behind ADMIN_SECRET. | GitHub Actions → Lambda `bamware-dev-dating-service` on every main push (auto) |
| `bamware-auth-service` | Auth backend. Express on Lambda, bcryptjs + JWT, multi-tenant (`tenantId`). | Lambda `bamware-dev-auth-service` |
| `bamware-client-core` | Shared TS lib (logger, audit, auth store). **Currently orphaned** — service inlined its logger, app vendored a stub (`vendor/client-core`). Its future = dating-app issue #6 (contract-package ADR). | npm-linked locally |
| `bamware-infra` | Terraform: DynamoDB, Lambda, API GW, IAM, S3 state. | manual |
| `bamware-workspace` | Meta-repo: submodules pinning known-good SHAs across repos + ops docs (RUNBOOK, HANDOFF). NOT a dev checkout — never run dev servers from it. | n/a |
| `bamware-web` | Marketing site + web auth targets (terms/privacy, reset-password, verify-email, member sign-up, universal-links well-known files). Next.js. | Vercel (build breaks block deploy) |
| `bamware-ios` | Reusable Swift package products: Core, UI, Messaging. Tenant-aware native foundation. | Swift Package |
| `bamware-brewdesk` | BrewDesk native SwiftUI app. Uses local BrewDeskKit/VenueKit and the shared iOS package. | Local/TestFlight |
| `bamware-venue-engine` | Express/Zod venue API with committed NYC cafe seed data. Backend partner for BrewDesk. | Vercel (`venuekit-ashen.vercel.app`) |
| `bamware-mcp` | MCP server exposing platform ops as agent tools: `create_tenant`, `seed_demo_data`, `board_ops`, `provision_dedicated` (renders Terraform + opens PR; `apply` stays human-gated). GitHub auth rides on `gh` CLI; never handles tokens. pnpm, tsup, vitest. | local (any MCP harness) |
| `interviews` | Private. Job-search tracker (one file per application) plus PII, EEO, and compensation answers. | n/a |
| `bamware-ai` | The constitution: AGENTS.md, STATE.md, shared skills, context CI. | n/a |

## Live endpoints (dev)

- Auth: `https://cje3ppxv47.execute-api.us-east-1.amazonaws.com`
- Dating: `https://1l5fzig94l.execute-api.us-east-1.amazonaws.com`
- Venue Engine: `https://venuekit-ashen.vercel.app`
- Region `us-east-1`; tenant id `bamware-dating`.
