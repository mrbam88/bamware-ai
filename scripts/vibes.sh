#!/bin/bash
# Daily vibes for Bilal's apartment, run on omarchy: vibes.sh morning|afternoon|evening
# Lights (Govee LAN + cloud), stereo (Spotify over MPRIS), screen (Samsung + Apple TV).
export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
PY=~/.venvs/smarthome/bin/python; LAN="python3 $HOME/.local/bin/govee_lan.py"
. ~/.config/bamware/govee.env
API=https://openapi.api.govee.com/router/api/v1; H=(-H "Govee-API-Key: $GOVEE_API_KEY" -H "Content-Type: application/json")
LAMP=40:F9:DA:C3:41:06:03:53; TVB=1C:CF:D4:0F:40:46:18:6A
cloud() { curl -s "${H[@]}" -X POST $API/device/control -d "{\"requestId\":\"v\",\"payload\":{\"sku\":\"$1\",\"device\":\"$2\",\"capability\":{\"type\":\"$3\",\"instance\":\"$4\",\"value\":$5}}}" >/dev/null; }
scene() { v=$(curl -s "${H[@]}" -X POST $API/device/scenes -d "{\"requestId\":\"q\",\"payload\":{\"sku\":\"$1\",\"device\":\"$2\"}}" | jq -c --arg n "$3" '.payload.capabilities[0].parameters.options[] | select(.name==$n) | .value' | head -1); [[ -n $v ]] && cloud $1 $2 devices.capabilities.dynamic_scene lightScene "$v"; }
spotify() { P="busctl --user"; D=org.mpris.MediaPlayer2.spotify; O=/org/mpris/MediaPlayer2; I=org.mpris.MediaPlayer2.Player; $P call $D $O $I OpenUri s "$1" 2>/dev/null; sleep 3; $P set-property $D $O $I Shuffle b true 2>/dev/null; wpctl set-volume @DEFAULT_AUDIO_SINK@ "$2" 2>/dev/null; }
tv_youtube() { # $1 = youtube page/channel url -> resolve current video id, deep link into the Apple TV YouTube app
  $PY ~/.local/bin/samsung_tv.py wake >/dev/null 2>&1; $PY ~/.local/bin/appletv.py key turn_on >/dev/null 2>&1; sleep 5
  id=$(~/.venvs/smarthome/bin/yt-dlp --no-warnings --flat-playlist --playlist-items 1 --get-id "$1" 2>/dev/null | head -1)
  [[ -n $id ]] || { echo "no video id for $1"; return 1; }
  $PY ~/.local/bin/appletv.py app "youtube://www.youtube.com/watch?v=$id" >/dev/null 2>&1; sleep 8; $PY ~/.local/bin/appletv.py key select >/dev/null 2>&1; sleep 6
  $PY ~/.local/bin/appletv.py status 2>&1 | tail -1
}
[[ $(cat ~/.local/state/bamware/presence.state 2>/dev/null) == away ]] && { echo "$(date "+%F %T") vibes $1 skipped: away"; exit 0; }
case ${1:-} in
  morning)   # sunrise over ~6 min, then news
    $LAN on all >/dev/null; $LAN kelvin all 2700 >/dev/null
    cloud H60B0 $LAMP devices.capabilities.toggle rippleLightToggle 1; cloud H60B0 $LAMP devices.capabilities.toggle bottomLightToggle 1; cloud H60B0 $LAMP devices.capabilities.toggle sideLightToggle 1
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 0
    spotify "spotify:playlist:37i9dQZF1DX4sWSpwq3LiO" 0.45   # Peaceful Piano
    for b in 5 15 30 50 70 85; do $LAN bright uplighter $b >/dev/null; $LAN bright strip $((b/2+5)) >/dev/null; $LAN bright "smart led bulb" $((b/3+3)) >/dev/null; $LAN bright "bulb top" $((b/3+3)) >/dev/null; sleep 60; done
    $LAN kelvin all 4000 >/dev/null
    for u in "https://www.youtube.com/@markets/live" "https://www.youtube.com/@CNBC/live" "https://www.youtube.com/@NBCNews/live"; do tv_youtube "$u" && break; done ;;
  afternoon) # bright, focused, game in the background
    $LAN on all >/dev/null; $LAN kelvin all 4500 >/dev/null; $LAN bright uplighter 100 >/dev/null; $LAN bright strip 70 >/dev/null; $LAN bright "smart led bulb" 40 >/dev/null; $LAN bright "bulb top" 40 >/dev/null
    cloud H60B0 $LAMP devices.capabilities.toggle rippleLightToggle 1; cloud H60B0 $LAMP devices.capabilities.toggle bottomLightToggle 1
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 0
    spotify "spotify:playlist:37i9dQZF1DWWQRwui0ExPn" 0.70   # lo-fi beats
    tv_youtube "https://www.youtube.com/@NBA/videos" ;;
  evening)   # wind down: candlelight, jazz
    $LAN on all >/dev/null
    $LAN color strip 255,60,90 >/dev/null; $LAN bright strip 3 >/dev/null
    $LAN color "smart led bulb" 255,70,0 >/dev/null; $LAN bright "smart led bulb" 1 >/dev/null; $LAN color "bulb top" 255,70,0 >/dev/null; $LAN bright "bulb top" 1 >/dev/null
    cloud H60B0 $LAMP devices.capabilities.toggle sideLightToggle 0; cloud H60B0 $LAMP devices.capabilities.toggle bottomLightToggle 1; cloud H60B0 $LAMP devices.capabilities.toggle rippleLightToggle 1
    cloud H60B0 $LAMP devices.capabilities.range brightness 55; sleep 1; scene H60B0 $LAMP Candlelight
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 1; cloud H6099 $TVB devices.capabilities.range brightness 12; sleep 1; scene H6099 $TVB Candlelight
    spotify "spotify:playlist:37i9dQZF1DX4wta20PHgwo" 0.65   # Late Night Jazz
    ;;
  cleaning)  # "cleaning lights" (Bilal 2026-10-29): everything 100%, cool white, no music or screen change
    $LAN on all >/dev/null; $LAN kelvin all 5000 >/dev/null; $LAN bright all 100 >/dev/null
    cloud H60B0 $LAMP devices.capabilities.toggle sideLightToggle 1; cloud H60B0 $LAMP devices.capabilities.toggle bottomLightToggle 1; cloud H60B0 $LAMP devices.capabilities.toggle rippleLightToggle 0
    cloud H60B0 $LAMP devices.capabilities.range brightness 100
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 1; cloud H6099 $TVB devices.capabilities.color_setting colorTemperatureK 5000; cloud H6099 $TVB devices.capabilities.range brightness 100
    touch ~/.local/state/bamware/lights.hold   # keep daylight.timer from dimming it for 3 h
    echo "cleaning lights: every light 100% at 5000K; say 'done cleaning' for daylight.py or vibes.sh evening" ;;
  *) echo "usage: vibes.sh morning|afternoon|evening|cleaning"; exit 1;;
esac
echo "$(date '+%F %T') vibes $1 done"
