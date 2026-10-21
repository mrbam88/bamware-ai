#!/bin/bash
# Govee lights from the build server (Bilal's apartment), via Govee's free cloud API.
#   scripts/govee.sh devices                     list lights: name, sku, id
#   scripts/govee.sh on|off  <name|id|all>
#   scripts/govee.sh color   <name|id|all> <red|warm|blue|#rrggbb|r,g,b>
#   scripts/govee.sh bright  <name|id|all> <1-100>
# Key: GOVEE_API_KEY in ~/.config/bamware/govee.env (chmod 600; Govee Home app →
# profile → Settings → "Apply for API Key", arrives by email). Free; Govee allows
# 10,000 calls per day per key. No LAN dependency (LAN Control answered nothing
# on 2026-10-21). Never prints the key. Exit 2 = no key, 1 = Govee refused.
set -euo pipefail
API=https://openapi.api.govee.com/router/api/v1
ENVF=$HOME/.config/bamware/govee.env
[[ -f $ENVF ]] && . "$ENVF"
if [[ -z ${GOVEE_API_KEY:-} ]]; then
  echo "govee: no key. Put GOVEE_API_KEY=... in $ENVF (Govee Home app → profile → Settings → Apply for API Key)." >&2; exit 2
fi
hdr() { printf 'Govee-API-Key: %s\n' "$GOVEE_API_KEY"; }   # header from a fd, never argv
call() { curl -sf -H @<(hdr) -H 'Content-Type: application/json' "$@"; }

devices_json() { call "$API/user/devices" | jq '[.data[] | {name: .deviceName, sku: .sku, id: .device}]'; }

resolve() { # name (case-insensitive substring), id, or "all" → lines "sku id name"
  local q=$1
  devices_json | jq -r --arg q "$q" '.[] | select($q == "all" or .id == $q or (.name | ascii_downcase | contains($q | ascii_downcase))) | "\(.sku) \(.id) \(.name)"'
}

control() { # sku id type instance value
  local body
  body=$(jq -n --arg sku "$1" --arg id "$2" --arg t "$3" --arg i "$4" --argjson v "$5" \
    '{requestId: (now|tostring), payload: {sku: $sku, device: $id, capability: {type: $t, instance: $i, value: $v}}}')
  call -X POST "$API/device/control" -d "$body" | jq -r '"\(.code) \(.message // "")"'
}

rgb_int() { # red|warm|blue|white|#rrggbb|r,g,b → integer
  local c=${1,,} r g b
  case $c in
    red) r=255 g=0 b=0;; green) r=0 g=255 b=0;; blue) r=0 g=0 b=255;; white) r=255 g=255 b=255;;
    warm) r=255 g=160 b=60;; purple) r=160 g=32 b=240;; orange) r=255 g=120 b=0;; pink) r=255 g=105 b=180;;
    \#??????) r=$((16#${c:1:2})) g=$((16#${c:3:2})) b=$((16#${c:5:2}));;
    *,*,*) IFS=, read -r r g b <<<"$c";;
    *) echo "govee: unknown color '$1' (red, green, blue, white, warm, purple, orange, pink, #rrggbb, r,g,b)" >&2; exit 1;;
  esac
  echo $(( (r << 16) + (g << 8) + b ))
}

cmd=${1:-}; shift || true
case $cmd in
  devices) devices_json | jq -r '.[] | "\(.name)\t\(.sku)\t\(.id)"' ;;
  on|off)
    [[ -n ${1:-} ]] || { echo "usage: govee.sh $cmd <name|id|all>" >&2; exit 1; }
    v=1; [[ $cmd == off ]] && v=0
    while read -r sku id name; do [[ -n $sku ]] || continue
      echo "$name: $cmd → $(control "$sku" "$id" devices.capabilities.on_off powerSwitch "$v")"; done < <(resolve "$1") ;;
  color)
    [[ -n ${2:-} ]] || { echo "usage: govee.sh color <name|id|all> <color>" >&2; exit 1; }
    v=$(rgb_int "$2")
    while read -r sku id name; do [[ -n $sku ]] || continue
      echo "$name: color $2 → $(control "$sku" "$id" devices.capabilities.color_setting colorRgb "$v")"; done < <(resolve "$1") ;;
  bright)
    [[ ${2:-} =~ ^[0-9]+$ ]] && (( $2 >= 1 && $2 <= 100 )) || { echo "usage: govee.sh bright <name|id|all> <1-100>" >&2; exit 1; }
    while read -r sku id name; do [[ -n $sku ]] || continue
      echo "$name: brightness $2 → $(control "$sku" "$id" devices.capabilities.range brightness "$2")"; done < <(resolve "$1") ;;
  *) sed -n 2,6p "$0"; exit 1 ;;
esac
