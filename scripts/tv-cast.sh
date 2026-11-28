#!/bin/bash
# Put omarchy's desktop on the living-room Samsung, or take it off again (2026-11-26).
#   tv-cast.sh on      enable the TV output (4K at 30 Hz, scale 2), reload Hyprland, switch the TV to its "PC" source
#   tv-cast.sh off     disable it; the panel shows "no signal" on that HDMI and the Samsung source list skips it
#   tv-cast.sh status
# The TV is an on-demand output, not a desktop extension: left on, an empty workspace sat on the panel and the TV
# scenes landed on it. ~/.config/hypr/monitors.lua reads the flag file; Hyprland 0.56 has no runtime toggle.
export XDG_RUNTIME_DIR=/run/user/1000
F=~/.local/state/bamware/tv-cast
# Hold (2026-11-27): `hold` turns cast off and makes every later `on` refuse until `release`. Two hard stops that day
# ended in an i915 GPU hang inside Hyprland with cast on (AMD drives the TV, Intel the laptop panel), and the music
# scenes call `on` by themselves through tv-spotify.sh, so a plain `off` did not stay off.
H=$F.hold
# Every toggle goes to the journal (flight-events.py keeps it): on 2026-11-27 nothing recorded when cast came on.
if [[ ${1:-status} != status ]]; then logger -t tv-cast "$1 requested by $(ps -o comm= -p $PPID 2>/dev/null || echo ?) (hold=$([[ -f $H ]] && echo on || echo off))"; fi
case ${1:-status} in
  hold)    touch $H; rm -f $F; hyprctl reload >/dev/null; sleep 2; echo "cast off and held (tv-cast.sh release to allow it again)";;
  release) rm -f $H; echo "cast hold released";;
esac
[[ ${1:-} == on && -f $H ]] && { echo "cast is held off (tv-cast.sh release)"; exit 1; }
case ${1:-status} in
  on)  mkdir -p "$(dirname $F)"; touch $F; hyprctl reload >/dev/null; sleep 2; echo "cast on"
       # Put the panel on this laptop too, by the source's label (2026-11-26): the TV only lists "PC" once it has a signal.
       python3 ~/.local/bin/samsung_tv.py wake >/dev/null 2>&1; python3 ~/.local/bin/samsung_tv.py source pc;;
  off) rm -f $F; hyprctl reload >/dev/null; sleep 2; echo "cast off";;
esac
hyprctl monitors all -j 2>/dev/null | python3 -I -c 'import json,sys
for m in json.load(sys.stdin):
    if "Samsung" in m["description"]: print("tv output:", "off" if m["disabled"] else "on", m["description"][:40])'
if [[ -f $H ]]; then echo "hold: on"; fi
