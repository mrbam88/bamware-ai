# Context incidents — why the rules exist

Rules without their evidence get trimmed by whoever edits next. These are the
failures the `AGENTS.md` context rules were written against. Every one of them
shares one property: **nothing looked wrong at the time.**

## 2026-08-14 — a vendor cache went stale and nearly shipped

Two job-search skills lived as Claude account skills, synced from the repo on
2026-07-24. Three standard answers were committed to the repo that same day and
never reached the snapshot. A month later an agent loaded the snapshot to fill
job applications. It would have submitted against an incomplete profile.

Caught only because someone diffed the cache against the repo by hand.

**Rule it produced:** a vendor-synced copy is a cache, never the truth. The repo
wins. Skills in vendor accounts hold no facts — only a pointer.

## 2026-08-14 — PII committed to a public repo

While consolidating context into `bamware-ai`, an agent moved home address,
phone, EEO self-identification, and compensation figures into it without
checking that the repo was public. Removed from HEAD the same day; the history
purge is separate.

**Rule it produced:** no PII in a public repo. Identifying, demographic, and
financial answers live in the private `interviews` repo.

## 2026-08-14 — a stale clone answered confidently and wrongly

Minutes after that fix, an agent on a local clone was asked where compensation
lives. It answered with the right numbers, cited `skills/bilal-answers/SKILL.md`
and a line range — and was wrong. The data had moved to the private repo; those
lines held something else entirely. The answer was indistinguishable from a
correct one.

**Rule it produced:** `CONTEXT_VERSION`, and the requirement that an agent state
the version it read. Detection, not prevention — drift cannot be eliminated,
only made visible.

## 2026-08-18 — "no push access" declared without checking, context written to a vendor cache

A Cowork session needed to record an App Store rejection. It checked for a
`gh` binary, found none, declared it could not push, and wrote the record into
the Claude Project instead — with a note saying the repo was the source of
truth it couldn't reach. The Composio GitHub connector was authenticated and
live the entire session. In the same session, two Project-only docs (never
committed to git) were stale enough to produce confidently wrong advice about
what to build next.

**Rules it produced:** resolve and state your write path (`write-path:`)
before any work — Step 0 of `bamware-context`; a missing binary or a
container-git 403 proves nothing; if no path truly exists, STOP and hand over
a patch rather than writing durable context anywhere else.

## 2026-08-19 — an unverified aside became a false fact in Bilal's digest

The overnight runner, correctly aborting a brewdesk ticket over a missing CI
gate, added a side remark: `bamware-venue-engine` "has no .github/workflows
at all." It never looked — that repo was outside its ticket. The claim was
false (the repo had a full PR-triggered test gate). Hours later the daily
digest, also without checking, relayed the claim to Bilal as fact: two repos
blocked instead of one. Three backend tickets sat "blocked" that were never
blocked at all.

Same day, same class: the runner treated the (real) brewdesk CI gap — known
and checkable for weeks — as a reason to quit at 3am instead of a flag to
raise in daylight.

**Rules they produced:** claims about CI gates come from
`scripts/check-ci-gate.py` output, never from memory; a claim without its
quoted evidence is treated as unverified by every downstream agent; agents
report facts only about the repo they are working in; readiness checks moved
to grooming (`definition-of-ready`), and the runner's abort list shrank to
the three true safety stops (`standing-engineer`).

## 2026-08-20 — context skipped because the topic "wasn't Bamware"

A Cowork session in the bamware Project was asked for a GitHub security check
(public vs private repos) while Bilal was applying to jobs. The agent judged
the task "GitHub hygiene, not Bilal" and never invoked `bamware-context`. It
then enumerated every `bamware-*` repo via the browser, called the GitHub
connector "not available" (it was), and recommended making `bamware-ai`
private — which would have broken the raw-URL bootstrap every runtime depends
on. Three replies in before Bilal pointed out the context had not been read.

Root cause: the `AGENTS.md` rules only load *after* the skill fires, and the
skill's trigger was a topic list. A task framed as anything else slipped past
it. The Project's custom-instructions field — the one thing that loads
unconditionally — was empty.

**Rules it produced:** `bamware-context` triggers on *every* session in the
Project or touching an `mrbam88` repo, regardless of topic; the bamware Claude
Project's instructions field now requires the `context:` / `write-path:`
markers in the first reply; `bamware-ai` stays public by design — it is the
bootstrap, and PII already lives elsewhere.

## The pattern

Every one of these was a *copy* diverging from its source — or an agent
inventing a limitation instead of testing it — and none announced
itself. That is why the rules favour fetching over caching, why the marker
exists, and why the checks in `scripts/check-context.py` are CI rather than
prose. Prose is a suggestion; a failing build is a wall.
