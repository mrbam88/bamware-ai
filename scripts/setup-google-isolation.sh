#!/usr/bin/env bash
# Human-run on omarchy after reviewing this file. No Google credentials handled.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run this setup with sudo on omarchy.' >&2; exit 1; }
stage=/home/bilal/srv/google-chief-of-staff
printf '%s  %s\n' a16d4b8b917e36b96b09b30ecb7a5049d06ff1e88b856a101eec12b86b33fe05 "$stage/downloads/gogcli.tar.gz" | sha256sum --check --status
printf '%s  %s\n' 72a806370072015ccbe4d81bcd348cc5eaf3beca6c65ba693fd43fb31fcca5b1 "$stage/downloads/rclone.zip" | sha256sum --check --status
if ! id bamware-google >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/bamware-google --shell /usr/bin/nologin bamware-google
fi
[[ $(getent passwd bamware-google | cut -d: -f6) == /var/lib/bamware-google ]] || { echo 'Existing service account has unexpected home; stop.' >&2; exit 1; }
install -d -m 700 -o bamware-google -g bamware-google /var/lib/bamware-google
install -d -m 755 -o root -g root /opt/bamware-google/bin
# Extract only the verified executable into root-owned temporary storage.
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
tar -xzf "$stage/downloads/gogcli.tar.gz" -C "$scratch" ./gog
unzip -p "$stage/downloads/rclone.zip" rclone-v1.74.2-linux-amd64/rclone > "$scratch/rclone"
install -m 755 -o root -g root "$scratch/gog" /opt/bamware-google/bin/gog
install -m 755 -o root -g root "$scratch/rclone" /opt/bamware-google/bin/rclone
echo 'Service account and verified binaries installed. No OAuth, services, sudo delegation, or sync enabled.'
