#!/bin/bash
# Put the Spotify app on the living-room Samsung, ready for party_stage.py to show videos full screen.
#   tv-spotify.sh        cast on, Spotify on the TV with its developer port (never changes what is playing)
#   tv-spotify.sh off    leave full screen
# Spotify has no command for video and ignores simulated clicks on its video buttons (2026-11-26), so the
# app is driven through its Chromium developer port instead. The port listens on 127.0.0.1 only; anything
# running as Bilal on this machine can use it to control the Spotify window, nothing off the machine can.
# Spotify only opens the port when started with the flag, so an instance started from the launcher is
# restarted once (a few seconds of silence, then the same track resumes).
set -u
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/1000}
BIN=$HOME/.local/bin
PORT=9222
M="busctl --user"; D=org.mpris.MediaPlayer2.spotify; O=/org/mpris/MediaPlayer2; I=org.mpris.MediaPlayer2.Player
win() { hyprctl clients -j | jq -r '.[] | select(.class | test("^spotify$"; "i")) | .address' | head -1; }
port_open() { curl -s -m 2 "http://127.0.0.1:$PORT/json" 2>/dev/null | grep -q spotify; }

if [[ ${1:-} == off ]]; then
  [[ -n $(win) ]] && hyprctl dispatch "hl.dsp.window.fullscreen({ mode = \"fullscreen\", action = \"unset\", window = \"address:$(win)\" })" >/dev/null
  echo "spotify: off full screen"; exit 0
fi

"$BIN/tv-cast.sh" on >/dev/null 2>&1
tv=$(hyprctl monitors -j | jq -r '.[] | select(.description | test("Samsung")) | .name')
[[ -n $tv ]] || { echo "spotify: the TV output did not come up"; exit 1; }
ws=$(hyprctl monitors -j | jq -r --arg m "$tv" '.[] | select(.name == $m) | .activeWorkspace.id')
back=$(hyprctl activewindow -j | jq -r '.address // empty')

if ! port_open; then
  was=$($M get-property $D $O $I PlaybackStatus 2>/dev/null)
  pkill -x spotify; for _ in $(seq 20); do pgrep -x spotify >/dev/null || break; sleep 0.3; done; sleep 1
  hyprctl dispatch "hl.dsp.exec_cmd([[[workspace $ws silent] spotify --remote-debugging-port=$PORT --remote-allow-origins=http://127.0.0.1:$PORT]])" >/dev/null
  for _ in $(seq 40); do port_open && break; sleep 0.5; done
  sleep 4      # the page exists before the player inside it is ready
  [[ $was == *Playing* ]] && $M call $D $O $I Play >/dev/null 2>&1
fi
port_open || { echo "spotify: the app did not come up with its developer port"; exit 1; }
hyprctl dispatch "hl.dsp.window.move({ workspace = \"$ws\", follow = false, window = \"address:$(win)\" })" >/dev/null 2>&1
[[ -n $back && $back != "$(win)" ]] && hyprctl dispatch "hl.dsp.focus({ window = \"address:$back\" })" >/dev/null
echo "spotify: on the TV, developer port open"
