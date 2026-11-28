#!/bin/bash
# Root half of freeze forensics on omarchy (2026-11-28). Run once: sudo bash scripts/freeze-forensics-root.sh
# Safe to re-run. Changes nothing about how the desktop behaves; it only keeps evidence and adds a self-reboot.
#   1. Kernel crash dumps: archive whatever the firmware store holds (possibly from the 11-27 freezes) and keep doing so.
#   2. GPU error state: the i915 dump in /sys/class/drm/card*/error is root-only and erased by a reboot; copy it out
#      the moment the kernel logs a GPU hang.
#   3. Watchdog: if PID 1 stops for 30 s the hardware resets the machine, so a hard lock no longer leaves the
#      server dead until someone holds the power button.
#   4. SysRq fully on: Alt+SysRq+S,U,B (sync, remount read-only, reboot) works from the keyboard during a freeze.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "run with sudo"; exit 1; }

echo "== 1. kernel crash dumps"
ls -la /sys/fs/pstore/ 2>/dev/null | tail -n +2 | sed 's/^/   firmware store: /' || true
systemctl enable --now systemd-pstore.service >/dev/null 2>&1 || true
systemctl start systemd-pstore.service 2>/dev/null || true
chmod -R o+rX /var/lib/systemd/pstore 2>/dev/null || true
echo "   archived so far: $(find /var/lib/systemd/pstore -type f 2>/dev/null | wc -l) file(s) in /var/lib/systemd/pstore"

echo "== 2. GPU hang capture"
install -d -m 755 /var/log/bamware-gpu
cat > /usr/local/bin/bamware-gpu-hang-capture <<'EOF'
#!/bin/bash
# Copy the GPU error state out before a reboot erases it. Started by bamware-gpu-hang-capture.service.
journalctl -kf -n 0 -o cat | grep --line-buffered -i -E "GPU HANG|GPU error state saved|amdgpu.*(ring .* timeout|GPU reset)" | while read -r line; do
  ts=$(date +%Y%m%d-%H%M%S)
  for e in /sys/class/drm/card*/error; do
    [[ -s $e ]] && cat "$e" > "/var/log/bamware-gpu/$ts-$(basename "$(dirname "$e")").txt" 2>/dev/null
  done
  echo "$ts $line" >> /var/log/bamware-gpu/hangs.log
  chmod -R o+rX /var/log/bamware-gpu; sync
  logger -t gpu-hang-capture "saved GPU error state for: ${line:0:120}"
done
EOF
chmod 755 /usr/local/bin/bamware-gpu-hang-capture
cat > /etc/systemd/system/bamware-gpu-hang-capture.service <<'EOF'
[Unit]
Description=Bamware: save the GPU error state when the kernel logs a GPU hang (scripts/freeze-forensics-root.sh)
[Service]
ExecStart=/usr/local/bin/bamware-gpu-hang-capture
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now bamware-gpu-hang-capture.service >/dev/null 2>&1
echo "   capture service: $(systemctl is-active bamware-gpu-hang-capture.service)"

echo "== 3. watchdog"
install -d /etc/systemd/system.conf.d
printf '[Manager]\nRuntimeWatchdogSec=30s\nRebootWatchdogSec=2min\n' > /etc/systemd/system.conf.d/10-bamware-watchdog.conf
systemctl daemon-reexec
sleep 2
echo "   device: $(systemctl show -p WatchdogDevice --value 2>/dev/null || echo ?)  timeout: $(systemctl show -p RuntimeWatchdogUSec --value)"
ls /dev/watchdog* 2>/dev/null | sed 's/^/   /' || echo "   no /dev/watchdog: this hardware exposes none, so the self-reboot is not active"

echo "== 4. SysRq"
echo 'kernel.sysrq = 1' > /etc/sysctl.d/90-bamware-sysrq.conf
sysctl -q -p /etc/sysctl.d/90-bamware-sysrq.conf
echo "   kernel.sysrq = $(sysctl -n kernel.sysrq)"
echo "done"
