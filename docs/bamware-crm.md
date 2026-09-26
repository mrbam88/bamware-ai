# Bamware CRM — start here

## Product direction

Bamware CRM is a generic, extensible business-management app for React Native
web and mobile. It is also the proving ground for reusable capabilities that
future Bamware apps can consume independently.

Bilal's priorities:

- Architecture is critical: preserve the ability to defer decisions and change
  implementations without rewriting the app.
- Reuse the existing Bamware ecosystem, including the web app.
- Bamware configures businesses manually first; automation can come later.
- Initial capabilities: appointments/calendar, offline tasks/checklists, and
  messaging among a pool of users. Messaging membership and initiation rules
  remain undecided.
- Warehouses and dental offices are examples of extensibility, not selected
  launch verticals. CRM's first real business workflow remains to be chosen.

## Current milestone

Bilal approved and authorized the first architecture proof: workspaces,
admin/member permissions, and offline tasks across web/mobile.

That slice is implemented and locally verified. Its Tasks module is consumed
by the app and an independent headless client. Browser and native storage are
separate adapters; existing Bamware JWT verification is reused.

**First user feedback:** Bilal walked through the web app and described the
first iteration as "very impressed" and "wow". Specific iteration-two changes
have not yet been requested.

## Where to continue

| Need | Source |
|---|---|
| Current implementation, test evidence, limitations and native workflow lessons | [First-slice results](crm-first-slice-results.md) |
| Architecture rationale, extension seams and deferred decisions | [Architecture and reuse inventory](bamware-crm-architecture.md) |
| Existing backend foundations and adaptation gaps | [Backend source audit](crm-backend-reuse-audit.md) |
| First-slice scope and acceptance criteria | [Spec](crm-first-slice-ticket.md) · [GitHub issue #31](https://github.com/mrbam88/bamware-ai/issues/31) |
| Repository location/status | [Repo map](repos.md) |

The source is published privately at `github.com/mrbam88/bamware-crm`
(2026-09-24, one commit `2136c09`; default branch `feat/crm-offline-tasks`,
no `main`). Clone it on any machine that needs it; omarchy has no checkout. Its README
owns setup commands; `CONTEXT.md` owns domain vocabulary; `docs/architecture.md`
owns implementation invariants; `docs/verification.md` records local gates.

## Next checkpoints

1. ~~Publish the CRM source~~ Done 2026-09-24 (private repo). Next: promote
   `feat/crm-offline-tasks` to `main` so the repo has a default trunk.
2. Capture concrete feedback from continued use and select the next workflow.
3. Before live use: register CRM with shared auth, configure real workspace
   memberships, and address the documented identity-hardening findings.
4. Verify Android separately. Current device evidence is iOS; current sign-in
   evidence uses local demo identities.

Calendar, messaging, push integration, custom records, automated provisioning
and high-volume sync are future work. Their existence is not implied by the
successful first slice.
