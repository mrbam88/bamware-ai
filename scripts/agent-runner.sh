#!/usr/bin/env bash
# Standing engineer — launchd entry point.
#
# Thin on purpose. This script owns the things bash is good at: not running
# twice, failing when the machine can't do the job, and leaving a trace.
# The engineering judgment lives in skills/standing-engineer/SKILL.md.
#
# Install:  scripts/install-agent-runner.sh
# Watch:    tail -f ~/Library/Logs/bamware/agent-runner.log
# Stop:     launchctl bootout gui/$(id -u)/io.bamware.agent-runner
#
# Run by hand: narrates to the terminal. Under launchd: log only.

set -uo pipefail

SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" && pwd)"
BAMWARE_AI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

LOG_DIR="$HOME/Library/Logs/bamware"
LOG="$LOG_DIR/agent-runner.log"
HEARTBEAT="$LOG_DIR/agent-runner.heartbeat"
LOCK="${TMPDIR:-/tmp}/bamware-agent-runner.lock"

mkdir -p "$LOG_DIR"

# A silent supervised run is indistinguishable from a hung one.
if [ -t 1 ]; then INTERACTIVE=1; else INTERACTIVE=0; fi

log() {
  local line
  line="$(date -u +%Y-%m-%dT%H:%M:%SZ)  $*"
  printf '%s\n' "$line" >>"$LOG"
  [ "$INTERACTIVE" = 1 ] && printf '%s\n' "$line"
  return 0
}
beat() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >"$HEARTBEAT"; }

[ "$INTERACTIVE" = 1 ] && printf 'log: %s\n' "$LOG"

# --- one at a time ---------------------------------------------------------
# mkdir is atomic on macOS; flock is not available here.
if ! mkdir "$LOCK" 2>/dev/null; then
  log "skip: lock held ($LOCK) — a wake is still working, or one died."
  log "      If nothing is running: rmdir $LOCK"
  exit 0
fi
cleanup() { rmdir "$LOCK" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# --- refuse to run half-capable -------------------------------------------
# A missing capability is an abort, never something to work around.
fail() { log "abort: $*"; beat "abort"; exit 1; }

for bin in git gh claude; do
  command -v "$bin" >/dev/null 2>&1 || fail "'$bin' not on PATH"
done
command -v xcodebuild >/dev/null 2>&1 || log "warn: no xcodebuild — Mobile cards will abort in-loop"
gh auth status >/dev/null 2>&1 || fail "gh not authenticated (run: gh auth login)"
curl -fsS -m 10 -o /dev/null https://api.github.com || fail "no network"

# The machine is a cache of this repo. Start from current context or not at all.
git -C "$BAMWARE_AI_DIR" fetch --quiet origin main 2>/dev/null || fail "cannot fetch bamware-ai"
if ! git -C "$BAMWARE_AI_DIR" merge-base --is-ancestor HEAD origin/main 2>/dev/null; then
  fail "local bamware-ai has diverged from origin/main — resolve by hand"
fi
git -C "$BAMWARE_AI_DIR" merge --quiet --ff-only origin/main 2>/dev/null || true

CONTEXT_VERSION="$(cat "$BAMWARE_AI_DIR/CONTEXT_VERSION" 2>/dev/null || echo unknown)"

# --- go --------------------------------------------------------------------
log "wake start (context: $CONTEXT_VERSION)"
beat "running"

PROMPT="Run the standing-engineer skill from $BAMWARE_AI_DIR/skills/standing-engineer/SKILL.md.
You are the unattended runner. Nobody is awake. Take exactly one Agent-ready
card, honour every hard stop, and open a PR — never a merge. If anything is
missing or ambiguous, comment on the issue and stop rather than guessing.
Context-Version: $CONTEXT_VERSION"

if [ "$INTERACTIVE" = 1 ]; then
  claude -p "$PROMPT" --dangerously-skip-permissions 2>&1 | tee -a "$LOG"
  rc=${PIPESTATUS[0]}
else
  claude -p "$PROMPT" --dangerously-skip-permissions >>"$LOG" 2>&1
  rc=$?
fi

if [ "$rc" -eq 0 ]; then
  log "wake ok"; beat "ok"
else
  log "wake FAILED rc=$rc"; beat "failed"; exit "$rc"
fi
