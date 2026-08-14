# Context incidents — why the rules exist

Rules without their evidence get trimmed by whoever edits next. These are the
failures the `AGENTS.md` context rules were written against. All three share one
property: **nothing looked wrong at the time.**

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

## The pattern

Every one of these was a *copy* diverging from its source, and none announced
itself. That is why the rules favour fetching over caching, why the marker
exists, and why the checks in `scripts/check-context.py` are CI rather than
prose. Prose is a suggestion; a failing build is a wall.
