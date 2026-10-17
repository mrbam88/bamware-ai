#!/bin/bash
# Post a message to the Bamware Discord status channel.
#   scripts/discord-post.sh "message text"      or      echo "text" | scripts/discord-post.sh
# The webhook URL is a secret and never lives in this public repo. It is read
# from $DISCORD_WEBHOOK_STATUS or ~/.config/bamware/discord.env (chmod 600).
# See docs/discord.md.
set -euo pipefail

# Preserve caller-supplied BAMWARE_MENTION across discord.env (file must not clobber escalations).
_caller_mention_set=0
_caller_mention_val=
if [[ -n ${BAMWARE_MENTION+x} ]]; then
  _caller_mention_set=1
  _caller_mention_val=$BAMWARE_MENTION
fi
if [[ -z ${DISCORD_WEBHOOK_STATUS:-} && -f $HOME/.config/bamware/discord.env ]]; then
  # shellcheck disable=SC1091
  . "$HOME/.config/bamware/discord.env"
fi
if ((_caller_mention_set)); then
  BAMWARE_MENTION=$_caller_mention_val
fi
unset _caller_mention_set _caller_mention_val
text=${1:-$(cat)}
# BAMWARE_MENTION=1 pings Bilal, so the post pushes to his phone (CFO escalations, #132).
if [[ -n ${BAMWARE_MENTION:-} && -n ${DISCORD_USER_ID:-} ]]; then
  text="<@$DISCORD_USER_ID> $text"
fi
# Discord's limit is 2000 characters per message.
if ((${#text} > 1990)); then
  text="${text:0:1985}…"
fi

# BAMWARE_POST_TO=assistant posts as Bamware Bot in #bamware-bot, so Bilal can
# reply to it there (skills/bamware-assistant). BAMWARE_POST_TO=cfo posts in
# #cfo (DISCORD_CFO_CHANNEL), falling back to #bamware-bot until that is set.
# It uses the bot token Hermes already holds on the server; without it, or on
# failure, the webhook is used.
case ${BAMWARE_POST_TO:-} in
  assistant) channel=${DISCORD_ASSISTANT_CHANNEL:-} ;;
  cfo) channel=${DISCORD_CFO_CHANNEL:-${DISCORD_ASSISTANT_CHANNEL:-}} ;;
  *) channel= ;;
esac
if [[ -n $channel ]]; then
  bot_token=$(sed -n 's/^DISCORD_BOT_TOKEN=//p' "$HOME/.hermes/.env" 2>/dev/null | tail -1)
  if [[ -n $bot_token ]]; then
    # The header comes from a file descriptor so the token stays out of argv.
    # Keep the response: the message id is the delivery receipt (#37).
    if resp=$(jq -n --arg c "$text" '{content: $c, flags: 4}' |
      curl -sf -H @<(printf 'Authorization: Bot %s\n' "$bot_token") \
        -H "Content-Type: application/json" -d @- \
        "https://discord.com/api/v10/channels/$channel/messages"); then
      msg_id=$(jq -r .id <<<"$resp")
      echo "discord-post: posted as bot id=$msg_id channel=$channel chars=${#text}"
      # Optional one-line pointer in the status channel (#general) linking to
      # the bot post, so the briefing is findable where GitHub posts land (#37).
      if [[ -n ${BAMWARE_POINTER_TEXT:-} && -n ${DISCORD_WEBHOOK_STATUS:-} ]]; then
        guild_id=$(curl -sf -H @<(printf 'Authorization: Bot %s\n' "$bot_token") \
          "https://discord.com/api/v10/channels/$channel" | jq -r '.guild_id // empty')
        if [[ -n $guild_id ]] && presp=$(jq -n --arg c "$BAMWARE_POINTER_TEXT https://discord.com/channels/$guild_id/$channel/$msg_id" \
            '{username: "Bamware", content: $c, flags: 4}' |
          curl -sf -H "Content-Type: application/json" -d @- "${DISCORD_WEBHOOK_STATUS}?wait=true"); then
          echo "discord-post: pointer posted via webhook id=$(jq -r .id <<<"$presp") channel=$(jq -r .channel_id <<<"$presp")"
        else
          echo "discord-post: pointer post failed (briefing itself was delivered)" >&2
        fi
      fi
      exit 0
    fi
    echo "discord-post: bot post failed (channel $channel); falling back to the status webhook" >&2
  fi
fi

if [[ -z ${DISCORD_WEBHOOK_STATUS:-} ]]; then
  echo "discord-post: no DISCORD_WEBHOOK_STATUS on this machine (see docs/discord.md)" >&2
  exit 1
fi

# flags 4 = suppress link previews, so status posts stay compact.
# ?wait=true makes Discord return the created message, so the id is logged.
if resp=$(jq -n --arg c "$text" '{username: "Bamware", content: $c, flags: 4}' |
  curl -sf -H "Content-Type: application/json" -d @- "${DISCORD_WEBHOOK_STATUS}?wait=true"); then
  echo "discord-post: posted via webhook id=$(jq -r .id <<<"$resp") channel=$(jq -r .channel_id <<<"$resp") chars=${#text}"
else
  echo "discord-post: webhook post failed" >&2
  exit 1
fi
