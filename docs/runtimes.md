# Runtimes — who can do what

Agents differ by actual runtime capabilities, not model brand. A job handed to the wrong runtime
doesn't fail loudly — it half-completes and leaves debris. Check this table
before assigning or accepting work.

**Runtime is only half the answer — check the MACHINE too**
(`docs/machines.md`). A CLI can run on different machines. The same harness on
Linux has no Xcode, iOS simulators, fastlane iOS builds or Apple signing; every
row marked *Mac only* is unavailable there regardless of the selected model.

## Capability matrix

| Capability | Machine | Native CLI harness (any model) | Local app/tool bridge | Cloud/web runtime |
|---|---|---|---|---|
| `git push` / release tags | any | Authorized native git/gh | Only with appropriate repo tools | GitHub connector; container git needs repo authorization |
| Repo read/write via GitHub API | any | Authorized gh/API | Check available connector | Authorized GitHub connector |
| Xcode, simulators, `xcodebuild` | **Mac only** | Installed Apple tools | Only through a capable Mac bridge | No local Apple validation without a Mac executor |
| fastlane iOS build/signing/upload | **Mac only** | Existing authorized setup | Check Mac bridge capability | Requires an authorized Mac executor |
| Physical iPhone smoke / recording | **Mac only** | Connected device + tools | Requires device bridge | Requires a physical-device executor |
| Existing EAS/AWS/Vercel operations | any | Existing authorized CLI | Check available authorized tools | Existing authorized connector |
| SwiftUI source edits | any | When assigned; Mac required for validation | When assigned and repo tools exist | Repo tools required; hand off Mac validation |
| Backend / API / data work | any | When assigned, with supported tools | Check shell/filesystem capability | Check runtime/tools; scratch research alone is not deployment access |
| Flutter / Android build | Capable machine | Installed SDK/toolchain required | Check build bridge | Requires a suitable build executor |
| Long unattended runs / research | any | Subject to quota/spend/task authorization | Same | Same; cloud does not mean unlimited or free |

## Ownership rules

- Release routing is service-specific, not determined by the model's name.
  For Venue Engine, read `docs/venue-engine-deployment.md` before accepting or
  handing off deployment: local checks, then direct existing-project Vercel
  deployment. A runtime access gap does not make GitHub Actions a prerequisite.
- Assign ownership by the current task, scope and verified tools. Claude, Grok,
  GPT or another model may fill any compatible role; no model permanently owns
  a codebase. Respect another active agent's scope and one writer per resource.
- Credentials never move to close a capability gap. Reassign the job instead.
- Hand off through files in a repo, never chat.
- Apple builds/signing need the Mac. Backend releases follow their service
  runbook using the authorized runtime; a Linux native CLI is not disqualified
  by model name. Git publication follows the runtime write path.
- A *Mac only* row is a hard stop on the ThinkPad, not a slow path. Reassign
  the ticket to the Mac runner; never improvise a substitute.

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
