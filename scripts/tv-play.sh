#!/bin/bash
# Play a YouTube video on the Samsung from this server at the best quality the video has, up to 4K.
# mpv fetches the stream itself, so there is no browser page, no quality guessing and nothing to click.
#   tv-play.sh <video id or URL>      tv-play.sh stop
set -u
log=$HOME/.local/state/bamware/tv-play.log
if [[ ${1:-} == stop ]]; then pkill -x mpv; pkill -f tv-player-profile; echo "stopped"; exit 0; fi
url=$1; [[ $url == http* ]] || url="https://www.youtube.com/watch?v=$url"
tv=$(hyprctl monitors -j | jq -r '.[] | select(.description | test("Samsung")) | .name')
[[ -n $tv ]] || { echo "TV output is off: run tv-cast.sh on"; exit 1; }
python3 ~/.local/bin/samsung_tv.py source pc
ws=$(hyprctl monitors -j | jq -r --arg m "$tv" '.[] | select(.name == $m) | .activeWorkspace.id')
pkill -x mpv 2>/dev/null; pkill -f tv-player-profile 2>/dev/null; sleep 1
: >"$log"
# The format string has shell and Lua metacharacters, so the command lives in a file and Hyprland runs the file.
run=${XDG_RUNTIME_DIR:-/tmp}/bamware-tv-play.run
printf '#!/bin/bash\nexec mpv --fs --fs-screen-name=%q --wayland-app-id=bamware-tv-player --no-terminal --log-file=%q --hwdec=auto-safe --volume=100 --ytdl-format=%q --script-opts=ytdl_hook-ytdl_path=%q %q\n' \
  "$tv" "$log" 'bestvideo[height<=2160]+bestaudio/best' "$HOME/.venvs/smarthome/bin/yt-dlp" "$url" >"$run"
chmod 700 "$run"
hyprctl dispatch "hl.dsp.exec_cmd([[[workspace $ws silent] $run]])" >/dev/null
# Wait for the first decoded frame, then report what is really on screen.
for _ in $(seq 40); do grep -q "VO: \[" "$log" 2>/dev/null && break; sleep 0.5; done
grep -m1 -oE "VO: \[[a-z-]+\] [0-9]+x[0-9]+" "$log" || { echo "no picture yet; last log lines:"; tail -3 "$log"; exit 1; }
grep -m1 -oE "Video +--vid=1.*" "$log" | cut -c1-90
grep -m1 -oE "Using hardware decoding \([a-z0-9-]+\)" "$log" || echo "decoding in software"
