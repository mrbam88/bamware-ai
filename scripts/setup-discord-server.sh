#!/bin/bash
# One-time setup of the always-on Discord pieces on the `omarchy` server.
#   scripts/setup-discord-server.sh <discord-user-id|username> <bot-channel-id> [--no-bot]
# A username works for the bot (Hermes resolves it on connect); @mentions in
# deadline reminders need the numeric ID, so they stay off until one is given.
# Run it ON the server, in a terminal (it may prompt). Safe to re-run.
#
# 1. Linger, so user services keep running with nobody logged in.
# 2. DISCORD_USER_ID in discord.env, so deadline reminders @mention Bilal.
# 3. The morning/evening digest timers (moved off the ThinkPad).
# 4. The Hermes Discord gateway (two-way bot). Optional: skip with --no-bot.
#
# Before running: scripts/secrets-pull.sh (writes discord.env), the ThinkPad
# timers disabled and deadlines-sent copied over. For the bot also:
# `hermes model` login and the Bamware Hermes integration applied (see
# docs/discord.md, "Server setup").
set -euo pipefail

uid=${1:?usage: setup-discord-server.sh <discord-user-id> <bot-channel-id> [--no-bot]}
chan=${2:?usage: setup-discord-server.sh <discord-user-id> <bot-channel-id> [--no-bot]}
no_bot=${3:-}
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
bam_env=$HOME/.config/bamware/discord.env
say() { printf '\033[1;36m[discord]\033[0m %s\n' "$1"; }

# set_key FILE KEY VALUE: replace KEY's line or append it. Never prints values.
set_key() {
  touch "$1" && chmod 600 "$1"
  if grep -q "^$2=" "$1"; then sed -i "s|^$2=.*|$2=$3|" "$1"; else echo "$2=$3" >>"$1"; fi
}

# --- 1. linger --------------------------------------------------------------
if [[ $(loginctl show-user "$USER" -p Linger --value) != yes ]]; then
  loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER"
fi
say "linger: $(loginctl show-user "$USER" -p Linger --value)"

# --- 2. webhook + @mention --------------------------------------------------
[[ -f $bam_env ]] || { echo "no $bam_env: run scripts/secrets-pull.sh first" >&2; exit 1; }
grep -q '^DISCORD_WEBHOOK_STATUS=.' "$bam_env" || { echo "no webhook in $bam_env" >&2; exit 1; }
if [[ $uid =~ ^[0-9]+$ ]]; then
  set_key "$bam_env" DISCORD_USER_ID "$uid"
  say "discord.env: webhook present, DISCORD_USER_ID set"
else
  say "discord.env: webhook present; @mentions off until run with the numeric user ID"
fi

# --- 3. digest timers -------------------------------------------------------
[[ -s ${XDG_STATE_HOME:-$HOME/.local/state}/bamware/deadlines-sent ]] ||
  say "warning: no deadlines-sent state here; reminders already sent from the ThinkPad will repeat"
mkdir -p "$HOME/.config/systemd/user"
cp "$repo_dir"/scripts/systemd/bamware-digest-{morning,evening}.{service,timer} "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now bamware-digest-{morning,evening}.timer
say "timers enabled:"
systemctl --user list-timers 'bamware-*' --no-pager | sed -n '1,3p'

[[ $no_bot == --no-bot ]] && { say "skipping the Hermes bot (--no-bot)"; exit 0; }

# --- 4. Hermes Discord gateway ----------------------------------------------
herm_env=$HOME/.hermes/.env
if ! grep -q '^DISCORD_BOT_TOKEN=.' "$herm_env" 2>/dev/null; then
  read -rsp 'Paste the Discord bot token (not echoed): ' token; echo
  set_key "$herm_env" DISCORD_BOT_TOKEN "$token"; unset token
fi
set_key "$herm_env" DISCORD_ALLOWED_USERS "$uid"
set_key "$herm_env" DISCORD_HOME_CHANNEL "$chan"
set_key "$herm_env" DISCORD_HOME_CHANNEL_NAME bamware-bot
set_key "$herm_env" DISCORD_FREE_RESPONSE_CHANNELS "$chan"
say "hermes .env: token, allowed user and #bamware-bot set"

hermes gateway install --force --start-now --start-on-login
hermes gateway status
say "done. Test in #bamware-bot: \"what's blocked on me?\" and \"new idea: ...\""
