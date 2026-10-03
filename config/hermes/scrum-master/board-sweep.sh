#!/usr/bin/env bash
# Hermes cron --script wrapper for the scrum-master profile (bamware-ai#98).
# Install: ~/.hermes/profiles/scrum-master/scripts/board-sweep.sh (Hermes only
# runs scripts from the profile's scripts/ dir). The code runs from the one
# deployed copy of main; this file holds only deployment facts.
set -euo pipefail
collector=/home/bilal/code/worktrees/bamware-ai-main/services/scrum-master/board_sweep.py
if [[ ! -f $collector ]]; then
  echo "collector not deployed at $collector: merge bamware-ai#113, then update the main worktree" >&2
  exit 1
fi
exec /usr/bin/python3 "$collector" --project 2 --owner mrbam88 \
  --state-dir /home/bilal/.local/state/bamware/scrum-master
