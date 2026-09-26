#!/bin/bash
# Post Discord reminders for docs/deadlines.md (#38).
#   scripts/discord-deadlines.sh [--dry-run]
# Reminds once in each window (7-4, 3-2, 1 day(s) before, the day itself) and
# once when overdue. Each
# reminder posts once (state in ~/.local/state/bamware/deadlines-sent), so
# running it several times a day is safe.
set -uo pipefail
export BAMWARE_POST_TO=${BAMWARE_POST_TO:-assistant}   # #bamware-bot, see discord-post.sh

dry_run=${1:-}
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
state_file="${XDG_STATE_HOME:-$HOME/.local/state}/bamware/deadlines-sent"
mkdir -p "$(dirname "$state_file")" && touch "$state_file"
[[ -f $HOME/.config/bamware/discord.env ]] && . "$HOME/.config/bamware/discord.env"
mention=${DISCORD_USER_ID:+<@$DISCORD_USER_ID> }
today=$(date +%F)

grep -E '^\| [0-9]{4}-[0-9]{2}-[0-9]{2} \|' "$repo_dir/docs/deadlines.md" |
  while IFS='|' read -r _ date what link _; do
    date=$(xargs <<<"$date"); what=$(sed 's/^ *//; s/ *$//' <<<"$what"); link=$(sed 's/^ *//; s/ *$//' <<<"$link")
    days=$(( ($(date -d "$date" +%s) - $(date -d "$today" +%s)) / 86400 ))
    # Bucket = the nearest reminder point at or after today, so a missed run
    # (server off, first run) still reminds once per window.
    if ((days < 0)); then when="**overdue** (was $date)"; bucket=overdue
    elif ((days == 0)); then when="**today**"; bucket=0
    elif ((days <= 7)); then
      when="in **$days day$([[ $days == 1 ]] || echo s)** ($date)"
      if ((days == 1)); then bucket=1; elif ((days <= 3)); then bucket=3; else bucket=7; fi
    else continue; fi
    key="$date|$what|$bucket"
    grep -qxF "$key" "$state_file" && continue
    msg="⏰ ${mention}Deadline $when: $what${link:+ — $link}"
    if [[ $dry_run == --dry-run ]]; then
      echo "$msg"
    else
      "$repo_dir/scripts/discord-post.sh" "$msg" && echo "$key" >>"$state_file"
    fi
  done
