#!/bin/bash
# Put omarchy's desktop on the living-room Samsung, or take it off again (2026-11-26).
#   tv-cast.sh on      enable the TV output (4K, scale 2) and reload Hyprland
#   tv-cast.sh off     disable it; the panel shows "no signal" on that HDMI and the Samsung source list skips it
#   tv-cast.sh status
# The TV is an on-demand output, not a desktop extension: left on, an empty workspace sat on the panel and the TV
# scenes landed on it. ~/.config/hypr/monitors.lua reads the flag file; Hyprland 0.56 has no runtime toggle.
export XDG_RUNTIME_DIR=/run/user/1000
F=~/.local/state/bamware/tv-cast
case ${1:-status} in
  on)  mkdir -p "$(dirname $F)"; touch $F; hyprctl reload >/dev/null; sleep 2; echo "cast on";;
  off) rm -f $F; hyprctl reload >/dev/null; sleep 2; echo "cast off";;
esac
hyprctl monitors all -j 2>/dev/null | python3 -I -c 'import json,sys
for m in json.load(sys.stdin):
    if "Samsung" in m["description"]: print("tv output:", "off" if m["disabled"] else "on", m["description"][:40])'
