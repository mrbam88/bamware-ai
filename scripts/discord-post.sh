#!/bin/bash
# Post a message to the Bamware Discord status channel.
#   scripts/discord-post.sh "message text"      or      echo "text" | scripts/discord-post.sh
# The webhook URL is a secret and never lives in this public repo. It is read
# from $DISCORD_WEBHOOK_STATUS or ~/.config/bamware/discord.env (chmod 600).
# See docs/discord.md.
set -euo pipefail

if [[ -z ${DISCORD_WEBHOOK_STATUS:-} && -f $HOME/.config/bamware/discord.env ]]; then
  # shellcheck disable=SC1091
  . "$HOME/.config/bamware/discord.env"
fi
if [[ -z ${DISCORD_WEBHOOK_STATUS:-} ]]; then
  echo "discord-post: no DISCORD_WEBHOOK_STATUS on this machine (see docs/discord.md)" >&2
  exit 1
fi

text=${1:-$(cat)}
# Discord's limit is 2000 characters per message.
if ((${#text} > 1990)); then
  text="${text:0:1985}…"
fi

# flags 4 = suppress link previews, so status posts stay compact.
jq -n --arg c "$text" '{username: "Bamware", content: $c, flags: 4}' |
  curl -sf -o /dev/null -H "Content-Type: application/json" -d @- "$DISCORD_WEBHOOK_STATUS"
