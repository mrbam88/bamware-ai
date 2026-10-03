# Release Manager Adapter: Bamware Web

Product: Bamware Web

## Repository

- Primary repo: `mrbam88/bamware-web`
- Default branch: `main`
- Stack: Next.js 16 / React 19
- Package manager: npm (package-lock.json present)

## Execution source of truth

Use GitHub issues/project state for backlog and workflow state. Apply the shared contract in `docs/release-manager-contract.md`.

## Required verification before merge

The repository CI currently runs on pull requests and pushes to `main`:

- `npm run lint`
- `npm test`

Do not duplicate the production build in GitHub CI. The repo explicitly delegates the production build gate to Vercel because it depends on production environment configuration.

## Release rail

Production hosting is Vercel.

The repository documents production environment values as living in Vercel project settings, and CI states that Vercel blocks deployment when the production build fails.

Treat the established Vercel integration as the release rail. Do not invent a second deploy mechanism. Determine deployment success from the actual Vercel deployment state before marking a batch Shipped.

## Release-ready condition

A Bamware Web batch is Release Ready when:

1. selected Ready items are merged to `main`,
2. required GitHub CI checks are green,
3. no unresolved human-only production configuration gate applies.

## Shipped condition

Mark Shipped only after the corresponding production Vercel deployment is confirmed successful.

A merge to `main` alone is not proof of shipment.

## Human-only gates

Surface as `Needs You` rather than blocking unrelated work when a change requires:

- production environment variable changes,
- credentials/secrets,
- spend approval under Bamware company policy,
- a product/contract decision that cannot be inferred safely.

## Notes for agents

- Read `mrbam88/bamware-web/AGENTS.md` and the Bamware root `AGENTS.md` before implementation.
- Follow the Next.js version-specific guidance required by the repo.
- Preserve existing auth/security boundaries and cross-repo contracts.
- Keep WIP at the shared contract limit of 2.
