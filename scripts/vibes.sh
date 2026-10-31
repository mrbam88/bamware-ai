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
snapshot() { # $1 sku $2 device $3 snapshot name saved in the Govee app -> recall it; prints 1 if found (the only way to set the lamp's ring level)
  # loose match: the app keeps whatever he typed ("Focus bright " with a trailing space, 2026-10-30), so compare lowercased and trimmed
  v=$(curl -s "${H[@]}" $API/user/devices | jq -c --arg d "$2" --arg n "$(echo "$3" | tr "[:upper:]" "[:lower:]" | xargs)" '.data[] | select(.device==$d) | .capabilities[] | select(.instance=="snapshot") | .parameters.options[] | select((.name | ascii_downcase | gsub("^\\s+|\\s+$"; "")) == $n) | .value' | head -1)
  [[ -n $v ]] && { cloud $1 $2 devices.capabilities.dynamic_scene snapshot "$v"; echo 1; } || echo 0; }
lamp_top() { # ripple on the ceiling + bottom ring, disc off (two of three); args = snapshot names to try in order (a snapshot also sets the ring level)
  for n in "$@"; do [[ $(snapshot H60B0 $LAMP "$n") == 1 ]] && return; done
  cloud H60B0 $LAMP devices.capabilities.toggle sideLightToggle 0; sleep 1; cloud H60B0 $LAMP devices.capabilities.toggle bottomLightToggle 1; sleep 1; cloud H60B0 $LAMP devices.capabilities.toggle rippleLightToggle 1; }
spotify() { ( P="busctl --user"; D=org.mpris.MediaPlayer2.spotify; O=/org/mpris/MediaPlayer2; I=org.mpris.MediaPlayer2.Player; $P call $D $O $I OpenUri s "$1" 2>/dev/null; sleep 3; $P set-property $D $O $I Shuffle b true 2>/dev/null; wpctl set-volume @DEFAULT_AUDIO_SINK@ "$2" 2>/dev/null ) >/dev/null 2>&1 & }   # backgrounded 2026-10-29: the button should not wait on Spotify
LOGD=~/.local/state/bamware
tv_youtube() { # $1 = youtube page/channel url -> resolve current video id, deep link into the Apple TV YouTube app
  $PY ~/.local/bin/appletv.py key turn_on >/dev/null 2>&1; $PY ~/.local/bin/samsung_tv.py appletv >/dev/null 2>&1   # wake the panel AND land on the Apple TV input (2026-10-30: it woke on Live TV)
  id=$(~/.venvs/smarthome/bin/yt-dlp --no-warnings --flat-playlist --playlist-items 1 --get-id "$1" 2>/dev/null | head -1)
  [[ -n $id ]] || { echo "no video id for $1"; return 1; }
  $PY ~/.local/bin/appletv.py app "youtube://www.youtube.com/watch?v=$id" >/dev/null 2>&1; sleep 8; $PY ~/.local/bin/appletv.py key select >/dev/null 2>&1; sleep 6
  $PY ~/.local/bin/appletv.py status 2>&1 | tail -1
}
PARTY_PID=~/.local/state/bamware/party.pid
party_stop() { [[ -f $PARTY_PID ]] && { kill $(cat $PARTY_PID) 2>/dev/null; rm -f $PARTY_PID; }; }
party_loop() { # party (Bilal 2026-10-31): warm party colours rotate across the room every few seconds for up to 3 h. Each device is one step out of phase so the room is never one colour.
  # hot pink, orange, gold, candle red, fuchsia. No blue (alerts only), no green next to red (he is red-green colorblind). The TV wall is cloud-only, so it moves every other step.
  local C=(255,20,110 255,110,0 255,200,0 255,0,60 230,40,160) n=5 i=0 end=$(( $(date +%s) + 10800 ))
  while (( $(date +%s) < end )); do
    $LAN color "smart led bulb" ${C[i%n]}; $LAN color "bulb top" ${C[(i+1)%n]}; $LAN color strip ${C[(i+2)%n]}; $LAN color uplighter ${C[(i+3)%n]}
    (( i % 2 == 0 )) && { IFS=, read -r r g b <<< "${C[(i+4)%n]}"; cloud H6099 $TVB devices.capabilities.color_setting colorRgb $(( (r<<16)+(g<<8)+b )); }
    sleep 4; i=$((i+1))
  done; rm -f $PARTY_PID; }
[[ ${1:-} == party-stop ]] && { party_stop; echo "party loop stopped"; exit 0; }   # buttons call this before any plain light command; works while away too
[[ $(cat ~/.local/state/bamware/presence.state 2>/dev/null) == away ]] && { echo "$(date "+%F %T") vibes $1 skipped: away"; exit 0; }
# a manual scene (cleaning, or any agent that touched lights.hold) wins over the schedule for 3 h (2026-10-29: the 19:30 run clobbered cleaning lights)
HOLD=~/.local/state/bamware/lights.hold
if [[ ${1:-} =~ ^(morning|afternoon|evening)$ && -f $HOLD && $(( $(date +%s) - $(stat -c %Y $HOLD) )) -lt 10800 && ${2:-} != --force && ${2:-} != --now ]]; then echo "$(date "+%F %T") vibes $1 skipped: lights.hold is fresh (vibes.sh $1 --force to override)"; exit 0; fi
party_stop   # any scene replaces the party colour loop
case ${1:-} in
  morning)   # Bilal 2026-10-29 v2: "mimic the sun" on gloomy mornings. Light from the ceiling and the kitchen, warm, nothing at eye level.
    STEP=60; [[ ${2:-} == --now ]] && STEP=1                 # the 08:00 timer ramps over ~6 min; the button does it at once
    $LAN on all >/dev/null
    $LAN color "smart led bulb" amber >/dev/null; $LAN bright "smart led bulb" 1 >/dev/null   # desk bulbs stay at eye level: 1%
    lamp_top "Morning Bright" "Focus Bright" "Low light chill both"                          # his app snapshot "Morning Bright" (2026-10-30), else the work look, else toggles
    # TV wall: vibrant sunrise, bright
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 1; cloud H6099 $TVB devices.capabilities.color_setting colorRgb $(( (255<<16)+(120<<8)+20 )); cloud H6099 $TVB devices.capabilities.range brightness 100
    spotify "spotify:playlist:37i9dQZF1DX7KNKjOK0o75" 0.55   # Have a Great Day! (upbeat, fun, inspiring)
    # kitchen strip: warm sunrise ramp 2700K -> 3000K up to 100% for cooking
    $LAN kelvin strip 2700 >/dev/null
    for b in 10 30 55 80 100; do $LAN bright strip $b >/dev/null; sleep $STEP; done
    $LAN kelvin strip 3000 >/dev/null
    touch ~/.local/state/bamware/lights.hold
    ( for u in "https://www.youtube.com/@markets/live" "https://www.youtube.com/@CNBC/live" "https://www.youtube.com/@NBCNews/live"; do tv_youtube "$u" && break; done ) >> $LOGD/vibes-tv.log 2>&1 &
    echo "morning: lights up, piano on, news starting on the TV (about 30 s)" ;;
  work)      # study / focus (Bilal 2026-10-29 v2): light near the ceiling, nothing at eye level. "I don't want to be blinded when I'm looking at my monitors."
    $LAN on all >/dev/null
    $LAN color "smart led bulb" amber >/dev/null; $LAN bright "smart led bulb" 1 >/dev/null   # both desk bulbs, eye level: 1%
    $LAN color strip amber >/dev/null; $LAN bright strip 1 >/dev/null                          # under-cabinet strip: 1%
    # lamp: ripple 100% + faint ring, disc off. The API has one dimmer for both, but the APP can set the ring alone and a
    # snapshot keeps it: recall "Work" if he saved one, else his "Low light chill both" (2026-10-30: "this is what I wanted")
    lamp_top "Focus Bright" "Work" "Low light chill both"   # his snapshot "Focus Bright" (2026-10-30): ripple 100%, ring ~1%, disc off
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 0
    ~/.local/bin/roomlevel.sh mute 180 >/dev/null
    touch ~/.local/state/bamware/lights.hold
    spotify "spotify:playlist:37i9dQZF1DWZeKCadgRdKQ" 0.50   # Deep Focus ("perfect")
    echo "work mode: ceiling ripple, desk bulbs 1%, strip 1%, TV wall off, Deep Focus 50%, mic alert muted 3 h" ;;
  afternoon) # bright, focused, game in the background
    $LAN on all >/dev/null; $LAN kelvin all 4500 >/dev/null; $LAN bright uplighter 100 >/dev/null; $LAN bright strip 70 >/dev/null; $LAN bright "smart led bulb" 40 >/dev/null; $LAN bright "bulb top" 40 >/dev/null
    cloud H60B0 $LAMP devices.capabilities.toggle rippleLightToggle 1; cloud H60B0 $LAMP devices.capabilities.toggle bottomLightToggle 1
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 0
    spotify "spotify:playlist:37i9dQZF1DWWQRwui0ExPn" 0.70   # lo-fi beats
    tv_youtube "https://www.youtube.com/@NBA/videos" >> $LOGD/vibes-tv.log 2>&1 &
    echo "afternoon: lights bright, lo-fi on, NBA starting on the TV" ;;
  evening)   # wind down: candlelight, jazz
    $LAN on all >/dev/null
    $LAN color strip 255,60,90 >/dev/null; $LAN bright strip 3 >/dev/null
    $LAN color "smart led bulb" 255,70,0 >/dev/null; $LAN bright "smart led bulb" 1 >/dev/null; $LAN color "bulb top" 255,70,0 >/dev/null; $LAN bright "bulb top" 1 >/dev/null
    cloud H60B0 $LAMP devices.capabilities.toggle sideLightToggle 0; cloud H60B0 $LAMP devices.capabilities.toggle bottomLightToggle 1; cloud H60B0 $LAMP devices.capabilities.toggle rippleLightToggle 1
    cloud H60B0 $LAMP devices.capabilities.range brightness 55; sleep 1; scene H60B0 $LAMP Candlelight
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 1; cloud H6099 $TVB devices.capabilities.range brightness 12; sleep 1; scene H6099 $TVB Candlelight
    spotify "spotify:playlist:37i9dQZF1DX4wta20PHgwo" 0.65   # Late Night Jazz
    ;;
  cleaning)  # "cleaning lights" (Bilal 2026-10-29): everything 100%, cool white, bottom-heavy lamp; no music or screen change
    $LAN on all >/dev/null; $LAN kelvin all 5000 >/dev/null; $LAN bright all 100 >/dev/null
    # lamp, Bilal's cleaning look (photo 2026-10-29 22:48): bottom ring (level set in the app) + ripple on the ceiling, disc off; the lamp runs at most two of three
    [[ $(snapshot H60B0 $LAMP "Cleaning") == 1 || $(snapshot H60B0 $LAMP "Clean") == 1 ]] || { cloud H60B0 $LAMP devices.capabilities.toggle sideLightToggle 0; sleep 2; cloud H60B0 $LAMP devices.capabilities.toggle rippleLightToggle 1; sleep 2; cloud H60B0 $LAMP devices.capabilities.toggle bottomLightToggle 1; }   # app snapshot "Clean" (ring 100%) wins when he has saved it
    # TV wall: 5000K photographs lavender on the H6099 (no blue, ever), so warm white by RGB instead
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 1; cloud H6099 $TVB devices.capabilities.color_setting colorRgb $(( (255<<16)+(235<<8)+205 )); cloud H6099 $TVB devices.capabilities.range brightness 100
    touch ~/.local/state/bamware/lights.hold   # scheduled vibes and daylight.timer skip while this is under 3 h old
    spotify "spotify:playlist:37i9dQZF1DX186v583rmzp" 0.75   # I Love My '90s Hip-Hop (Bilal 2026-10-29: "Make the 90s hip-hop the cleaning music!")
    echo "cleaning mode: every light full, lamp bottom + ripple, 90s hip-hop at 75%; Evening button or 'vibes.sh evening --force' when done" ;;
  party)     # party lights (Bilal 2026-10-31, Halloween): cleaning brightness, but warm party colours that keep moving; Dance Party on the stereo
    $LAN on all >/dev/null; $LAN bright all 100 >/dev/null
    # lamp: coloured disc + bottom ring, ripple off (two of three; the one sent last wins). "Cleaning" snapshot = ring 100% + disc 100%, then the loop colours the disc over the LAN.
    [[ $(snapshot H60B0 $LAMP "Cleaning") == 1 || $(snapshot H60B0 $LAMP "Clean") == 1 ]] || { cloud H60B0 $LAMP devices.capabilities.toggle rippleLightToggle 0; sleep 2; cloud H60B0 $LAMP devices.capabilities.toggle sideLightToggle 1; sleep 2; cloud H60B0 $LAMP devices.capabilities.toggle bottomLightToggle 1; }
    cloud H6099 $TVB devices.capabilities.on_off powerSwitch 1; cloud H6099 $TVB devices.capabilities.color_setting colorRgb $(( (255<<16)+(20<<8)+110 )); cloud H6099 $TVB devices.capabilities.range brightness 100
    touch ~/.local/state/bamware/lights.hold   # scheduled vibes and daylight.timer skip while this is under 3 h old
    spotify "spotify:playlist:37i9dQZF1DXaXB8fQg7xif" 0.80   # Dance Party
    ( party_loop ) >/dev/null 2>&1 & echo $! > $PARTY_PID; disown
    echo "party mode: every light full, colours rotating (hot pink, orange, gold, red, fuchsia) for 3 h, Dance Party at 80%; any other scene or Kill stops it" ;;
  release)   # drop the manual hold so timers run again
    rm -f ~/.local/state/bamware/lights.hold; echo "hold released" ;;
  *) echo "usage: vibes.sh morning [--now]|afternoon|evening|cleaning|work|party|party-stop|release"; exit 1;;
esac
echo "$(date '+%F %T') vibes $1 done"
