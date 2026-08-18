# Runtimes — who can do what

Agents differ by RUNTIME, not just by skill. A job handed to the wrong runtime
doesn't fail loudly — it half-completes and leaves debris. Check this table
before assigning or accepting work.

## Capability matrix

| Capability | Claude Code CLI | Sol / opencode | Claude Cowork (cloud) |
|---|---|---|---|
| `git push` / release tags | ✅ owns it | ✅ | ✅ API connector; container git needs repo authorized |
| Repo read/write via GitHub API | ✅ | ✅ | ✅ owns it — no checkout, no lock cruft |
| Xcode, simulators, `xcodebuild` | ✅ owns it | ✅ | ❌ no macOS |
| fastlane, App Store Connect, signing | ✅ owns it | — | ❌ |
| Credential-bearing ops (EAS, AWS, Vercel) | ✅ owns it | — | ⚠️ connector-based only |
| SwiftUI / client feature work | ❌ reads only | ✅ owns it | ❌ |
| Backend / API / data work | ✅ owns it | ❌ reads only | ✅ scratch + research |
| Long unattended runs, bulk research | ⚠️ rate-limited | ⚠️ | ✅ owns it |

## Ownership rules

- Ownership is one-way: Claude writes backend and reads Swift; Sol writes
  Swift and reads backend. Neither edits the other's tree.
- Credentials never move to close a capability gap. Reassign the job instead.
- Hand off through files in a repo, never chat.
- Builds, tags, releases, signing stay native (CLI on the Mac).

## Cowork and git — the details

Reading the context repo needs no connector (public raw HTTPS). Writing does.

- **The write path in Cowork is the Composio GitHub connector**
  (`GITHUB_COMMIT_MULTIPLE_FILES` — atomic, multi-file, no checkout).
- Container `git push` works only for repos in the session's authorized
  set; otherwise the git proxy returns 403 ("not in this session's
  authorized repository set"). That is an authorization gap, not a missing
  capability.
- A missing `gh` binary proves nothing about access.
- **Never run git through the device bridge.** Bridge git ops fail AND shed
  lock cruft that blocks the next native session. Cleanup if it happens:
  `rm -rf .git/_bridge_cruft && rm -f .git/index.lock .git/HEAD.lock`,
  then `git fsck`.

Incident 2026-08-18: a Cowork session checked for a `gh` binary, found none,
declared "no push access," and wrote durable context into the Claude Project
instead. The connector was live the entire session. This is why AGENTS.md
requires resolving and stating the write path before any work.

## Working from a clone

- Prefer fetching raw URLs for reads — a fetch at read time cannot go stale.
  Clone only when you need to write.
- Reading from an existing clone? Re-sync first: `scripts/sync-context.sh`.
  If you cannot fast-forward, say so and stop.
- One writer per resource: never append to a file another agent also
  appends to.
- Context-changing commits carry a `Context-Version:` trailer and pass
  `python3 scripts/check-context.py` — procedure in the session-handoff
  skill.
