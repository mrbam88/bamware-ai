# Agents view readability (#87)

The founder needs to recognize work, judge its recorded outcome and cost, and
open evidence without interpreting batch IDs or keeping the delegation tree
in memory. This slice improves the existing List and Work tree views.

## Design decisions

- Task title and purpose identify the work. Source issue titles were fetched
  from GitHub issues #75, #76 and #78 on 2026-10-02; the bounded cache strips
  only the repeated overnight prefix and Assistant suffix for display. Full
  titles remain on source links. Unknown tasks retain recorded labels and
  explicitly lack purpose metadata. No GitHub calls occur during rendering.
- Assistant development is a display alias for the known Assistant coding
  project. IDs and filter values remain stable. Repository links are provided
  only for the explicitly known bamware-ai association.
- Recorded status and prominent estimated/billed cost are separate from the
  Overnight batch tag. Accounting, pricing coverage and run details expand
  on demand. Neither view implies a live worker from a recent snapshot.
- Both views use the same task description, latest recorded state and cost
  projection. Cost categories stay separate; unavailable does not mean zero.
  Duplicate event IDs are deduplicated upstream. Potential overlap within an
  attempt/provider/model/category is excluded and marked incomplete. Attempt totals
  mixed with model/provider breakdowns are also excluded as ambiguous. Different
  repositories with the same task number remain separate. Totals concern only
  observed records, not project budgets or subscription invoices.
- The self adapter reports repo/branch/machine context, with no task or session.
  It now appears as repository context rather than an uncertain worker and
  contributes no task, run or uncertainty count.

## Review and evidence

Applied Design Critique, UX Copy and Accessibility Review skills. Independent
review requested clearer list status, a visible cost scope, larger touch
controls, and progressive disclosure of pricing/cache details; these were
incorporated. Local suite: 134 tests passed. Source links, zero versus unknown,
partial/mixed/overlapping costs, view parity and metadata-only shape are covered.
Synthetic preview at 390x844 and desktop: readable task names/purposes/cost,
no horizontal card overflow, no browser console errors. Independent contrast
measurements: primary text 17.40:1, muted text 5.63:1, selected toggle 7.81:1,
source links 9.40:1. Keyboard Enter switches views and opens native disclosure;
focus has a visible outline. Work-view controls/source links target 44px.

Browser desktop at simulated 200% zoom reflows. Existing global navigation,
filter and snapshot toolbar overflow on a phone at simulated 200% zoom; this
is an outstanding layout limitation, not a claim of full WCAG conformance.
No physical iPhone or screen-reader test is claimed. Production deployment and
live browser evidence must be recorded separately after release.

## Production verification — 2026-10-02 ET

PR #89 merged; server deployed application revision `f37e743` through the
existing Assistant release branch. Previous revision `5e44a0b` is saved in
`~/.local/state/bamware/releases/pre-work-views-polish-revision` on the server.
Service is active and HTTPS `/api/health` returned 200.

The owner's already authenticated Chrome tab was reused without reading or
moving credentials. Real list and tree views displayed the three descriptive
issue titles, purposes, matching recorded estimated costs, separate batch tags,
and correct repository/issue links. Four historical attempts stayed explicitly
finished with unverified outcome. The bottom repository context had no task or
worker claim. Desktop and temporary 390x844 viewport checks passed with no
horizontal overflow or captured console errors; the viewport was reset afterward.
No physical iPhone or screen-reader verification is claimed.

A distinct preexisting defect was found in the separate Active agents widget:
its self-adapter metadata used collection time as a heartbeat and appeared
active. That correction belongs to the execution-telemetry work under #79;
this release does not introduce cooking/active indicators or claim live pickup.
The narrow-phone simulated 200% global-toolbar limitation remains open.
