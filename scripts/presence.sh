#!/bin/bash
# Presence for Bilal's apartment, run on omarchy every 2 min by presence.timer.
#   presence.sh            one check: home if his iPhone or MacBook answered on the LAN in the last 15 min
#   presence.sh home|away  manual override for 3 h (he can check in/out from the seat)
#   presence.sh status
# Away transition: lights off, Spotify pause, TVs off.
# Home transition (Bilal 2026-10-29, "things could just automatically turn on when I get home"): the scene that fits
# the hour: before 11:00 morning (at once), 11:00-18:30 daylight tracker, after that evening. Writes presence.log.
export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
S=~/.local/state/bamware; mkdir -p $S; STATE=$S/presence.state; SEEN=$S/presence.lastseen; OVR=$S/presence.override
PHONE_MAC=66:ce:e3:fd:bb:78; MAC_MAC=60:3e:5f:58:ac:92; PY=~/.venvs/smarthome/bin/python
now=$(date +%s)
case ${1:-} in
  home|away) echo "$1 $((now+10800))" > $OVR; echo "override: $1 for 3 h";;
  status) echo "state: $(cat $STATE 2>/dev/null || echo unknown); last seen: $(date -d @$(cat $SEEN 2>/dev/null || echo 0) '+%F %T'); override: $(cat $OVR 2>/dev/null || echo none)"; exit 0;;
esac
# did a personal device answer? Ping what the kernel already knows; if neither device is in the table (empty after a
# reboot: 2026-11-25 a power loss made the first check flip home->away and switch the apartment off) sweep the /24 once.
for ip in $(ip neigh | awk '/192\.168\.1\./{print $1}'); do ping -c1 -W1 $ip >/dev/null 2>&1 & done; wait
if ! ip neigh | grep -qi -E "$PHONE_MAC|$MAC_MAC"; then
  for i in $(seq 1 254); do ping -c1 -W1 192.168.1.$i >/dev/null 2>&1 & done; wait
fi
present=$(ip neigh | grep -i -E "$PHONE_MAC|$MAC_MAC" | grep -v -E "FAILED|INCOMPLETE" | wc -l)
[[ $present -gt 0 ]] && echo $now > $SEEN
last=$(cat $SEEN 2>/dev/null || echo 0)
new=away; (( now - last < 900 )) && new=home
if [[ -f $OVR ]]; then read o until < $OVR; (( now < until )) && new=$o || rm -f $OVR; fi
# server on battery? (2026-11-23 the charger came out unnoticed; upower suspended at 5% and the box was dark 37 h)
ac=$(cat /sys/class/power_supply/ADP1/online 2>/dev/null || echo 1); PWR=$S/power.state; oldac=$(cat $PWR 2>/dev/null || echo 1); echo $ac > $PWR
if [[ $ac != $oldac ]]; then
  bat=$(cat /sys/class/power_supply/BAT0/capacity 2>/dev/null || echo ?)
  [[ $ac == 0 ]] && msg="omarchy is ON BATTERY ($bat%): charger unplugged. Plug it back in or the apartment goes dark." || msg="omarchy back on AC ($bat%)."
  echo "$(date '+%F %T') power: $msg" | tee -a $S/presence.log
  hook=~/.config/bamware/discord-webhook-status; [[ -r $hook ]] && curl -sS -m 20 -H 'Content-Type: application/json' -d "$(printf '{"content":"%s"}' "$msg")" "$(cat $hook)" >/dev/null 2>&1
fi
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
  elif [[ $old == away ]]; then   # welcome home: only on a real away->home flip, never on the first run after boot
    hm=$((10#$(date +%H) * 60 + 10#$(date +%M)))
    if (( hm < 11*60 )); then scene="morning --now"; elif (( hm < 18*60+30 )); then scene=daylight; else scene="evening --force"; fi
    echo "$(date '+%F %T') welcome home -> $scene" >> $S/presence.log
    rm -f $S/lights.hold
    if [[ $scene == daylight ]]; then python3 ~/.local/bin/daylight.py >> $S/presence.log 2>&1; else ~/.local/bin/vibes.sh $scene >> $S/presence.log 2>&1 & fi
  fi
fi
