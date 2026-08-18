> **ARCHIVED 2026-08-18.** COMPLETED, not parked. The reorg it describes
> happened: `bamware-ai` is the context repo, `skills/` holds the shared IP, and
> the repo inventory it asks for is now `AGENTS.md` + `docs/repos.md`. Note the
> tenant it calls "Bot" shipped as **Baat**. Kept for provenance.

# bamware — Repo & Skills Reorg (planning state)

_Started 2026-07-24. Living planning note. Status: **PARKED** — repo investigation not yet started; user may switch session model to Fable first. This note exists so the switch is clean (externalize context before swapping engines)._

## Corrected company context

- **Bamware is the company / platform**, not an app. Its thesis: **spin up mobile apps quickly with agentic AI.**
- **Multi-tenant** backend (Terraform-managed infra). Adding a tenant → stand up another mobile app.
- **Bot** is the first and only live tenant: a **dating app**, full-stack, backend live, **just submitted to the App Store**.
- **Skills = company IP.** They are reusable across every future tenant, not app-specific. Not losing this IP is a core goal.

**Implication for the earlier portfolio doc:** it was written assuming "Bamware = one app." The multi-tenant + skills-as-IP reality *strengthens* the recommendation for a dedicated skills repo. Per-tenant durable context still versions with that tenant's code.

## The problem to solve (why we're reorganizing)

Get organized so new tenants/apps can be stood up fast without losing IP. Concretely:

1. **Learning may be split across locations.** Many months of work; the "learning" is either in the GitHub repo or left locally on a machine.
2. **Two-machine history.** User worked across two laptops; switching may have fragmented skills/context. **Source of truth = the current machine.**
3. **Repo naming / structure TBD.** Need to look at what's actually in GitHub before deciding what moves where.

## Open questions to resolve when we un-park

- What's actually in the GitHub repo today? (audit contents — code, skills, AGENTS.md/docs, IaC, decision history)
- What "learning"/skills live only on the local machine and never made it to GitHub?
- Repo topology: separate `bamware-skills` (shared IP) + per-tenant app repos + a platform/infra repo?
- Repo name(s) / GitHub owner or org.
- Capture the tenant's stack + the Terraform infra shape → seed the first `AGENTS.md`.

## Next action (when user says go)

Investigate the GitHub repo, inventory what's there vs. what's local, then propose a concrete rearrangement plan.
