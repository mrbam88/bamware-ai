#!/usr/bin/env bash
# Read-only session-start drift check.
#
# Prints a short report to stdout in the format:
#   context: <local-marker> [STALE — remote: <remote-marker>]
#   write-path: native git
#   drift: none
# OR:
#   drift: N — item1; item2; ...
#
# Wired as a Claude Code SessionStart hook (see install-session-hook.sh) so
# every session opens with a known drift baseline. Runnable standalone too:
#   ~/code/<parent>/bamware-ai/scripts/preflight.sh
#
# Advisory only: always exits 0. Fixing drift is a separate command
# (bootstrap.sh is idempotent).

set -u

# -- locate bamware-ai ------------------------------------------------------
if [ -n "${BAMWARE_AI_DIR:-}" ] && [ -d "$BAMWARE_AI_DIR/.git" ]; then
  AI_DIR="$BAMWARE_AI_DIR"
elif [ -d "$HOME/code/github/bamware-ai/.git" ]; then
  AI_DIR="$HOME/code/github/bamware-ai"
elif [ -d "$HOME/code/bamware-ai/.git" ]; then
  AI_DIR="$HOME/code/bamware-ai"
else
  echo "context: UNKNOWN"
  echo "write-path: unknown"
  echo "drift: CRITICAL — bamware-ai not cloned; run 'gh repo clone mrbam88/bamware-ai <parent>/bamware-ai && <parent>/bamware-ai/scripts/bootstrap.sh'"
  exit 0
fi

CODE_DIR="$(cd "$AI_DIR/.." && pwd)"
DRIFT=()

# -- 1. CONTEXT_VERSION: local vs remote -----------------------------------
LOCAL_MARKER="$(tr -d '\n' < "$AI_DIR/CONTEXT_VERSION" 2>/dev/null || true)"
REMOTE_MARKER="$(curl -fsS --max-time 3 https://raw.githubusercontent.com/mrbam88/bamware-ai/main/CONTEXT_VERSION 2>/dev/null | tr -d '\n' || true)"

if [ -z "$LOCAL_MARKER" ]; then
  MARKER_DISPLAY="MISSING"
  DRIFT+=("local CONTEXT_VERSION missing — cd $AI_DIR && git pull")
elif [ -z "$REMOTE_MARKER" ]; then
  MARKER_DISPLAY="$LOCAL_MARKER (remote unreachable)"
elif [ "$LOCAL_MARKER" != "$REMOTE_MARKER" ]; then
  MARKER_DISPLAY="$LOCAL_MARKER (STALE — remote: $REMOTE_MARKER)"
  DRIFT+=("bamware-ai stale: cd $AI_DIR && git pull")
else
  MARKER_DISPLAY="$LOCAL_MARKER"
fi

# -- 2. sibling repos per bootstrap manifest -------------------------------
# Keep in sync with scripts/bootstrap.sh REPOS array.
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
MISSING_REPOS=()
for r in "${REPOS[@]}"; do
  [ -d "$CODE_DIR/$r/.git" ] || MISSING_REPOS+=("$r")
done
if [ ${#MISSING_REPOS[@]} -gt 0 ]; then
  DRIFT+=("${#MISSING_REPOS[@]} sibling repos missing (${MISSING_REPOS[*]}) — run $AI_DIR/scripts/bootstrap.sh")
fi

# -- 3. CLAUDE.md shim per sibling repo ------------------------------------
# Skip:
#  - bamware-workspace: Codespace umbrella, not a normal repo
#  - bamware-rn: deprecated, not in manifest but may be present locally
SKIP_SHIM=(bamware-workspace bamware-rn)
MISSING_SHIMS=()
for r in "${REPOS[@]}"; do
  [ -d "$CODE_DIR/$r/.git" ] || continue
  skip=0
  for s in "${SKIP_SHIM[@]}"; do
    [ "$r" = "$s" ] && { skip=1; break; }
  done
  [ $skip -eq 1 ] && continue
  [ -f "$CODE_DIR/$r/CLAUDE.md" ] || MISSING_SHIMS+=("$r")
done
if [ ${#MISSING_SHIMS[@]} -gt 0 ]; then
  DRIFT+=("${#MISSING_SHIMS[@]} repos missing CLAUDE.md shim (${MISSING_SHIMS[*]})")
fi

# -- 4. ~/.claude/skills/ has bamware skills symlinked ---------------------
if [ ! -d "$HOME/.claude/skills" ]; then
  DRIFT+=("~/.claude/skills/ missing — run $AI_DIR/scripts/bootstrap.sh")
else
  # Pick a bamware skill known to exist in the repo to verify symlinks
  probe_skill=""
  for candidate in session-handoff qa-engineer standing-engineer; do
    if [ -d "$AI_DIR/skills/$candidate" ]; then probe_skill="$candidate"; break; fi
  done
  if [ -n "$probe_skill" ] && [ ! -L "$HOME/.claude/skills/$probe_skill" ]; then
    DRIFT+=("bamware skills not linked into ~/.claude/skills/ — run $AI_DIR/scripts/bootstrap.sh")
  fi
fi

# -- report ----------------------------------------------------------------
echo "context: $MARKER_DISPLAY"
echo "write-path: native git"
if [ ${#DRIFT[@]} -eq 0 ]; then
  echo "drift: none"
else
  # Join items with '; '
  joined=""
  for i in "${!DRIFT[@]}"; do
    if [ $i -eq 0 ]; then joined="${DRIFT[$i]}"; else joined="$joined; ${DRIFT[$i]}"; fi
  done
  echo "drift: ${#DRIFT[@]} — $joined"
fi
exit 0
