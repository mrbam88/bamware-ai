#!/bin/bash
# Install the AI usage collector as a systemd user timer on this machine.
#   scripts/install-ai-usage.sh <host-label>     e.g. omarchy, thinkpad
# The label is what the dashboard shows as "host"; every Omarchy box reports
# its hostname as "omarchy", so it is given explicitly. Safe to re-run.
#
# Before running: scripts/secrets-pull.sh (writes AI_USAGE_INGEST_TOKEN into
# ~/.config/bamware/ai-usage.env). See docs/ai-usage.md.
set -euo pipefail

host=${1:?usage: install-ai-usage.sh <host-label>}
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
env_file=$HOME/.config/bamware/ai-usage.env
say() { printf '\033[1;36m[ai-usage]\033[0m %s\n' "$1"; }

# set_key FILE KEY VALUE: replace KEY's line or append it. Never prints values.
set_key() {
  touch "$1" && chmod 600 "$1"
  if grep -q "^$2=" "$1"; then sed -i "s|^$2=.*|$2=$3|" "$1"; else echo "$2=$3" >>"$1"; fi
}

grep -q '^AI_USAGE_INGEST_TOKEN=.' "$env_file" 2>/dev/null ||
  { echo "no ingest token in $env_file: run scripts/secrets-pull.sh first" >&2; exit 1; }
set_key "$env_file" AI_USAGE_HOST "$host"
grep -q '^AI_USAGE_URL=' "$env_file" || set_key "$env_file" AI_USAGE_URL https://bamware.io

# Timers must survive logout on the always-on server.
if [[ $(loginctl show-user "$USER" -p Linger --value) != yes ]]; then
  loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER"
fi

# First run in the foreground so a bad token or URL fails loudly here.
"$repo_dir"/scripts/ai-usage-collect.py
mkdir -p "$HOME/.config/systemd/user"
cp "$repo_dir"/scripts/systemd/bamware-ai-usage.{service,timer} "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now bamware-ai-usage.timer
say "timer enabled for host '$host':"
systemctl --user list-timers bamware-ai-usage.timer --no-pager | sed -n '1,2p'
