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
  bamware-brewdesk-flutter
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

# --- skills: one catalog, every machine -----------------------------------
# The catalog is $BAMWARE_AI_DIR/skills (first-party dirs + symlinks into the
# vendored .agents/skills, pinned by skills-lock.json). Nothing is installed
# globally any more; sync-skills.sh mirrors the catalog into ~/.claude/skills
# and archives anything else. opencode reads the catalog directly
# (templates/opencode.jsonc). Add a third-party skill with
#   cd $BAMWARE_AI_DIR && npx -y skills add <owner/repo> -a claude-code -s <name>
# then move it from .claude/skills into .agents/skills and link it from skills/.
say "skills -> ~/.claude/skills (one catalog)"
bash "$BAMWARE_AI_DIR/scripts/sync-skills.sh"

# --- Claude Code connectors: Composio stays loaded; native tools first ----------
# Bilal, 2026-10-27: no deny list. A deny would block a future Composio-only
# toolkit with no error worth reading. The rule is in docs/runtimes.md:
# git/gh/vercel first, Composio only when nothing local exists.

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

# --- secrets (vault pull) --------------------------------------------------
# One vault: AWS SSM Parameter Store (docs/secrets.md). Needs the deployer
# profile configured once: aws configure --profile bamware
if aws --profile "${BAMWARE_AWS_PROFILE:-bamware}" sts get-caller-identity >/dev/null 2>&1; then
  say "secrets (vault -> canonical paths)"
  bash "$(dirname "$0")/secrets-pull.sh"
else
  say "secrets SKIPPED — run: aws configure --profile bamware, then scripts/secrets-pull.sh"
fi

# Hermes is opt-in: does not install providers, migrate credentials or schedules.
if command -v hermes >/dev/null 2>&1; then
  say "Hermes available — integrate after reviewing docs/hermes-integration.md"
  printf '  python3 "%s/install-hermes.py" --apply\n' "$SCRIPT_DIR"
fi

say "done"
echo "Optional, per machine:"
echo "  - ollama pull qwen3.6:35b-a3b   (local model advertised in opencode config)"
echo "  - vendor logins: claude login / opencode auth — stored per machine by design"
