#!/bin/bash
# Presence for Bilal's apartment, run on omarchy every 2 min by presence.timer.
#   presence.sh            one check: a sighting of his iPhone or MacBook on the LAN flips home; nothing ever flips away by itself
#   presence.sh home|away  explicit state: away is sticky until a device is seen again or `home`; never inferred
#   presence.sh status
# Away transition: lights off, Spotify pause, TVs off.
# Home transition (Bilal 2026-10-29, "things could just automatically turn on when I get home"): the scene that fits
# the hour: before 11:00 morning (at once), 11:00-18:30 daylight tracker, after that evening. Writes presence.log.
export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
S=~/.local/state/bamware; mkdir -p $S; STATE=$S/presence.state; SEEN=$S/presence.lastseen; OVR=$S/presence.override
PHONE_MAC="66:ce:e3:fd:bb:78|72:6b:40:78:70:44"; MAC_MAC=60:3e:5f:58:ac:92; PY=~/.venvs/smarthome/bin/python
now=$(date +%s)
case ${1:-} in
  home) rm -f $OVR; echo home > $STATE.cmd; echo "home: set";;      # explicit, takes effect in this run
  away) rm -f $OVR; echo away > $STATE.cmd; echo $now > $S/presence.awayat; echo "away: set (sticky until a device is seen after 60 min, or 'home')";;
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
# State machine (Bilal 2026-11-26, "my phone dies all the time"): ABSENCE IS NEVER EVIDENCE. Away happens only on an
# explicit `presence.sh away` (Kill/Away button, Siri "I'm leaving", a leave-home Shortcut). Any sighting of his phone or
# Mac, or `presence.sh home`, flips home. Before this, 15 min without a ping reply shut the apartment twice while he was in it.
old=$(cat $STATE 2>/dev/null || echo home)
new=$old
if [[ -f $STATE.cmd ]]; then new=$(cat $STATE.cmd); rm -f $STATE.cmd
elif [[ $present -gt 0 ]]; then new=home; fi
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
echo $new > $STATE
if [[ $new != $old ]]; then
  echo "$(date '+%F %T') presence: $old -> $new"
  if [[ $new == away ]]; then
    python3 ~/.local/bin/govee_lan.py off all >/dev/null 2>&1
    . ~/.config/bamware/govee.env; curl -s -H "Govee-API-Key: $GOVEE_API_KEY" -H "Content-Type: application/json" -X POST https://openapi.api.govee.com/router/api/v1/device/control -d '{"requestId":"p","payload":{"sku":"BaseGroup","device":"15560214","capability":{"type":"devices.capabilities.on_off","instance":"powerSwitch","value":0}}}' >/dev/null
    busctl --user call org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player Pause 2>/dev/null
    $PY ~/.local/bin/samsung_tv.py off >/dev/null 2>&1; python3 ~/.local/bin/roku_tv.py off >/dev/null 2>&1
  elif [[ $old == away ]]; then   # welcome home: only on a real away->home flip, never on the first run after boot
    hm=$((10#$(date +%H) * 60 + 10#$(date +%M)))
    if (( hm < 5*60 )); then scene="evening --force"; elif (( hm < 11*60 )); then scene="morning --now"; elif (( hm < 18*60+30 )); then scene=daylight; else scene="evening --force"; fi
    echo "$(date '+%F %T') welcome home -> $scene" >> $S/presence.log
    rm -f $S/lights.hold
    if [[ $scene == daylight ]]; then python3 ~/.local/bin/daylight.py >> $S/presence.log 2>&1; else ~/.local/bin/vibes.sh $scene >> $S/presence.log 2>&1 & fi
  fi
fi
