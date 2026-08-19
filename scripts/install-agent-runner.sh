#!/usr/bin/env bash
# Install the standing engineer as a launchd user agent.
#
# A USER agent, not a daemon: it needs the logged-in GUI session for Xcode
# and the login keychain. It fires while the Mac is awake and skips wakes
# while it sleeps — that is intended, not a bug. There is no cloud fallback
# for Xcode work.
#
# Interval is deliberately 15 min rather than continuous: the board is the
# queue, and a queue polled every 15 min feels instant from a phone.

set -euo pipefail

SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" && pwd)"
RUNNER="$SCRIPT_DIR/agent-runner.sh"
LABEL="io.bamware.agent-runner"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/bamware"

chmod +x "$RUNNER"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat >"$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>$RUNNER</string>
  </array>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><false/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOG_DIR/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/launchd.err.log</string>
</dict>
</plist>
PLIST_EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "installed $LABEL (every 15 min, awake only)"
echo "  first run by hand, watching:  $RUNNER"
echo "  logs:                         tail -f $LOG_DIR/agent-runner.log"
echo "  stop:                         launchctl bootout gui/$(id -u)/$LABEL"
echo
echo "Do the first run by hand before trusting it unattended."
