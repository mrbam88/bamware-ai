#!/bin/bash
# Daily Notion newspaper (Bilal's 8 AM brief) without the retired Hermes gateway.
#
# The brief is still the Hermes cron job 60b2d26bc926 (Grok on the xAI
# subscription, $0 marginal) and its private runbook in
# ~/.local/state/bamware/daily-newspaper/RUNBOOK.md. The gateway that used to
# tick the Hermes scheduler was stopped on 2026-10-20 (ADR 0002, #197), so this
# script, run by bamware-daily-brief.timer, does the tick instead and delivers
# ONLY what the publisher's verified receipt proves. The model's own "done"
# text is never trusted: on 2026-10-21 it reported yesterday's page as today's.
#
# Idempotent per day: once today's receipt is posted it only ticks the
# scheduler (which also runs the Interview Tracker job every 2 h).
set -euo pipefail

JOB=60b2d26bc926
STATE=$HOME/.local/state/bamware/daily-newspaper
today=$(TZ=America/New_York date +%F)
hour=$(TZ=America/New_York date +%H)
receipt=$STATE/$today.json
posted=$STATE/$today.posted
alerted=$STATE/$today.alerted
mkdir -p "$STATE"

verified() {
  [[ -f $receipt ]] && jq -e --arg d "$today" \
    '.verified == true and .date == $d and (.url | startswith("https://"))' \
    "$receipt" >/dev/null 2>&1
}

post() { # bot post in #chief-of-staff; token never touches argv
  # shellcheck disable=SC1091
  . "$HOME/.config/bamware/discord.env"
  jq -n --arg c "$1" '{content: $c, flags: 4}' |
    curl -sf -H @<(printf 'Authorization: Bot %s\n' "$DISCORD_BOT_TOKEN") \
      -H "Content-Type: application/json" -d @- \
      "https://discord.com/api/v10/channels/$DISCORD_HOME_CHANNEL/messages" |
    jq -r '"daily-brief: posted id=\(.id)"'
}

if ! verified && (( 10#$hour < 12 )); then
  hermes cron run "$JOB" >/dev/null   # due on the next tick
fi
# Runs every due Hermes job in the foreground; output lands in ~/.hermes/cron/output.
timeout 20m hermes cron tick || echo "daily-brief: hermes cron tick exit $?" >&2

if verified; then
  if [[ ! -e $posted ]]; then
    url=$(jq -r .url "$receipt")
    out=$(ls -t "$HOME/.hermes/cron/output/$JOB/${today}_"*.md 2>/dev/null | head -1 || true)
    summary=""
    if [[ -n $out ]]; then
      # The model's closing lines minus any link it claims (the receipt's link wins).
      summary=$(sed -n '/^## Response/,$p' "$out" | tail -n +2 | grep -v 'notion\.\(com\|so\)' | grep -v '^\s*$' | head -6 || true)
    fi
    post "🗞️ Daily newspaper $(TZ=America/New_York date +%-m/%-d): $url"$'\n'"$summary"
    touch "$posted"
  fi
  exit 0
fi

if (( 10#$hour >= 8 )) && [[ ! -e $alerted ]]; then
  post "⚠️ Today's Notion daily newspaper did not publish (no verified receipt for $today). Log: journalctl --user -u bamware-daily-brief"
  touch "$alerted"
fi
echo "daily-brief: no verified receipt for $today" >&2
exit 1
