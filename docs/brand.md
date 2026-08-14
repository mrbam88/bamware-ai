# Brand & design system (pivot 2026-07-22)

Public positioning: bamware is a **multi-agent mobile app studio** — senior
mobile craft × a fleet of AI agents; fixed-scope sprints. The old pink brand is
dead.

Canonical design source: Claude Design project **"Bamware Design System"**
(claude.ai/design, Bilal's account; a skill export zip mirrors it 1:1). One
semantic token contract, two themes:

- **bamware studio** (default `:root`) — graphite surfaces + signal-lime
  `#A8E82F`, Geist + JetBrains Mono, mono `// comment` eyebrows, build-console
  card as the signature surface. No emoji.
- **Baat** (`.theme-baat`) — the case-study skin: espresso + champagne gold
  `#C9A86A`, Instrument Serif + Manrope (matches the app's `src/theme` / tenant
  config).

The `bamware-web` mockup shipped to production 2026-07-22 (bamware-web PR #1 →
bamware.io): landing rebuilt on the token contract, responsive, auth/legal/admin
routes untouched. Still old-brand: favicon, OG image; waitlist form parked
(route intact, not rendered).
