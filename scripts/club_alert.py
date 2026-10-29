#!/usr/bin/env python3
"""Too-loud feedback loop for Bilal's apartment (runs on omarchy from roomlevel.sh).
Every light goes club blue for 10 s, the stereo steps down 15%, Discord gets a "turn it down"
alert, then the lights restore to what they were. `--test` skips the volume step and marks the alert as a test.
"""
import json, os, subprocess, sys, time, urllib.request
sys.path.insert(0, os.path.expanduser("~/.local/bin")); import govee_lan as gl
TEST = "--test" in sys.argv; level = next((a for a in sys.argv[1:] if not a.startswith("--")), "?")
ENV = {**os.environ, "XDG_RUNTIME_DIR": "/run/user/1000", "DBUS_SESSION_BUS_ADDRESS": "unix:path=/run/user/1000/bus"}
KEY = [l.split("=", 1)[1].strip() for l in open(os.path.expanduser("~/.config/bamware/govee.env")) if l.startswith("GOVEE_API_KEY=")][0]
TVB = ("H6099", "1C:CF:D4:0F:40:46:18:6A"); API = "https://openapi.api.govee.com/router/api/v1"
def cloud(path, payload):
    req = urllib.request.Request(f"{API}/{path}", json.dumps({"requestId": "club", "payload": payload}).encode(), {"Govee-API-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=8))
    except Exception as e: return {"error": str(e)[:60]}
def tvb_set(inst, typ, val): cloud("device/control", {"sku": TVB[0], "device": TVB[1], "capability": {"type": typ, "instance": inst, "value": val}})
# 1. snapshot
s, r = gl.sockets(2.0); devs = gl.scan(3.0); before = {}
for d in devs:
    st = gl.send(d["ip"], "devStatus", {}, s, r, True) or {}; before[d["ip"]] = (d, st)
tv = cloud("device/state", {"sku": TVB[0], "device": TVB[1]}); caps = {c["instance"]: c["state"]["value"] for c in tv.get("payload", {}).get("capabilities", [])}
# 2. club blue
for ip, (d, st) in before.items():
    gl.send(ip, "turn", {"value": 1}); gl.send(ip, "colorwc", {"color": {"r": 0, "g": 80, "b": 255}, "colorTemInKelvin": 0}); gl.send(ip, "brightness", {"value": 100}); time.sleep(0.15)
tvb_set("powerSwitch", "devices.capabilities.on_off", 1); tvb_set("colorRgb", "devices.capabilities.color_setting", (0 << 16) + (80 << 8) + 255); tvb_set("brightness", "devices.capabilities.range", 100)
# 3. stereo down + alert
vol_msg = "test run, volume untouched"
if not TEST:
    try:
        v = float(subprocess.run(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"], capture_output=True, text=True, env=ENV).stdout.split()[1]); nv = max(0.2, round(v - 0.15, 2))
        subprocess.run(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", str(nv)], env=ENV); vol_msg = f"stereo {int(v*100)}% -> {int(nv*100)}%"
    except Exception as e: vol_msg = f"volume step failed: {e}"
msg = f"🔵 {'TEST: ' if TEST else ''}Too loud. The wall mic reads {level} dBFS. The neighbours can hear. {vol_msg}. Lights went club blue for 10 s."
subprocess.run(["bash", os.path.expanduser("~/code/bamware-ai/scripts/discord-post.sh"), msg], capture_output=True, text=True, env=ENV)
time.sleep(10)
# 4. restore
for ip, (d, st) in before.items():
    c = st.get("color") or {}; k = st.get("colorTemInKelvin") or 0
    if k: gl.send(ip, "colorwc", {"color": {"r": 0, "g": 0, "b": 0}, "colorTemInKelvin": k})
    else: gl.send(ip, "colorwc", {"color": {"r": c.get("r", 255), "g": c.get("g", 140), "b": c.get("b", 40)}, "colorTemInKelvin": 0})
    time.sleep(0.15); gl.send(ip, "brightness", {"value": st.get("brightness", 50)}); time.sleep(0.15); gl.send(ip, "turn", {"value": st.get("onOff", 1)})
if caps:
    if caps.get("colorTemperatureK"): tvb_set("colorTemperatureK", "devices.capabilities.color_setting", caps["colorTemperatureK"])
    elif caps.get("colorRgb") is not None: tvb_set("colorRgb", "devices.capabilities.color_setting", caps["colorRgb"])
    tvb_set("brightness", "devices.capabilities.range", caps.get("brightness", 20)); tvb_set("powerSwitch", "devices.capabilities.on_off", caps.get("powerSwitch", 0))
print(f"club alert done: {len(before)} LAN lights + TV backlight restored; {vol_msg}")
