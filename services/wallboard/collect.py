#!/usr/bin/env python3
"""Collect everything the living-room wall board shows into one JSON document.

Reads local state files that other Bamware timers already write, plus two free
network sources that are cached on disk (weather, and an optional private
calendar feed). It never calls a model, so showing the board costs no tokens.

Every section is independent: a missing file or a failed fetch turns that one
section into null and the board draws the rest.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
import zoneinfo

HOME = pathlib.Path.home()
STATE = pathlib.Path(os.environ.get("BAMWARE_STATE", HOME / ".local/state/bamware"))
OUT_DIR = STATE / "wallboard"
CONFIG = pathlib.Path(os.environ.get("WALLBOARD_CONFIG", HOME / ".config/bamware/wallboard.env"))
THEME = pathlib.Path(
    os.environ.get("WALLBOARD_THEME", HOME / ".local/state/omarchy/current/theme/colors.toml")
)

WEATHER_TTL = 20 * 60
CALENDAR_TTL = 10 * 60
CALENDAR_DAYS = 7

# WMO weather codes, as returned by Open-Meteo.
WEATHER_LABELS = {
    0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain",
    65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow",
    73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Showers", 81: "Showers",
    82: "Heavy showers", 85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm",
    96: "Thunderstorm", 99: "Thunderstorm",
}


def read_config(path: pathlib.Path = CONFIG) -> dict[str, str]:
    """KEY=value lines; the environment wins so tests and one-off runs can override."""
    values: dict[str, str] = {}
    try:
        for raw in path.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip("'\"")
    except OSError:
        pass
    for key, value in os.environ.items():
        if key.startswith("WALLBOARD_"):
            values[key] = value
    return values


def read_json(path: pathlib.Path):
    return json.loads(path.read_text())


def read_text(path: pathlib.Path) -> str:
    return path.read_text().strip()


def cached(name: str, ttl: int, fetch):
    """Return fetch()'s result, reusing the copy on disk while it is fresh.

    A failed fetch falls back to the stale copy: yesterday's forecast with its
    age shown beats an empty corner of the screen.
    """
    path = OUT_DIR / f"cache-{name}.json"
    try:
        entry = read_json(path)
        if time.time() - entry["at"] < ttl:
            return entry["value"]
    except (OSError, ValueError, KeyError):
        entry = None
    try:
        value = fetch()
    except Exception:  # noqa: BLE001 - any network or parse failure means "use the cache"
        return entry["value"] if entry else None
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_atomic(path, json.dumps({"at": time.time(), "value": value}))
    return value


def write_atomic(path: pathlib.Path, text: str) -> None:
    handle, temp = tempfile.mkstemp(dir=path.parent, prefix=path.name + ".")
    with os.fdopen(handle, "w") as stream:
        stream.write(text)
    os.chmod(temp, 0o600)
    os.replace(temp, path)


def http_get(url: str, timeout: int = 8) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "wallboard/1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - https URLs from config
        return response.read()


# --- theme ---------------------------------------------------------------

def theme(path: pathlib.Path = THEME) -> dict[str, str]:
    colors: dict[str, str] = {}
    try:
        for line in path.read_text().splitlines():
            match = re.match(r'\s*([a-z_]+)\s*=\s*"(#[0-9a-fA-F]{6})"', line)
            if match:
                colors[match.group(1)] = match.group(2)
    except OSError:
        pass
    return colors


# --- weather -------------------------------------------------------------

def weather(config: dict[str, str]):
    lat = config.get("WALLBOARD_LAT", "40.7128")
    lon = config.get("WALLBOARD_LON", "-74.0060")
    unit = config.get("WALLBOARD_TEMP_UNIT", "fahrenheit")
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}&temperature_unit={unit}&timezone=auto&forecast_days=1"
        "&current=temperature_2m,apparent_temperature,weather_code"
        "&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset"
    )

    def fetch():
        body = json.loads(http_get(url))
        code = int(body["current"]["weather_code"])
        return {
            "temp": round(body["current"]["temperature_2m"]),
            "feels": round(body["current"]["apparent_temperature"]),
            "label": WEATHER_LABELS.get(code, "Weather"),
            "high": round(body["daily"]["temperature_2m_max"][0]),
            "low": round(body["daily"]["temperature_2m_min"][0]),
            "sunrise": body["daily"]["sunrise"][0],
            "sunset": body["daily"]["sunset"][0],
        }

    return cached("weather", WEATHER_TTL, fetch)


# --- calendar ------------------------------------------------------------

WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]


def unfold(text: str) -> list[str]:
    """RFC 5545 folds long lines by starting the continuation with a space."""
    lines: list[str] = []
    for raw in text.replace("\r\n", "\n").split("\n"):
        if raw[:1] in (" ", "\t") and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def parse_when(value: str, params: dict[str, str], local: dt.tzinfo):
    """Return (datetime in local time, all_day)."""
    if params.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", value):
        day = dt.datetime.strptime(value[:8], "%Y%m%d")
        return day.replace(tzinfo=local), True
    stamp = dt.datetime.strptime(value[:15], "%Y%m%dT%H%M%S")
    if value.endswith("Z"):
        stamp = stamp.replace(tzinfo=dt.timezone.utc)
    else:
        try:
            zone = zoneinfo.ZoneInfo(params["TZID"]) if "TZID" in params else local
        except (zoneinfo.ZoneInfoNotFoundError, ValueError):
            zone = local
        stamp = stamp.replace(tzinfo=zone)
    return stamp.astimezone(local), False


def parse_events(text: str, local: dt.tzinfo) -> list[dict]:
    events: list[dict] = []
    current: dict | None = None
    for line in unfold(text):
        if line == "BEGIN:VEVENT":
            current = {"exdates": set()}
        elif line == "END:VEVENT":
            if current and "start" in current and current.get("status") != "CANCELLED":
                events.append(current)
            current = None
        elif current is not None and ":" in line:
            head, _, value = line.partition(":")
            name, *raw_params = head.split(";")
            params = dict(p.split("=", 1) for p in raw_params if "=" in p)
            try:
                if name == "SUMMARY":
                    current["title"] = (
                        value.replace("\\,", ",").replace("\\;", ";").replace("\\n", " ").replace("\\\\", "\\")
                    )
                elif name == "DTSTART":
                    current["start"], current["all_day"] = parse_when(value, params, local)
                elif name == "DTEND":
                    current["end"], _ = parse_when(value, params, local)
                elif name == "RRULE":
                    current["rrule"] = dict(p.split("=", 1) for p in value.split(";") if "=" in p)
                elif name == "EXDATE":
                    for item in value.split(","):
                        current["exdates"].add(parse_when(item, params, local)[0])
                elif name == "RECURRENCE-ID":
                    current["override"] = parse_when(value, params, local)[0]
                elif name == "STATUS":
                    current["status"] = value
                elif name == "UID":
                    current["uid"] = value
            except ValueError:
                continue
    return events


def occurrences(event: dict, window_start: dt.datetime, window_end: dt.datetime) -> list[dt.datetime]:
    """Start times of an event inside the window.

    Handles the recurrence shapes a personal calendar actually uses: daily,
    weekly (with BYDAY), monthly on the same day of the month, and yearly,
    each with INTERVAL, UNTIL and COUNT. Anything more exotic shows only its
    first occurrence rather than a guess.
    """
    start: dt.datetime = event["start"]
    rule = event.get("rrule")
    if not rule:
        return [start] if window_start <= start < window_end or (
            event.get("end") and start < window_start < event["end"]) else []

    freq = rule.get("FREQ")
    interval = max(1, int(rule.get("INTERVAL", "1")))
    count = int(rule["COUNT"]) if "COUNT" in rule else None
    until = None
    if "UNTIL" in rule:
        try:
            until = parse_when(rule["UNTIL"], {}, start.tzinfo)[0]
        except ValueError:
            until = None
    by_day = [d[-2:] for d in rule.get("BYDAY", "").split(",") if d[-2:] in WEEKDAYS]

    found: list[dt.datetime] = []
    produced = 0
    day = start
    # A few thousand steps covers a daily event started a decade ago.
    for step in range(5000):
        if freq == "DAILY":
            candidates = [start + dt.timedelta(days=step * interval)]
        elif freq == "WEEKLY":
            week = start - dt.timedelta(days=start.weekday()) + dt.timedelta(weeks=step * interval)
            names = by_day or [WEEKDAYS[start.weekday()]]
            candidates = sorted(week + dt.timedelta(days=WEEKDAYS.index(n)) for n in names)
        elif freq == "MONTHLY" and not by_day:
            month = start.month - 1 + step * interval
            try:
                candidates = [start.replace(year=start.year + month // 12, month=month % 12 + 1)]
            except ValueError:
                candidates = []
        elif freq == "YEARLY":
            try:
                candidates = [start.replace(year=start.year + step * interval)]
            except ValueError:
                candidates = []
        else:
            return [start] if window_start <= start < window_end else []

        for day in candidates:
            if day < start:
                continue
            if until and day > until:
                return found
            produced += 1
            if count and produced > count:
                return found
            if day >= window_end:
                return found
            if day >= window_start and day not in event["exdates"]:
                found.append(day)
    return found


def upcoming(text: str, now: dt.datetime, days: int = CALENDAR_DAYS) -> list[dict]:
    local = now.tzinfo
    window_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    window_end = window_start + dt.timedelta(days=days)
    events = parse_events(text, local)
    # An edited instance of a recurring event replaces the generated one.
    overrides = {(e.get("uid"), e["override"]) for e in events if "override" in e}

    rows: list[dict] = []
    for event in events:
        duration = (event["end"] - event["start"]) if "end" in event else dt.timedelta(hours=1)
        for start in occurrences(event, window_start, window_end):
            if "override" not in event and (event.get("uid"), start) in overrides:
                continue
            end = start + duration
            if end <= now and not event["all_day"]:
                continue
            if event["all_day"] and end <= window_start:
                continue
            rows.append({
                "title": event.get("title", "Busy"),
                "start": start.isoformat(),
                "end": end.isoformat(),
                "allDay": event["all_day"],
            })
    rows.sort(key=lambda row: (row["start"], row["title"]))
    return rows


def calendar(config: dict[str, str], now: dt.datetime):
    urls = [u for u in re.split(r"[\s,]+", config.get("WALLBOARD_ICS_URLS", "")) if u.startswith("https://")]
    if not urls:
        return {"configured": False, "events": []}

    def fetch():
        return "\n".join(http_get(url, timeout=15).decode("utf-8", "replace") for url in urls)

    text = cached("calendar", CALENDAR_TTL, fetch)
    if text is None:
        return {"configured": True, "events": [], "error": "unreachable"}
    return {"configured": True, "events": upcoming(text, now)[:8]}


# --- Bamware -------------------------------------------------------------

def age_text(seconds: float) -> str:
    seconds = max(0, int(seconds))
    if seconds < 90:
        return "just now"
    if seconds < 5400:
        return f"{round(seconds / 60)} min ago"
    if seconds < 36 * 3600:
        return f"{round(seconds / 3600)} h ago"
    return f"{round(seconds / 86400)} d ago"


def probe(now_ts: float):
    folder = STATE / "brewdesk-probe"
    status = read_text(folder / "status")
    row = {"id": "brewdesk", "label": "BrewDesk API", "level": "ok" if status == "up" else "alert"}
    try:
        venues = read_json(folder / "health.json").get("venueCount")
    except (OSError, ValueError):
        venues = None
    if status == "up":
        row["value"] = "Live"
        row["detail"] = f"{venues:,} venues" if isinstance(venues, int) else ""
    else:
        row["value"] = "Down"
        try:
            row["detail"] = "last good " + age_text(now_ts - float(read_text(folder / "last-ok")))
        except (OSError, ValueError):
            row["detail"] = ""
    return row


def systemctl(*args: str) -> str:
    return subprocess.run(  # noqa: S603 - fixed argv
        ["systemctl", "--user", "--no-pager", "--no-legend", *args],
        capture_output=True, text=True, timeout=10, check=False,
    ).stdout


def seats():
    names = {"discord-router": "Discord seat", "assistant-web": "Assistant"}
    states = systemctl("is-active", *names).split()
    down = [label for label, state in zip(names.values(), states) if state != "active"]
    if len(states) != len(names):
        return {"id": "seats", "label": "Agent seats", "value": "Unknown", "detail": "", "level": "unknown"}
    if down:
        return {"id": "seats", "label": "Agent seats", "value": "Down", "detail": ", ".join(down), "level": "alert"}
    return {"id": "seats", "label": "Agent seats", "value": "Online", "detail": "Discord and assistant", "level": "ok"}


def timers():
    failed = [line.split()[1] if line.startswith("●") else line.split()[0]
              for line in systemctl("list-units", "--failed", "--plain").splitlines() if line.strip()]
    total = len([line for line in systemctl("list-timers").splitlines() if line.strip()])
    if failed:
        short = [re.sub(r"^bamware-|\.service$", "", name) for name in failed]
        return {"id": "timers", "label": "Timers", "value": f"{len(failed)} failed",
                "detail": ", ".join(short[:2]), "level": "warn"}
    return {"id": "timers", "label": "Timers", "value": "Healthy", "detail": f"{total} scheduled", "level": "ok"}


def power():
    supply = pathlib.Path("/sys/class/power_supply")
    try:
        on_ac = read_text(supply / "ADP1/online") == "1"
    except OSError:
        return None
    try:
        battery = int(read_text(supply / "BAT0/capacity"))
    except (OSError, ValueError):
        battery = None
    if on_ac:
        return {"id": "power", "label": "Power", "value": "On AC", "detail": "", "level": "ok"}
    detail = f"battery at {battery} of 100" if battery is not None else "charger unplugged"
    return {"id": "power", "label": "Power", "value": "On battery", "detail": detail, "level": "alert"}


def board():
    data = read_json(STATE / "board/latest.json")
    counts: dict[str, int] = {}
    qa: list[str] = []
    for item in data.get("items", []):
        status = item.get("status") or "No status"
        counts[status] = counts.get(status, 0) + 1
        if status == "Ready for QA" and item.get("title"):
            qa.append(item["title"])
    return {
        "readyForQa": counts.get("Ready for QA", 0),
        "inProgress": counts.get("In Progress", 0),
        "todo": counts.get("Todo", 0),
        "qaTitles": qa[:6],
        "fetchedAt": data.get("fetched_at"),
    }


def waiting_on_owner() -> list[str]:
    actions: list[str] = []
    for path in sorted((STATE / "owner-blockers").glob("*.json")):
        try:
            item = read_json(path)
        except (OSError, ValueError):
            continue
        if item.get("status") == "waiting_for_owner" and item.get("ownerAction"):
            actions.append(item["ownerAction"])
    return actions


def allowance(now_ts: float):
    """The weekly Claude pool: the one allowance every seat draws from."""
    pools = read_json(STATE / "cfo/capacity.json").get("pools", [])
    pool = next((p for p in pools if p.get("key") == "claude-max:weekly" and not p.get("stale")), None)
    if not pool:
        return None
    return {
        "label": "Claude weekly allowance",
        "usedOf100": round(pool["used_pct"]),
        "resetHours": max(0, round((pool["reset_at"] - now_ts) / 3600)),
        "level": pool.get("level", "ok"),
    }


def halt():
    path = STATE / "cfo/halt.json"
    if not path.exists():
        return None
    try:
        reason = read_json(path).get("reason", "")
    except (OSError, ValueError):
        reason = ""
    return {"reason": str(reason)[:120]}


# --- media ---------------------------------------------------------------

def run_json(argv: list[str]):
    result = subprocess.run(argv, capture_output=True, text=True, timeout=5, check=False)  # noqa: S603 - fixed argv
    return json.loads(result.stdout) if result.returncode == 0 and result.stdout.strip() else None


def mpris_property(name: str, interface: str, prop: str):
    reply = run_json(["busctl", "--user", "--json=short", "get-property", name,
                      "/org/mpris/MediaPlayer2", interface, prop])
    return reply.get("data") if reply else None


def now_playing():
    """The playing media player that describes its track best, or None.

    Spotify shows up twice: once as itself and once as the Chromium engine
    inside it, which knows only a combined title. The fuller description wins.
    """
    listing = subprocess.run(["busctl", "--user", "--no-legend", "list"],  # noqa: S603, S607
                             capture_output=True, text=True, timeout=5, check=False).stdout
    players = [line.split()[0] for line in listing.splitlines() if line.startswith("org.mpris.MediaPlayer2.")]
    found = [entry for entry in (describe_player(name) for name in players) if entry]
    return max(found, key=lambda e: (bool(e["artist"]), bool(e["art"]), bool(e["title"])), default=None)


def describe_player(name: str):
    """One player's track, or None when it is not playing."""
    if mpris_property(name, "org.mpris.MediaPlayer2.Player", "PlaybackStatus") != "Playing":
        return None
    meta = mpris_property(name, "org.mpris.MediaPlayer2.Player", "Metadata") or {}

    def field(key: str):
        return (meta.get(key) or {}).get("data")

    artists = field("xesam:artist") or []
    art = field("mpris:artUrl") or ""
    return {
        "player": mpris_property(name, "org.mpris.MediaPlayer2", "Identity") or name.rsplit(".", 1)[-1],
        "title": field("xesam:title") or "",
        "artist": ", ".join(artists) if isinstance(artists, list) else str(artists),
        "art": art if art.startswith("https://") else "",
    }


def fullscreen_screens() -> list[str]:
    """Connector names of the displays that have a full-screen window on their visible workspace."""
    monitors = run_json(["hyprctl", "monitors", "-j"]) or []
    clients = run_json(["hyprctl", "clients", "-j"]) or []
    visible = {m["activeWorkspace"]["id"]: m["name"] for m in monitors}
    return sorted({visible[c["workspace"]["id"]] for c in clients
                   if c.get("fullscreen") and c.get("workspace", {}).get("id") in visible})


def media():
    """What is playing, and which screens it owns.

    A screen showing a full-screen window while something plays is a screen
    someone is watching: the board stays off it and covers only the others.
    """
    playing = now_playing()
    if not playing:
        return {"playing": False, "screens": []}
    return {"playing": True, **playing, "screens": fullscreen_screens()}


def attempt(function, *args):
    try:
        return function(*args)
    except Exception:  # noqa: BLE001 - one broken source must not blank the board
        return None


def collect(now: dt.datetime | None = None) -> dict:
    now = now or dt.datetime.now().astimezone()
    now_ts = now.timestamp()
    config = read_config()
    systems = [attempt(probe, now_ts), attempt(seats), attempt(timers), attempt(power)]
    return {
        "generatedAt": now.isoformat(),
        "name": config.get("WALLBOARD_NAME", "Bilal"),
        "theme": theme(),
        "weather": attempt(weather, config),
        "calendar": attempt(calendar, config, now) or {"configured": False, "events": []},
        "systems": [row for row in systems if row],
        "board": attempt(board),
        "waitingOnYou": attempt(waiting_on_owner) or [],
        "allowance": attempt(allowance, now_ts),
        "halt": attempt(halt),
        "presence": attempt(read_text, STATE / "presence.state"),
        "media": attempt(media) or {"playing": False, "screens": []},
    }


def main() -> int:
    document = json.dumps(collect(), indent=1)
    try:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        write_atomic(OUT_DIR / "data.json", document)
    except OSError as error:
        print(f"wallboard: could not write data.json: {error}", file=sys.stderr)
    print(document)
    return 0


if __name__ == "__main__":
    sys.exit(main())
