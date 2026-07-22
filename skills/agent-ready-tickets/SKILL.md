---
name: agent-ready-tickets
description: Write GitHub issues that autonomous coding agents can execute without clarification. Use when turning a feature idea into a spec, planning an agent fan-out, or reviewing whether an existing issue is agent-ready.
---

# Writing agent-ready tickets

A ticket is agent-ready when an agent with no conversation context can
implement it, verify it, and open a mergeable PR. The spec IS the prompt.

## Structure (all five sections, always)

```markdown
## Story
As a <user>, <capability>, so <why>. Reference the design source if visual.

## Scope
- Concrete file-level changes: name the files/modules to touch
- Name the types/components to extend and where they live
- State data-model changes explicitly (optional fields for backend-pending)

## Out of scope
What an eager agent would build but must not. Every ticket has this
section — an empty one means you haven't thought about it.

## Acceptance criteria
- [ ] tsc --noEmit clean; tests green (CI enforces)
- [ ] App boots; changed flows exercised in simulator
- [ ] <feature-specific, observable checks — "renders with AND without
      the new field", "no layout shift when absent">
- [ ] Styling via theme tokens only

## Context for agents  (optional)
Cross-repo coordination, related issues, motivating bugs.
```

## Rules that make it work

1. **Orthogonality beats size.** Parallel tickets must not touch the
   same files. Four small orthogonal tickets > two overlapping epics —
   overlapping agents produce merge hell, not synergy.
2. **Optional-first data changes.** New API fields are optional with
   render-nothing fallbacks, so the ticket ships before the backend does.
3. **Acceptance criteria are observable**, not aspirational: "chat
   renders with and without commonground" is checkable; "works well" is
   not.
4. **Out-of-scope prevents scope creep**, the #1 agent failure mode
   after silent breakage.
5. Examples of the pattern: bamware-dating-app issues #2–#6.
