#!/usr/bin/env python3
"""Daylight-tracking lights for Bilal's apartment (runs on omarchy from daylight.timer, every 20 min 13:00-19:20).

Bilal (2026-10-29, 19:10, afternoon preset still on an hour after sunset): "it's ridiculously bright in here.
Adjust the lighting based on the daylight." So: compute the sun's elevation over Greenwich Village (no network,
no key), interpolate brightness and colour temperature between keyframes, apply over the LAN (TV backlight via
cloud). The morning (08:00) and evening (19:30) vibes own their windows; this owns the slide from bright
afternoon to dusk. Night keyframe = the evening/soothing palette he liked (amber, peach, rust accent; no blue, no red/green pairs).

  daylight.py            compute and apply
  daylight.py --dry      print what it would do
  daylight.py --at 17:30 compute for another time today (with --dry to preview)

Skips while presence says away, and for 3 h after anyone touches ~/.local/state/bamware/lights.hold
(touch it after a manual scene so this does not fight it; vibes.sh evening touches it too).
"""
import json, math, os, sys, time, urllib.request
from datetime import datetime, timezone, timedelta
sys.path.insert(0, os.path.expanduser("~/.local/bin")); import govee_lan as gl

LAT, LON = 40.7336, -73.9995          # Greenwich Village
S = os.path.expanduser("~/.local/state/bamware")
TVB = ("H6099", "1C:CF:D4:0F:40:46:18:6A"); API = "https://openapi.api.govee.com/router/api/v1"
DRY = "--dry" in sys.argv

def sun_elevation(dt_utc):
    """Solar elevation in degrees (NOAA low-precision algorithm, good to ~0.5 deg)."""
    doy = dt_utc.timetuple().tm_yday; hour = dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600
    g = math.radians((360 / 365.25) * (doy - 1 + (hour - 12) / 24))
    eqtime = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g) - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    decl = 0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g) + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g)
    tst = (hour * 60 + eqtime + 4 * LON) % 1440
    ha = math.radians(tst / 4 - 180)
    lat = math.radians(LAT)
    cos_z = math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.cos(ha)
    return math.degrees(math.asin(max(-1, min(1, cos_z))))

# keyframes by elevation: (elev, kelvin or None, lamp%, bulbs%, strip%, tv backlight%)  kelvin None = night palette (rgb)
KEYS = [
    (-8,  None, 18, 8,  6,  30),   # night: peach lamp, amber bulbs and strip, rust TV wall (fall palette, 2026-10-29: blue is alert-only)
    (-3,  2700, 28, 10, 10, 25),   # civil dusk
    (0,   2900, 40, 14, 20, 20),   # sunset
    (6,   3300, 55, 20, 35, 15),   # golden hour
    (15,  3900, 80, 30, 55, 10),   # late afternoon
    (25,  4500, 100, 40, 70, 0),   # full day (the afternoon preset)
]
NIGHT = {"lamp": (255, 170, 100), "bulbs": (255, 140, 40), "strip": (255, 140, 40), "tvb": (190, 60, 15)}

def lerp(a, b, t): return a + (b - a) * t
def target(elev):
    if elev <= KEYS[0][0]: return KEYS[0]
    if elev >= KEYS[-1][0]: return KEYS[-1]
    for lo, hi in zip(KEYS, KEYS[1:]):
        if lo[0] <= elev <= hi[0]:
            t = (elev - lo[0]) / (hi[0] - lo[0])
            k = None if lo[1] is None and t < 0.5 else int(lerp(lo[1] or hi[1], hi[1], t))
            return (elev, k) + tuple(int(round(lerp(lo[i], hi[i], t))) for i in range(2, 6))

def cloud(path, payload):
    key = [l.split("=", 1)[1].strip() for l in open(os.path.expanduser("~/.config/bamware/govee.env")) if l.startswith("GOVEE_API_KEY=")][0]
    req = urllib.request.Request(f"{API}/{path}", json.dumps({"requestId": "daylight", "payload": payload}).encode(), {"Govee-API-Key": key, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=8))
    except Exception as e: return {"error": str(e)[:60]}
def tvb(inst, typ, val): return cloud("device/control", {"sku": TVB[0], "device": TVB[1], "capability": {"type": typ, "instance": inst, "value": val}})

def main():
    now = datetime.now().astimezone()
    if "--at" in sys.argv:
        h, m = sys.argv[sys.argv.index("--at") + 1].split(":"); now = now.replace(hour=int(h), minute=int(m), second=0)
    elev = sun_elevation(now.astimezone(timezone.utc))
    _, k, lamp, bulbs, strip, tv = target(elev)
    desc = f"{now:%H:%M} sun {elev:+.1f} deg -> {'night palette' if k is None else str(k)+'K'}, lamp {lamp}%, bulbs {bulbs}%, strip {strip}%, TV wall {tv}%"
    if DRY: print(desc); return 0
    try:
        if open(f"{S}/presence.state").read().strip() == "away": print(f"{desc} | skipped: away"); return 0
    except FileNotFoundError: pass
    hold = f"{S}/lights.hold"
    if os.path.exists(hold) and time.time() - os.path.getmtime(hold) < 3 * 3600: print(f"{desc} | skipped: lights.hold is fresh"); return 0
    devs = gl.scan(3.0)
    def setlight(sub, pct, rgb):
        for d in gl.resolve(sub, devs):
            gl.send(d["ip"], "turn", {"value": 1}); time.sleep(0.1)
            if k: gl.send(d["ip"], "colorwc", {"color": {"r": 0, "g": 0, "b": 0}, "colorTemInKelvin": k})
            else: gl.send(d["ip"], "colorwc", {"color": {"r": rgb[0], "g": rgb[1], "b": rgb[2]}, "colorTemInKelvin": 0})
            time.sleep(0.1); gl.send(d["ip"], "brightness", {"value": pct}); time.sleep(0.1)
    setlight("uplighter", lamp, NIGHT["lamp"]); setlight("smart led bulb", bulbs, NIGHT["bulbs"]); setlight("strip", strip, NIGHT["strip"])
    if tv == 0: tvb("powerSwitch", "devices.capabilities.on_off", 0)
    else:
        tvb("powerSwitch", "devices.capabilities.on_off", 1)
        if k: tvb("colorTemperatureK", "devices.capabilities.color_setting", max(2000, min(9000, k)))
        else: r, g, b = NIGHT["tvb"]; tvb("colorRgb", "devices.capabilities.color_setting", (r << 16) + (g << 8) + b)
        tvb("brightness", "devices.capabilities.range", tv)
    print(f"{desc} | applied to {len(devs)} LAN lights + TV wall")
    return 0

if __name__ == "__main__": sys.exit(main())
