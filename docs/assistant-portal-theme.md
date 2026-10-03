# Assistant portal theme

The personal Assistant portal uses Tokyo Night Storm consistently across login,
chat, Decisions, Agents, and Admin. This is a portal preference, not a change to
Bamware's other products or the desktop configuration.

## Design and sources

Palette verified against installed `tokyonight.nvim` Storm colors (commit
`cdc07ac`) and the canonical dotfiles Storm terminal theme. The main background
is `#24283b`, surface `#1f2335`, text `#c0caf5`, muted text `#a9b1d6`, blue accent
`#7aa2f7`, and warm attention accent `#ff9e64`. Shared tokens retain readable
work titles, prominent estimated costs, explicit status words and source links.
Native controls use the same palette even when the operating system prefers light.

State is communicated with text and symbols as well as color. Focus is visibly
outlined. Motion is disabled under `prefers-reduced-motion`. Technical details
remain collapsed; this slice does not alter cost or task projection semantics.

## Evidence-driven activity

`Cooking · Coding` (or another named phase) requires a validated active worker,
working execution status, known phase, and an unexpired execution lease of at
most two minutes. The client downgrades the label when the lease expires without
requiring a refresh. Historical observations are not called heartbeats. No real
producer is claimed by this presentation change; preview evidence is explicitly
synthetic. Critical state is not inferred from unknown or failed historical work.

## Validation

The 134-test application suite and JavaScript syntax check pass. Applied Design
Critique, UX Copy and Accessibility Review skills with independent review.
Measured contrast on the main background: body 9.02:1, muted 6.90:1, control
boundary 3.49:1; selected button 6.56:1. Surface contrast is higher. Local desktop
and 390px screenshots cover login, work tree, activity and Admin. Reduced-motion
computed animation is `none`. Synthetic Cooking expires automatically without
refresh; historical rows remain unverified. No console errors were captured.

The existing narrow-phone 200% zoom global toolbar overflow remains tracked;
no physical iPhone, screen-reader or full WCAG conformance claim is made.
Production verification is recorded after deployment.
