#!/bin/bash
# Presence for Bilal's apartment, run on omarchy every 2 min by presence.timer.
#   presence.sh            one check: home if his iPhone or MacBook answered on the LAN in the last 15 min
#   presence.sh home|away  manual override for 3 h (he can check in/out from the seat)
#   presence.sh status
# Away transition: lights off, Spotify pause, TVs off. Home transition: nothing automatic (vibes timers handle the day).
export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
S=~/.local/state/bamware; mkdir -p $S; STATE=$S/presence.state; SEEN=$S/presence.lastseen; OVR=$S/presence.override
PHONE_MAC=66:ce:e3:fd:bb:78; MAC_MAC=60:3e:5f:58:ac:92; PY=~/.venvs/smarthome/bin/python
now=$(date +%s)
case ${1:-} in
  home|away) echo "$1 $((now+10800))" > $OVR; echo "override: $1 for 3 h";;
  status) echo "state: $(cat $STATE 2>/dev/null || echo unknown); last seen: $(date -d @$(cat $SEEN 2>/dev/null || echo 0) '+%F %T'); override: $(cat $OVR 2>/dev/null || echo none)"; exit 0;;
esac
# did a personal device answer?
for ip in $(ip neigh | awk '/192\.168\.1\./{print $1}'); do ping -c1 -W1 $ip >/dev/null 2>&1 & done; wait
present=$(ip neigh | grep -i -E "$PHONE_MAC|$MAC_MAC" | grep -v -E "FAILED|INCOMPLETE" | wc -l)
[[ $present -gt 0 ]] && echo $now > $SEEN
last=$(cat $SEEN 2>/dev/null || echo 0)
new=away; (( now - last < 900 )) && new=home
if [[ -f $OVR ]]; then read o until < $OVR; (( now < until )) && new=$o || rm -f $OVR; fi
# quiet hours for the neighbours: 22:00-08:00 cap the stereo at 55%
h=$(date +%H); if (( 10#$h >= 22 || 10#$h < 8 )); then v=$(wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null | awk '{print $2}'); [[ -n $v ]] && awk "BEGIN{exit !($v > 0.55)}" && wpctl set-volume @DEFAULT_AUDIO_SINK@ 0.55 && echo "$(date '+%F %T') quiet hours: volume $v -> 0.55"; fi
old=$(cat $STATE 2>/dev/null || echo unknown)
echo $new > $STATE
if [[ $new != $old ]]; then
  echo "$(date '+%F %T') presence: $old -> $new"
  if [[ $new == away ]]; then
    python3 ~/.local/bin/govee_lan.py off all >/dev/null 2>&1
    . ~/.config/bamware/govee.env; curl -s -H "Govee-API-Key: $GOVEE_API_KEY" -H "Content-Type: application/json" -X POST https://openapi.api.govee.com/router/api/v1/device/control -d '{"requestId":"p","payload":{"sku":"BaseGroup","device":"15560214","capability":{"type":"devices.capabilities.on_off","instance":"powerSwitch","value":0}}}' >/dev/null
    busctl --user call org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player Pause 2>/dev/null
    $PY ~/.local/bin/appletv.py key turn_off >/dev/null 2>&1; $PY ~/.local/bin/samsung_tv.py key KEY_POWER >/dev/null 2>&1; python3 ~/.local/bin/roku_tv.py off >/dev/null 2>&1
  fi
fi
