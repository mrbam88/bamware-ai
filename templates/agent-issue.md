<!-- Agent-ready issue template. See skills/agent-ready-tickets/SKILL.md
     for the rules. Delete these comments before filing. -->

## Story
As a <user>, I <capability>, so that <why>.
(Design ref: <link/file> if visual.)

## Scope
- <file-level change 1 — name the files/modules>
- <types/components to extend and where they live>
- <data-model changes — optional fields if backend-pending>

## Out of scope
<What an eager agent would build but must not.>

## Acceptance criteria
- [ ] `tsc --noEmit` clean; tests green (CI enforces)
- [ ] App boots; changed flows exercised in simulator
- [ ] <feature-specific observable check>
- [ ] <renders correctly with AND without new optional data>
- [ ] Styling via theme tokens only — zero hex literals in new code

## Context for agents
<Cross-repo coordination, related issues, motivating bugs.>
