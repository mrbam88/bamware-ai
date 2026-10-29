#!/bin/bash
# Room loudness from the EarPods mic plugged into omarchy. Runs every minute (roomlevel.timer).
#   roomlevel.sh          sample 3 s, append "ts dBFS peak" to ~/.local/state/bamware/roomlevel.log, enforce quiet hours
#   roomlevel.sh now      sample and print
# Scale (uncalibrated, EarPods on the desk): < -45 quiet, -45..-30 music/talk, > -25 loud, > -18 neighbour territory.
export XDG_RUNTIME_DIR=/run/user/1000
S=~/.local/state/bamware; mkdir -p $S; LOG=$S/roomlevel.log
src=$(wpctl status 2>/dev/null | sed -n "/Sources:/,/Filters:/p" | grep -i "earpods" | grep -oE "[0-9]+\." | head -1 | tr -d .)
[[ -n $src ]] || { echo "$(date '+%F %T') no EarPods mic" >> $LOG; exit 0; }
timeout 6 pw-record --target $src --rate 48000 --channels 1 --format s16 /tmp/roomlevel.wav 2>/dev/null; timeout 1 true
read dbfs peak < <(python3 - <<'PY'
import wave, struct, math
w=wave.open("/tmp/roomlevel.wav"); n=w.getnframes(); d=w.readframes(n); s=struct.unpack("<%dh"%(len(d)//2), d)
rms=math.sqrt(sum(x*x for x in s)/max(1,len(s))); peak=max(abs(x) for x in s) if s else 0
print(f"{20*math.log10(max(rms,1)/32768):.1f} {20*math.log10(max(peak,1)/32768):.1f}")
PY
)
echo "$(date '+%F %T') $dbfs $peak" >> $LOG
[[ ${1:-} == now ]] && echo "room: ${dbfs} dBFS rms, ${peak} dBFS peak"
[[ ${1:-} == club-test ]] && { python3 ~/.local/bin/club_alert.py "$dbfs" --test; exit 0; }
# too loud (any hour; threshold in $S/roomlevel.threshold, default -25 dBFS, to be calibrated): club-blue feedback loop, 5-min cooldown
T=$(cat $S/roomlevel.threshold 2>/dev/null || echo -25); last=$(cat $S/club.last 2>/dev/null || echo 0)
if awk "BEGIN{exit !($dbfs > $T)}" && (( $(date +%s) - last > 300 )); then
  date +%s > $S/club.last; echo "$(date '+%F %T') TOO LOUD $dbfs > $T: club alert" >> $LOG
  python3 ~/.local/bin/club_alert.py "$dbfs" >> $LOG 2>&1
fi
