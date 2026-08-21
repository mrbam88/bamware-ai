#!/usr/bin/env bash
# Bootstrap any Mac into a Bamware dev machine.
#
# The machine is a CACHE of this repo — nothing on it is authored locally.
# Idempotent: re-run any time; it creates what's missing and warns on drift.
#
# New machine:
#   gh auth login
#   gh repo clone mrbam88/bamware-ai ~/code/bamware-ai
#   ~/code/bamware-ai/scripts/bootstrap.sh
#
# Sibling convention: every repo is checked out next to bamware-ai. Wherever
# you clone bamware-ai defines the root; per-repo AGENTS.md pointers
# (../bamware-ai/AGENTS.md) rely on this.

set -uo pipefail

SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" && pwd)"
BAMWARE_AI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CODE_DIR="$(cd "$BAMWARE_AI_DIR/.." && pwd)"

say() { printf '\n== %s\n' "$*"; }

# --- prereqs ---------------------------------------------------------------
missing=0
for bin in git gh npx; do
  command -v "$bin" >/dev/null 2>&1 || { echo "error: '$bin' not installed"; missing=1; }
done
((missing)) && exit 1
gh auth status >/dev/null 2>&1 || { echo "error: run 'gh auth login' first"; exit 1; }

# --- repos: siblings of bamware-ai -----------------------------------------
# Keep in sync with docs/repos.md (the canonical list).
REPOS=(
  bamware-dating-app
  bamware-dating-service
  bamware-auth-service
  bamware-client-core
  bamware-infra
  bamware-workspace
  bamware-web
  bamware-ios
  bamware-brewdesk
  bamware-venue-engine
  bamware-mcp
  interviews
)
say "repos -> $CODE_DIR"
for r in "${REPOS[@]}"; do
  if [ -d "$CODE_DIR/$r/.git" ]; then
    echo "  ok    $r"
  else
    echo "  clone $r"
    gh repo clone "mrbam88/$r" "$CODE_DIR/$r" -- --quiet \
      || echo "  warn: clone failed for $r (no access?) — skipped"
  fi
done

# --- general skills --------------------------------------------------------
# Installed via the vercel-labs `skills` CLI into ~/.agents, symlinked into
# ~/.claude/skills. This manifest mirrors ~/.agents/.skill-lock.json — when
# you add/remove a skill, update BOTH the machine and this list.
say "general skills (skills CLI -> ~/.agents + ~/.claude/skills)"
add_skills() { npx -y skills add "$1" -g -y -a claude-code -s "$2"; }
add_skills vercel-labs/skills find-skills
add_skills anthropics/skills docx,pdf,webapp-testing,web-artifacts-builder,theme-factory,skill-creator,mcp-builder,frontend-design,doc-coauthoring,brand-guidelines,internal-comms
add_skills vercel-labs/agent-skills vercel-react-best-practices,web-design-guidelines
add_skills mattpocock/skills improve-codebase-architecture
add_skills software-mansion/argent argent-react-native-app-workflow

# --- bamware skills -> Claude Code (global) --------------------------------
# opencode reads $BAMWARE_AI_DIR/skills directly (see templates/opencode.jsonc);
# Claude Code needs symlinks in ~/.claude/skills.
say "bamware skills -> ~/.claude/skills"
mkdir -p "$HOME/.claude/skills"
for d in "$BAMWARE_AI_DIR"/skills/*/; do
  d="${d%/}"
  [ -f "$d/SKILL.md" ] || continue
  name="$(basename "$d")"
  ln -sfn "$d" "$HOME/.claude/skills/$name"
  echo "  link  $name"
done

# --- opencode config -------------------------------------------------------
say "opencode config"
OC="$HOME/.config/opencode/opencode.jsonc"
mkdir -p "${OC%/*}"
render_oc() { sed "s|__BAMWARE_AI__|$BAMWARE_AI_DIR|g" "$BAMWARE_AI_DIR/templates/opencode.jsonc"; }
if [ ! -f "$OC" ]; then
  render_oc > "$OC"
  echo "  wrote $OC"
elif render_oc | diff -q - "$OC" >/dev/null 2>&1; then
  echo "  ok (matches template)"
else
  echo "  warn: $OC drifted from templates/opencode.jsonc."
  echo "  The repo wins — port intentional changes into the template, then re-run."
  render_oc | diff - "$OC" || true
fi

# --- Claude Code session-start hook ----------------------------------------
# Installs a SessionStart hook that runs preflight.sh on every new Claude
# session, injecting a drift report as context. Advisory only (never blocks).
say "claude code session-start hook"
"$SCRIPT_DIR/install-session-hook.sh" || echo "  warn: install-session-hook.sh failed — install manually per script header"

say "done"
echo "Optional, per machine:"
echo "  - ollama pull qwen3.6:35b-a3b   (local model advertised in opencode config)"
echo "  - vendor logins: claude login / opencode auth — stored per machine by design"
