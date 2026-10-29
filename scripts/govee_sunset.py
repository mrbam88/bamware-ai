#!/usr/bin/env python3
"""Slow sunset: every Govee light drifts amber -> lavender over MINUTES. Runs on omarchy.

  python3 scripts/govee_sunset.py [minutes]      default 20; run detached:
  setsid -f bash -c "python3 ~/tmp/govee_sunset.py > ~/tmp/sunset.log 2>&1"
Bilal's "slow Sunset" scene (2026-10-29): lamp ripple 70% -> 40%, strip 6 -> 4,
desk bulbs 4 -> 2 and 2 -> 1, TV backlight 15 -> 10 (cloud). LAN for the rest.
Sends colour then brightness, so it also cancels any running Govee scene.
"""
import json, os, socket, subprocess, sys, time, urllib.request
MINUTES = float(sys.argv[1]) if len(sys.argv) > 1 else 20
STEPS = 40
A, Z = (255, 140, 40), (110, 70, 200)
LAN = {"192.168.1.166": ("lamp", 70, 40), "192.168.1.167": ("strip", 6, 4), "192.168.1.161": ("bulb", 4, 2), "192.168.1.162": ("bulbtop", 2, 1)}
TV = ("H6099", "1C:CF:D4:0F:40:46:18:6A", 15, 10)
key = [l.split("=", 1)[1].strip() for l in open(os.path.expanduser("~/.config/bamware/govee.env")) if l.startswith("GOVEE_API_KEY=")][0]
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
def lan(ip, cmd, data): s.sendto(json.dumps({"msg": {"cmd": cmd, "data": data}}).encode(), (ip, 4001))
def cloud(sku, dev, typ, inst, val):
    body = json.dumps({"requestId": "sunset", "payload": {"sku": sku, "device": dev, "capability": {"type": typ, "instance": inst, "value": val}}}).encode()
    req = urllib.request.Request("https://openapi.api.govee.com/router/api/v1/device/control", body, {"Govee-API-Key": key, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=10)).get("code")
    except Exception as e: return str(e)[:40]
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
for i in range(STEPS + 1):
    t = i / STEPS; r, g, b = mix(A, Z, t)
    for ip, (name, b0, b1) in LAN.items():
        lan(ip, "colorwc", {"color": {"r": r, "g": g, "b": b}, "colorTemInKelvin": 0}); time.sleep(0.2)
        lan(ip, "brightness", {"value": round(b0 + (b1 - b0) * t)}); time.sleep(0.2)
    c = cloud(TV[0], TV[1], "devices.capabilities.color_setting", "colorRgb", (r << 16) + (g << 8) + b)
    cloud(TV[0], TV[1], "devices.capabilities.range", "brightness", round(TV[2] + (TV[3] - TV[2]) * t))
    print(f"{time.strftime('%H:%M:%S')} step {i}/{STEPS} rgb({r},{g},{b}) tv={c}", flush=True)
    if i < STEPS: time.sleep(MINUTES * 60 / STEPS)
print("sunset done", flush=True)
