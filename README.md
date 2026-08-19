# bamware-ai

The shared brain for Bamware's AI agents — org-level context, reusable
skills, and templates that any agent harness (Claude Code, Cursor,
opencode, cloud agents) can consume. Everything is markdown on purpose.

## Why this repo exists

Per-repo `AGENTS.md` files describe one codebase. Nothing described the
*system* — which is how a backend agent shipped an API contract change
(matches pagination, Jun 2026) that silently broke the mobile app for
six weeks. This repo is the cross-repo context that prevents that class
of failure.

## Layout

```
AGENTS.md            The system map: repos, deployed infra, contracts,
                     gates, security ground rules. Start here.
skills/              Reusable skills (SKILL.md format). Copy or symlink
                     into a project's .claude/skills/ — or paste into
                     any other tool's context.
templates/           ADR, agent-ready issue template.
```

## Sibling checkout convention

Every Bamware repo is checked out **next to** `bamware-ai` (any parent
directory works — `~/code` on the first machine). Cross-repo pointers rely
on it: each repo's `AGENTS.md` starts with "read `../bamware-ai/AGENTS.md`
first", and each repo's `CLAUDE.md` is a two-line shim that imports both:

```markdown
@AGENTS.md
@../bamware-ai/AGENTS.md
```

So any Claude Code session opened in any repo loads the system map
automatically; opencode gets it via its global config; anything else can
follow the plain-markdown pointer or the raw URL (`docs/portability.md`).

## New machine

The machine is a cache of this repo — nothing on it is authored locally
(rule 4). Three commands rebuild the whole harness on any Mac:

```sh
gh auth login
gh repo clone mrbam88/bamware-ai ~/code/bamware-ai
~/code/bamware-ai/scripts/bootstrap.sh
```

`bootstrap.sh` is idempotent: clones missing sibling repos, reinstalls the
general skill set (manifest in the script mirrors `~/.agents/.skill-lock.json`),
symlinks `skills/` into `~/.claude/skills`, and renders the opencode config
from `templates/opencode.jsonc`. If a local config drifted from the template,
it warns and shows the diff — the repo wins.

## How to use with each tool

- **Claude Code:** nothing per session — every repo's `CLAUDE.md` shim
  imports `AGENTS.md` + the system map (see sibling convention above), and
  `bootstrap.sh` links all `skills/` globally into `~/.claude/skills`.
- **OpenCode:** follow `docs/opencode-setup.md`. The global config (rendered
  from `templates/opencode.jsonc` by `bootstrap.sh`) advertises skills on
  demand and loads `AGENTS.md` for every session.
- **Cursor / anything else:** these are plain markdown; attach the system map
  and load individual skills only when relevant. No lock-in.

## Rules for this repo

1. Facts only — if it's stale, it's worse than nothing. Date claims
   that will age (`as of 2026-07`).
2. Nothing secret. Ever. Names of secrets are fine; values never.
   A private repo is NOT a secrets store — secrets live in EAS
   credentials / GitHub secrets / AWS Secrets Manager.
3. Small files, one concern each. Agents load selectively.
4. **Repo-first policy:** durable knowledge lives HERE, not on
   anyone's laptop. Agent sessions may keep local working memory, but
   anything worth surviving a laptop switch gets committed and pushed
   the same session it's learned. Commit early, push often.
