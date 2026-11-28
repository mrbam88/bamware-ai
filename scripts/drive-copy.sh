#!/bin/bash
# Copy one external drive into ~/drives/<name>, read-only on the source (2026-11-28 spring cleaning).
#   drive-copy.sh "<mount point>" <name>
# Restartable: rsync skips what is already copied. Nothing is ever deleted on either side.
# Log and final stats: ~/drives/<name>.copy.log ; exit code: ~/drives/<name>.copy.exit
src="$1"; name="$2"; dst="$HOME/drives/$name"
mkdir -p "$dst"
echo "$(date '+%F %T') start $src -> $dst" >> "$HOME/drives/$name.copy.log"
rsync -rt --modify-window=2 --info=stats2 "$src"/ "$dst"/ >> "$HOME/drives/$name.copy.log" 2>&1
rc=$?
echo "$rc" > "$HOME/drives/$name.copy.exit"
echo "$(date '+%F %T') finished exit=$rc" >> "$HOME/drives/$name.copy.log"
exit $rc
