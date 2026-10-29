#!/bin/bash
# Room loudness from the EarPods mic plugged into omarchy. Runs every minute (roomlevel.timer).
#   roomlevel.sh              sample 3 s, append "ts dBFS peak" to ~/.local/state/bamware/roomlevel.log, run the too-loud check
#   roomlevel.sh now          sample and print
#   roomlevel.sh club-test    sample, then run the club alert as a test (lights only, volume untouched)
#   roomlevel.sh mute [min]   pause the too-loud alert (default 120 min): interviews, calls, thinking out loud
#   roomlevel.sh unmute       resume it
#   roomlevel.sh status       threshold, streak, mute state, last alert
# Scale (uncalibrated, EarPods on the desk): < -45 quiet, -45..-30 music or talk across the room,
# -25..-15 Bilal talking at the desk (2026-10-29: an interview read -18..-24 with clipped peaks), > -15 music loud enough for the neighbours.
export XDG_RUNTIME_DIR=/run/user/1000
S=~/.local/state/bamware; mkdir -p $S; LOG=$S/roomlevel.log
# Too-loud rule (retuned 2026-10-29 after talking tripped it 12 times in one day):
#   threshold default -15 dBFS ($S/roomlevel.threshold overrides), AND the room must stay above it for
#   NEED consecutive samples (speech is bursty, music is steady), AND not muted, AND 5-min cooldown.
T=$(cat $S/roomlevel.threshold 2>/dev/null || echo -15); NEED=$(cat $S/roomlevel.need 2>/dev/null || echo 2)
case ${1:-} in
  mute)   m=${2:-120}; echo $(( $(date +%s) + m*60 )) > $S/roomlevel.mute_until; echo "too-loud alert muted for $m min"; echo "$(date '+%F %T') muted $m min" >> $LOG; exit 0 ;;
  unmute) rm -f $S/roomlevel.mute_until; echo "too-loud alert active"; echo "$(date '+%F %T') unmuted" >> $LOG; exit 0 ;;
  status) mu=$(cat $S/roomlevel.mute_until 2>/dev/null || echo 0); now=$(date +%s)
          echo "threshold ${T} dBFS, need ${NEED} consecutive loud samples, streak $(cat $S/roomlevel.streak 2>/dev/null || echo 0)"
          (( mu > now )) && echo "muted for $(( (mu-now)/60 )) more min" || echo "not muted"
          last=$(cat $S/club.last 2>/dev/null || echo 0); (( last > 0 )) && echo "last alert: $(date -d @$last '+%F %T')" || echo "last alert: never"; exit 0 ;;
esac
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
mu=$(cat $S/roomlevel.mute_until 2>/dev/null || echo 0); now=$(date +%s)
if (( mu > now )); then echo 0 > $S/roomlevel.streak; exit 0; fi
if awk "BEGIN{exit !($dbfs > $T)}"; then streak=$(( $(cat $S/roomlevel.streak 2>/dev/null || echo 0) + 1 )); else streak=0; fi
echo $streak > $S/roomlevel.streak
last=$(cat $S/club.last 2>/dev/null || echo 0)
if (( streak >= NEED )) && (( now - last > 300 )); then
  echo $now > $S/club.last; echo 0 > $S/roomlevel.streak
  echo "$(date '+%F %T') TOO LOUD $dbfs > $T for $NEED samples: club alert" >> $LOG
  python3 ~/.local/bin/club_alert.py "$dbfs" >> $LOG 2>&1
fi
