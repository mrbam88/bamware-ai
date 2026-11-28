#!/usr/bin/env python3
"""Event tap for the build server: the timeline that goes with flight-recorder.py's numbers.

flight-recorder.py says how the machine looked every 5 s. This says what HAPPENED: graphics and
kernel warnings, the wall board shown or hidden, cast on or off, core dumps, charger changes,
monitors added or removed. Each matching journal line is appended and forced to disk at once, so
the last lines before a hard freeze survive even when journald's own buffer does not (2026-11-27:
the 16:57 freeze left nothing at all to read).

    flight-events.py            follow the journal forever (the systemd user unit does this)
    flight-events.py last [N]   print the last N events (default 40) from the newest file(s)

Events: ~/.local/state/bamware/flight-recorder/events-YYYY-MM-DD.log, kept 14 days.
"""
import glob
import os
import re
import subprocess
import sys
import time

STATE = os.path.expanduser("~/.local/state/bamware/flight-recorder")
KEEP_DAYS = 14
# One alternation per line so a new suspect is a one-line change.
KEEP = re.compile("|".join([
    r"kernel: .*(i915|amdgpu|\[drm\]|GPU HANG|gmux|BUG:|Oops|panic|lockup|rcu.*stall|hung task|NMI|MCE|Hardware Error"
    r"|thermal|throttl|xhci|USB disconnect|new .* USB device|nvme|I/O error|Out of memory|oom|PM: suspend|PM: resume)",
    r"wallboard: (shown|hidden)",
    r"tv-cast",
    r"systemd-coredump.*(dumped core|terminated abnormally)",
    r"(Hyprland|aquamarine|quickshell|qs)\[\d+\]:.*(ERR|CRIT|error|failed|lost|crash)",
    r"presence\.sh.*(presence:|power:)",
    r"flight-recorder|Reached target Graphical Interface|Stopped target Graphical",
    r"upowerd|suspend-then-hibernate|The system will (sleep|power off|reboot)",
]), re.I)


def path():
    return os.path.join(STATE, time.strftime("events-%Y-%m-%d.log"))


def write(line):
    with open(path(), "a") as f:
        f.write(line.rstrip("\n") + "\n")
        f.flush()
        os.fsync(f.fileno())


def prune():
    cutoff = time.time() - KEEP_DAYS * 86400
    for p in glob.glob(os.path.join(STATE, "events-*.log")):
        if os.path.getmtime(p) < cutoff:
            os.remove(p)


def snapshot():
    """One line of standing state at start, so a reader knows what was on when the tap began."""
    cast = os.path.exists(os.path.expanduser("~/.local/state/bamware/tv-cast"))
    hold = os.path.exists(os.path.expanduser("~/.local/state/bamware/tv-cast.hold"))
    try:
        kernel = os.uname().release
    except Exception:
        kernel = "?"
    return f"cast={'on' if cast else 'off'} hold={'on' if hold else 'off'} kernel={kernel}"


def follow():
    os.makedirs(STATE, exist_ok=True)
    prune()
    write(f"{time.strftime('%Y-%m-%dT%H:%M:%S%z')} flight-events start {snapshot()}")
    p = subprocess.Popen(["journalctl", "-f", "-n", "0", "-o", "short-iso", "--no-pager"],
                         stdout=subprocess.PIPE, text=True, errors="replace")
    for line in p.stdout:
        if KEEP.search(line):
            write(line[:400])
    return p.wait()


def last(n):
    files = sorted(glob.glob(os.path.join(STATE, "events-*.log")))[-2:]
    lines = []
    for p in files:
        with open(p, errors="replace") as f:
            lines += f.readlines()
    sys.stdout.writelines(lines[-n:])
    return 0


if __name__ == "__main__":
    a = sys.argv[1:]
    sys.exit(last(int(a[1]) if len(a) > 1 else 40) if a and a[0] == "last" else follow())
