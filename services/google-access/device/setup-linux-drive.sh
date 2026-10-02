#!/usr/bin/env bash
# Run interactively on the device. Authorization remains on this device.
set -euo pipefail
umask 077
rclone_bin="$HOME/.local/bin/rclone"
config_dir="$HOME/.config/bamware-drive"
config_file="$config_dir/rclone.conf"
mount_dir="$HOME/GoogleDrive"
mkdir -p "$config_dir" "$HOME/.config/systemd/user" "$HOME/.cache/bamware-drive"
chmod 700 "$config_dir" "$HOME/.cache/bamware-drive"
if [[ -d "$mount_dir" ]] && ! mountpoint -q "$mount_dir" && [[ -n $(ls -A "$mount_dir") ]]; then
  echo 'GoogleDrive already contains local files. Stopping without hiding or moving them.' >&2
  exit 1
fi
mkdir -p "$mount_dir"
# No keyring password; use a private per-user config file as desktop sync clients do.
if ! "$rclone_bin" --config "$config_file" listremotes | grep -qx 'bamware-drive:'; then
  "$rclone_bin" --config "$config_file" config create bamware-drive drive scope drive config_is_local true --no-output
elif ! "$rclone_bin" --config "$config_file" about bamware-drive: --json >/dev/null 2>&1; then
  "$rclone_bin" --config "$config_file" config reconnect bamware-drive:
fi
chmod 600 "$config_file"
"$rclone_bin" --config "$config_file" about bamware-drive: --json >/dev/null
cat > "$HOME/.config/systemd/user/bamware-drive.service" <<'UNIT'
[Unit]
Description=Personal Google Drive files
After=network-online.target
Wants=network-online.target
[Service]
Type=notify
ExecStart=%h/.local/bin/rclone mount bamware-drive: %h/GoogleDrive --config %h/.config/bamware-drive/rclone.conf --cache-dir %h/.cache/bamware-drive --vfs-cache-mode writes --vfs-cache-max-size 2G --vfs-cache-max-age 24h --dir-cache-time 1m --poll-interval 30s --drive-use-trash=true --log-level ERROR
ExecStop=/usr/bin/fusermount3 -u %h/GoogleDrive
Restart=on-failure
RestartSec=10
TimeoutStopSec=30
[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now bamware-drive.service
mountpoint -q "$mount_dir"
echo 'Google Drive folder is mounted at ~/GoogleDrive. Existing Desktop/Documents were not moved.'
echo 'This is online file access with an edit cache, not a complete offline mirror.'
