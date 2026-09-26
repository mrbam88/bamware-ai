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
text=${1:-$(cat)}
# Discord's limit is 2000 characters per message.
if ((${#text} > 1990)); then
  text="${text:0:1985}…"
fi

# BAMWARE_POST_TO=assistant posts as Bamware Bot in #bamware-bot, so Bilal can
# reply to it there (skills/bamware-assistant). It uses the bot token Hermes
# already holds on the server; without it, or on failure, the webhook is used.
if [[ ${BAMWARE_POST_TO:-} == assistant && -n ${DISCORD_ASSISTANT_CHANNEL:-} ]]; then
  bot_token=$(sed -n 's/^DISCORD_BOT_TOKEN=//p' "$HOME/.hermes/.env" 2>/dev/null | tail -1)
  if [[ -n $bot_token ]]; then
    # The header comes from a file descriptor so the token stays out of argv.
    if jq -n --arg c "$text" '{content: $c, flags: 4}' |
      curl -sf -o /dev/null -H @<(printf 'Authorization: Bot %s\n' "$bot_token") \
        -H "Content-Type: application/json" -d @- \
        "https://discord.com/api/v10/channels/$DISCORD_ASSISTANT_CHANNEL/messages"; then
      exit 0
    fi
    echo "discord-post: bot post failed; falling back to the status webhook" >&2
  fi
fi

if [[ -z ${DISCORD_WEBHOOK_STATUS:-} ]]; then
  echo "discord-post: no DISCORD_WEBHOOK_STATUS on this machine (see docs/discord.md)" >&2
  exit 1
fi

# flags 4 = suppress link previews, so status posts stay compact.
jq -n --arg c "$text" '{username: "Bamware", content: $c, flags: 4}' |
  curl -sf -o /dev/null -H "Content-Type: application/json" -d @- "$DISCORD_WEBHOOK_STATUS"
