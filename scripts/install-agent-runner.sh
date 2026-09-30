#!/usr/bin/env bash
# Install the standing engineer on the `omarchy` build server as a systemd
# user timer.
#
# The runner lives on the always-on server, not the M3 (Bilal, 2026-09-30).
# The M3 travels and sleeps; the server does neither. Cards that need Xcode
# are skipped by the runner and left for the Mac.
#
# Interval is 15 min after the previous wake finished: the board is the
# queue, and a queue polled every 15 min feels instant from a phone.
#
# The runner gets its own detached worktree on origin/main, so it never
# fights Bilal's interactive checkout, which may sit on a feature branch.

set -euo pipefail

if [ "$(uname -s)" = Darwin ]; then
  echo "The runner belongs on the omarchy build server, not a Mac (2026-09-30)."
  echo "Remove an old launchd install with:"
  echo "  launchctl bootout gui/\$(id -u)/io.bamware.agent-runner; rm ~/Library/LaunchAgents/io.bamware.agent-runner.plist"
  exit 1
fi

SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && git rev-parse --path-format=absolute --git-common-dir)"
REPO="${REPO%/.git}"
RUNNER_TREE="$HOME/code/worktrees/bamware-ai-runner"
UNIT_DIR="$HOME/.config/systemd/user"

git -C "$REPO" fetch --quiet origin main
if [ -d "$RUNNER_TREE" ]; then
  git -C "$RUNNER_TREE" checkout --quiet --detach origin/main
else
  mkdir -p "${RUNNER_TREE%/*}"
  git -C "$REPO" worktree add --quiet --detach "$RUNNER_TREE" origin/main
fi
chmod +x "$RUNNER_TREE/scripts/agent-runner.sh"

# Timers must fire with nobody logged in.
loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER"

mkdir -p "$UNIT_DIR"
cp "$RUNNER_TREE"/scripts/systemd/bamware-agent-runner.{service,timer} "$UNIT_DIR/"
systemctl --user daemon-reload
systemctl --user enable --now bamware-agent-runner.timer

echo "installed bamware-agent-runner.timer (15 min after each wake ends)"
echo "  runner checkout:  $RUNNER_TREE (detached, follows origin/main)"
echo "  first run by hand, watching:  $RUNNER_TREE/scripts/agent-runner.sh"
echo "  logs:   tail -f ~/.local/state/bamware/agent-runner.log"
echo "  status: systemctl --user list-timers bamware-agent-runner.timer"
echo "  stop:   systemctl --user disable --now bamware-agent-runner.timer"
