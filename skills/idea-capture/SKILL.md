---
name: idea-capture
description: Capture and manage Bilal's app and business ideas as `idea` tickets on the Bamware board. Use when Bilal spitballs a new app, product or business idea, says "new idea", asks to capture or park an idea, or asks what ideas are in the backlog.
---

# Idea capture

Bamware is meant to be a machine of ideas and apps (Bilal, 2026-09-21). He
generates many ideas in conversation. Each one becomes **one ticket**, fast,
so nothing lives only in a chat. Capturing an idea is not a commitment to
build it.

## Rules

- **No code, no prototype, no spend, no vendor signup.** Capture only, unless
  Bilal asks for more in that message.
- **One idea = one issue** on `mrbam88/bamware-ai`, label `idea`. Search open
  `idea` tickets first; if it already exists, add a comment instead of a new
  ticket.
- **This repo is public.** Leave out personal details, family, health, names of
  private people, and anything Bilal would not post publicly. Write "founder"
  and keep the motivation generic. If an idea cannot be described without
  private detail, tell Bilal and ask where he wants it kept.
- Capture his words first, then add research. Do not talk him out of it, and
  do not oversell it. Correct a wrong market assumption once, plainly.
- Reply short: ticket link, one-line verdict, the biggest risk.

## Depth — match the ask

| Bilal says | Do |
|---|---|
| A passing thought, a few lines | **Quick capture:** story + idea + open questions. No research. About 2 minutes. |
| "Is this feasible?", "what's the competition?", asks for a PRD or spike | **Spike capture:** one research pass (one agent, ~20 searches, primary sources, mark anything unverified), then the full template. |

Default to quick capture. Research costs quota (`docs/token-diet.md`).

## Ticket template

Title: `Idea: <name> — <one-line promise>` (spike capture: `Spike: …`).

```
## Story
As <user>, I want <outcome>, so that <why>. Idea capture only, no code.

## Product idea
User · promise · positioning · rough pipeline or how it works

## What is already known        (spike capture only)
Competitors table (product / what it does / price / note) · the gap ·
vendor or platform rules that decide the stack · legal and App Store notes

## First-pass economics          (spike capture only)
Cost per user per month, price the market already pays, likely pricing shape.
Show the arithmetic. Label it an estimate.

## Open questions / scope of the spike
Numbered. What must be answered before a go / wait / no-go.

## Out of scope
Code, prototype, spend, private data.

## Acceptance criteria
Checklist ending in: PRD in docs/ with go / wait / no-go and the trigger
that would flip "wait" to "go". Spike spend: $0.

## Sources
```

Worked example: bamware-ai#32.

## Board fields (set all at filing, see `board-ops`)

Status **Todo** · Priority **P2 — later** · Area = closest fit (most app ideas:
Mobile) · Size **S** quick capture / **M** spike · Worker **Supervised** ·
Work Type **Spike**. Bilal raises priority himself; never promote an idea.

## Managing the list

- List: `gh issue list --repo mrbam88/bamware-ai --label idea --state open`
- New detail on an existing idea → comment on its ticket, or edit the body if
  it changes the idea itself.
- When Bilal asks "what ideas do I have?": one line per ticket — number, name,
  verdict, biggest risk. No re-summaries.
- Bilal kills an idea → close as **not planned** with a one-line reason. Keep
  the ticket; dead ideas stop repeats.
- Bilal picks an idea to build → the idea ticket becomes the epic or links to
  one; real work gets its own tickets through `agent-ready-tickets` and
  `definition-of-ready`. Remove nothing.
- Do not add ideas to `STATE.md` until Bilal commits to one. STATE is for what
  is being built.
