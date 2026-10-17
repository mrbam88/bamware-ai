# Engineering Lead trigger (#125)

Agent PRs get an independent Engineering Lead review. On PASS they're merged
and deployed without anyone asking. **The founder never merges, and the PR's
author never launches its own reviewer.** (2026-10-03: PR #113 sat green
because neither of those existed.)

## How it works

A scheduler runs `lead_review.py` on a fixed interval. **Not activated:** on
2026-10-03, Claude Code's permission classifier refused to let an agent
create that scheduler ("Create Unsafe Agents"). Activation is the founder's
decision (#125). Each run:

1. **Paused?** If `~/.local/state/bamware/emergency-stop.json` exists, it
   launches nothing (the founder emergency stop).
2. **Select:** open PRs that are not draft, `MERGEABLE` + `CLEAN`, have no
   failing or pending checks, have no `lead:hold` label, and haven't been
   reviewed at their current head. Errors retry once per head. At most 2
   reviews per run. This step is deterministic and makes no model calls.
3. **Human gates:** if a PR touches `.github/workflows/`, `vercel.json`,
   `fastlane/`, signing files or `eas.json`, it's recorded as `HUMAN_GATE`
   and never sent to the Lead.
4. **Review:** a detached checkout of the PR head, plus one headless Claude
   Code session (`opus`, Claude Max subscription only, `dontAsk`, no Edit).
   Its write permissions are scoped to this PR: `gh pr comment|review|merge
   <n> -R <repo>`. It follows `review-prompt.md` and `skills/qa-engineer`.
   It merges on PASS and requests changes on FAIL.
5. **Deploy:** if merged, it moves `~/code/worktrees/bamware-ai-main` to
   `origin/main`, but not while a `bamware-overnight-*` unit is active or the
   worktree has local changes. It restarts no services.

Receipts: `~/.local/state/bamware/engineering-lead/reviews/<repo>-<n>-<sha>/`
(`prompt.md`, `result.json`, `verdict.json`, `receipt.json`), indexed in
`reviewed.json`.

## Commands

```sh
python3 -m unittest discover -s services/engineering-lead   # 15 tests
```

Hold one PR: add the `lead:hold` label. Add a repo: another
`--repo OWNER/NAME=CHECKOUT[=DEPLOY_WORKTREE]` in the unit. The Lead needs that
repo's gates runnable on omarchy (dependencies installed). Xcode repos stay on
the Mac.

## Limits

- Covers `mrbam88/bamware-ai` only for now.
- Verdicts are receipts. The Chief of Staff doesn't read them yet, and
  `HUMAN_GATE` PRs aren't yet sent to the Command Center.
- Each review costs Claude Max quota. It isn't metered by
  `services/cfo/meter.py` yet.
