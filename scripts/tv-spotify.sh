#!/bin/bash
# Put the Spotify app on the living-room Samsung, full screen, with the music video when the track has one.
#   tv-spotify.sh        show it (starts Spotify if needed; never changes what is playing)
#   tv-spotify.sh off    take Spotify back off full screen
# Spotify has no command for video, so the one button it needs ("Switch to video") is found by reading the
# screen (screen_find.py) and clicked. Once the large video view is open it stays for the following tracks.
# Known limit (2026-11-26): if Spotify is already in video mode but showing the video small in its side
# panel ("Switch to audio" is the label on screen), clicking that label did not respond in testing; the
# video then stays small until someone clicks it by hand once.
set -u
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/1000}
BIN=$HOME/.local/bin
win() { hyprctl clients -j | jq -r '.[] | select(.class | test("^spotify$"; "i")) | .address' | head -1; }
fs() { hyprctl dispatch "hl.dsp.window.fullscreen({ mode = \"fullscreen\", action = \"$1\", window = \"address:$(win)\" })" >/dev/null; }

if [[ ${1:-} == off ]]; then [[ -n $(win) ]] && fs unset; echo "spotify: off full screen"; exit 0; fi

"$BIN/tv-cast.sh" on >/dev/null 2>&1
tv=$(hyprctl monitors -j | jq -r '.[] | select(.description | test("Samsung")) | .name')
[[ -n $tv ]] || { echo "spotify: the TV output did not come up"; exit 1; }
ws=$(hyprctl monitors -j | jq -r --arg m "$tv" '.[] | select(.name == $m) | .activeWorkspace.id')

if [[ -z $(win) ]]; then
  hyprctl dispatch "hl.dsp.exec_cmd([[[workspace $ws silent] spotify]])" >/dev/null
  for _ in $(seq 40); do [[ -n $(win) ]] && break; sleep 0.5; done
  sleep 4   # the window exists before the app has drawn its first page
fi
[[ -n $(win) ]] || { echo "spotify: the app did not start"; exit 1; }
hyprctl dispatch "hl.dsp.window.move({ workspace = \"$ws\", follow = false, window = \"address:$(win)\" })" >/dev/null 2>&1

# Remember where the pointer and the keyboard were: the click below must not leave either on the TV.
read -r px py < <(hyprctl cursorpos | tr -d ,)
back=$(hyprctl activewindow -j | jq -r '.address // empty')
note="no video button on screen (no video for this track, or it is already showing)"
fs unset; sleep 1.2      # clicks only register while the window is not full screen
if pos=$(python3 "$BIN/screen_find.py" "$tv" switch to video); then
  read -r x y <<<"$pos"
  hyprctl dispatch "hl.dsp.cursor.move({ x = $x, y = $y })" >/dev/null; sleep 0.4
  hyprctl dispatch 'hl.dsp.send_key_state({ mods = "", key = "mouse:272", state = "down" })' >/dev/null
  hyprctl dispatch 'hl.dsp.send_key_state({ mods = "", key = "mouse:272", state = "up" })' >/dev/null
  sleep 2.5
  note="video opened large"
fi
fs set
tvx=$(hyprctl monitors -j | jq -r --arg m "$tv" '.[] | select(.name == $m) | .x')
(( px >= tvx )) && { px=$(( tvx / 2 )); py=480; }
hyprctl dispatch "hl.dsp.cursor.move({ x = $px, y = $py })" >/dev/null
[[ -n $back ]] && hyprctl dispatch "hl.dsp.focus({ window = \"address:$back\" })" >/dev/null
# Spotify raises itself when a playlist starts, a moment after this script is done. Check again and take
# the keyboard back, so typing never lands on the TV window.
if [[ -n $back && $back != "$(win)" ]]; then
  for _ in 1 2 3; do
    sleep 2
    [[ $(hyprctl activewindow -j | jq -r '.address // empty') == "$(win)" ]] || continue
    hyprctl dispatch "hl.dsp.cursor.move({ x = $px, y = $py })" >/dev/null
    hyprctl dispatch "hl.dsp.focus({ window = \"address:$back\" })" >/dev/null
  done
fi
echo "spotify: full screen on the TV; $note"
