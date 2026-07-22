# Environments & test accounts

## Environments (as of 2026-07-23)

| Env | Auth API | Dating API | Status |
|---|---|---|---|
| `dev` | cje3ppxv47.execute-api.us-east-1 | 1l5fzig94l.execute-api.us-east-1 | live — serves TestFlight + all testing |
| `prod` | — | — | future; unlocked by bamware-infra#1 (Terraform completeness) |

Rules:
- The mobile app's tenant config points at ONE env per build; today dev
  doubles as prod. When prod exists, `tenant.ts` api URLs become
  env-driven (EAS env per channel).
- Never point local scripts at an env implicitly — export
  `BAMWARE_ENV=dev` and read URLs from this table's source of truth
  (seeds/config in the service repo).

## Test accounts

Deterministic personas, seeded by `bamware-dating-service`
`scripts/seed-personas` (see its README once landed). One shared
password from env `TEST_SEED_PASSWORD` — never committed.

| Account | Purpose |
|---|---|
| `hero@test.bamware.io` | Screenshot/demo hero — rich profile, 3+ matches, active chats |
| `empty@test.bamware.io` | Empty-states testing — profile, zero matches/swipes |
| `newbie@test.bamware.io` | Onboarding testing — auth account, NO profile |
| `appreview@bamware.io` / `demo.review@bamware.io` | Apple review (see listing pack) |
| persona cast (`noor@`, `zara@`, `meera@`, `arjun@`, …`@test.bamware.io`) | The world the above accounts see |

Reset/reseed: idempotent — rerun the script; it upserts. Legacy ad-hoc
accounts (kobe/lebron era, demo.noor2) are superseded; don't build on
them.

## Account tiers (the fake/real distinction)

| Tier | What | Login | Cleanup |
|---|---|---|---|
| Scenery | isFake profile rows (admin AI seed) — no auth record, CANNOT log in | never | TTL 30d |
| Cast | persona accounts @test.bamware.io — full real accounts for driving | yes | reseedable |
| Humans | real users | yes | never |

Rule: scenery never ships to prod discover (service issue: prod guard).
Want a drivable "fake"? That is a persona, not a seed.
