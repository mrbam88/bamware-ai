#!/usr/bin/env python3
"""Flight recorder for the build server: what the machine looked like just before a freeze.

A hard freeze writes nothing to the journal, so on 2026-11-27 there was no way to
say why omarchy locked up under the wall board. This writes one line every few
seconds and forces it to disk, so after the next freeze the last lines show
memory, load, temperatures, both graphics chips and the wall-board process as
they were seconds before.

    flight-recorder.py            run forever (the systemd user unit does this)
    flight-recorder.py last [N]   print the last N records before the most recent unclean stop

Records: ~/.local/state/bamware/flight-recorder/YYYY-MM-DD.tsv, kept 14 days.
A start that follows a stop without a "stop" line is appended to unclean-stops.log.
"""
import glob
import os
import signal
import sys
import time

STATE = os.path.expanduser("~/.local/state/bamware/flight-recorder")
INTERVAL = int(os.environ.get("FLIGHT_RECORDER_SECONDS", "5"))
KEEP_DAYS = 14
WATCH = {"qs": "board", "Hyprland": "hypr"}  # process name -> label


def read(path, default=""):
    try:
        with open(path) as handle:
            return handle.read().strip()
    except OSError:
        return default


def meminfo():
    values = {}
    for line in read("/proc/meminfo").splitlines():
        key, _, rest = line.partition(":")
        values[key] = int(rest.split()[0]) // 1024
    return values


def sensors():
    out = []
    for hwmon in sorted(glob.glob("/sys/class/hwmon/hwmon*")):
        name = read(hwmon + "/name")
        if name in ("coretemp", "amdgpu", "pch_cannonlake", "nvme"):
            temp = read(hwmon + "/temp1_input")
            if temp:
                out.append(f"{name}={int(temp) // 1000}C")
        if name == "amdgpu":
            fan = read(hwmon + "/fan1_input")
            if fan:
                out.append(f"gpufan={fan}")
    return " ".join(out)


def gpus():
    out = []
    for card in sorted(glob.glob("/sys/class/drm/card[0-9]")):
        dev = card + "/device"
        vendor = {"0x8086": "intel", "0x1002": "amd"}.get(read(dev + "/vendor"), "gpu")
        parts = [read(dev + "/power_state", "?")]
        busy = read(dev + "/gpu_busy_percent")
        if busy:
            parts.append(f"busy{busy}")
        vram = read(dev + "/mem_info_vram_used")
        if vram:
            parts.append(f"vram{int(vram) // 1048576}M")
        out.append(f"{vendor}:{'/'.join(parts)}")
    return " ".join(out)


def processes():
    """RSS, CPU seconds and thread count of the watched processes, plus the busiest process."""
    ticks = os.sysconf("SC_CLK_TCK")
    page = os.sysconf("SC_PAGE_SIZE")
    watched, busiest = [], ("", 0)
    for stat_path in glob.glob("/proc/[0-9]*/stat"):
        stat = read(stat_path)
        if not stat:
            continue
        pid = stat.split(" ", 1)[0]
        name = stat[stat.find("(") + 1:stat.rfind(")")]
        fields = stat[stat.rfind(")") + 2:].split()
        cpu = (int(fields[11]) + int(fields[12])) // ticks
        if name in WATCH:
            label = WATCH[name]
            # Omarchy's own shell is also a qs process; only the wall board is "board".
            if name == "qs" and "wallboard" not in read(f"/proc/{pid}/cmdline"):
                label = "shell"
            rss = int(fields[21]) * page // 1048576
            watched.append(f"{label}:{pid}/rss{rss}M/cpu{cpu}s/thr{fields[17]}")
        previous = processes.seen.get(pid, cpu)
        if cpu - previous > busiest[1]:
            busiest = (name, cpu - previous)
        processes.seen[pid] = cpu
    top = f"top:{busiest[0]}+{busiest[1]}s" if busiest[0] else "top:-"
    return " ".join(sorted(watched)) or "board:none", top


processes.seen = {}


def record(kind="tick"):
    mem = meminfo()
    watched, top = processes()
    fields = [
        time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        kind,
        "up=" + read("/proc/uptime").split(".")[0] + "s",
        "load=" + " ".join(read("/proc/loadavg").split()[:3]),
        f"memavail={mem.get('MemAvailable', 0)}M swapused={mem.get('SwapTotal', 0) - mem.get('SwapFree', 0)}M",
        "ac=" + read("/sys/class/power_supply/ADP1/online", "?"),
        sensors(),
        gpus(),
        watched,
        top,
    ]
    path = os.path.join(STATE, time.strftime("%Y-%m-%d") + ".tsv")
    with open(path, "a") as handle:
        handle.write("\t".join(fields) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def logs():
    return sorted(glob.glob(os.path.join(STATE, "*.tsv")))


def tail(path, count):
    with open(path) as handle:
        return handle.readlines()[-count:]


def note_unclean_stop():
    """If the last recorded line is not a clean stop, the machine froze or lost power."""
    files = logs()
    if not files:
        return
    last = tail(files[-1], 3)
    if not last or "\tstop\t" in last[-1]:
        return
    with open(os.path.join(STATE, "unclean-stops.log"), "a") as handle:
        handle.write(f"--- found {time.strftime('%Y-%m-%dT%H:%M:%S%z')}: no clean stop; last records were:\n")
        handle.writelines(last)
        handle.flush()
        os.fsync(handle.fileno())


def prune():
    cutoff = time.time() - KEEP_DAYS * 86400
    for path in logs():
        if os.path.getmtime(path) < cutoff:
            os.remove(path)


def show_last(count):
    stops = read(os.path.join(STATE, "unclean-stops.log"))
    if stops:
        print(stops.split("--- found ")[-1].splitlines()[0])
    files = logs()
    lines = []
    for path in files:
        lines += tail(path, 100000)
    # The records before the most recent "start" belong to the run that died.
    starts = [i for i, line in enumerate(lines) if "\tstart\t" in line]
    end = starts[-1] if starts else len(lines)
    sys.stdout.writelines(lines[max(0, end - count):end])


def main():
    os.makedirs(STATE, exist_ok=True)
    if len(sys.argv) > 1 and sys.argv[1] == "last":
        show_last(int(sys.argv[2]) if len(sys.argv) > 2 else 24)
        return
    note_unclean_stop()
    prune()

    def stop(*_):
        record("stop")
        sys.exit(0)

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    record("start")
    while True:
        time.sleep(INTERVAL)
        record()
        if time.localtime().tm_hour == 4 and time.localtime().tm_min == 0:
            prune()


if __name__ == "__main__":
    main()
