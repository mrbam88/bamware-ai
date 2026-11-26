#!/bin/bash
# Install or update the wall board on this machine. Safe to run again.
#   services/wallboard/install.sh            install and start
#   services/wallboard/install.sh uninstall  remove and restore the stock screensaver
set -euo pipefail

src=$(cd "$(dirname "$0")" && pwd)
dest=$HOME/.local/share/bamware/wallboard
unit=$HOME/.config/systemd/user/bamware-wallboard.service
shell_json=$HOME/.config/omarchy/shell.json
saved=$HOME/.local/state/bamware/wallboard/stock-screensaver-seconds

# The board replaces Omarchy's terminal screensaver, so only one of them may
# answer idleness. Omarchy reads this value live; 0 switches its screensaver off
# and leaves its lock timer alone.
set_stock_screensaver() {
  [[ -f $shell_json ]] || return 0
  local temp
  temp=$(mktemp "$shell_json.XXXXXX")
  jq --argjson seconds "$1" '.idle.screensaver = $seconds' "$shell_json" >"$temp"
  mv "$temp" "$shell_json"
}

if [[ ${1:-} == uninstall ]]; then
  systemctl --user disable --now bamware-wallboard.service 2>/dev/null || true
  rm -f "$unit" "$HOME/.local/bin/wallboard"
  rm -rf "$dest"
  systemctl --user daemon-reload
  set_stock_screensaver "$(cat "$saved" 2>/dev/null || echo 150)"
  echo "Wall board removed; Omarchy's screensaver is back."
  exit 0
fi

for tool in qs python3 jq; do
  command -v "$tool" >/dev/null || { echo "Missing $tool; the wall board needs it." >&2; exit 1; }
done

mkdir -p "$dest/fonts" "$(dirname "$unit")" "$HOME/.local/bin" "$(dirname "$saved")"
cp "$src"/shell.qml "$src"/Board.qml "$src"/collect.py "$dest"/
cp "$src"/fonts/* "$dest"/fonts/
cp "$src"/bamware-wallboard.service "$unit"
install -m 755 "$src"/bin/wallboard "$HOME/.local/bin/wallboard"

if [[ -f $shell_json ]]; then
  current=$(jq -r '.idle.screensaver // 150' "$shell_json")
  if [[ $current != 0 ]]; then
    echo "$current" >"$saved"
    set_stock_screensaver 0
  fi
fi

systemctl --user daemon-reload
systemctl --user enable bamware-wallboard.service >/dev/null
systemctl --user restart bamware-wallboard.service
echo "Wall board installed. Try it now: wallboard show"
