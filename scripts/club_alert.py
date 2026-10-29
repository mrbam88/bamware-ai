#!/usr/bin/env python3
"""Too-loud feedback loop for Bilal's apartment (runs on omarchy from roomlevel.sh).
Every light goes club blue for 10 s, the stereo steps down 15%, Discord gets a "turn it down"
alert, then the lights restore to what they were. `--test` skips the volume step and marks the alert as a test.

2026-10-29 hardening, after a desk bulb stayed club blue at 100%:
- the snapshot only trusts a status reply that came FROM the light being asked (the reply socket is
  shared, so an unchecked recvfrom could hand light A the state of light B);
- the restore is verified by re-reading each light and retried up to 3 times (LAN control is UDP,
  fire-and-forget, and the 2.4 GHz lights drop packets).
"""
import json, os, socket, subprocess, sys, time, urllib.request
sys.path.insert(0, os.path.expanduser("~/.local/bin")); import govee_lan as gl
TEST = "--test" in sys.argv; level = next((a for a in sys.argv[1:] if not a.startswith("--")), "?")
ENV = {**os.environ, "XDG_RUNTIME_DIR": "/run/user/1000", "DBUS_SESSION_BUS_ADDRESS": "unix:path=/run/user/1000/bus"}
KEY = [l.split("=", 1)[1].strip() for l in open(os.path.expanduser("~/.config/bamware/govee.env")) if l.startswith("GOVEE_API_KEY=")][0]
TVB = ("H6099", "1C:CF:D4:0F:40:46:18:6A"); API = "https://openapi.api.govee.com/router/api/v1"
CLUB = {"r": 0, "g": 80, "b": 255}

def cloud(path, payload):
    req = urllib.request.Request(f"{API}/{path}", json.dumps({"requestId": "club", "payload": payload}).encode(), {"Govee-API-Key": KEY, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=8))
    except Exception as e: return {"error": str(e)[:60]}
def tvb_set(inst, typ, val): cloud("device/control", {"sku": TVB[0], "device": TVB[1], "capability": {"type": typ, "instance": inst, "value": val}})

def read_state(ip, s, r, tries=3):
    """devStatus from exactly this light: drain stale replies, then accept only a reply whose sender is ip."""
    for _ in range(tries):
        r.settimeout(0.05)
        try:
            while True: r.recvfrom(4096)
        except socket.timeout: pass
        r.settimeout(1.5)
        s.sendto(json.dumps({"msg": {"cmd": "devStatus", "data": {}}}).encode(), (ip, gl.CMD_PORT))
        t0 = time.time()
        while time.time() - t0 < 1.5:
            try: d, a = r.recvfrom(4096)
            except socket.timeout: break
            if a[0] == ip:
                try: return json.loads(d)["msg"]["data"]
                except Exception: break
    return None

def want(st):
    """The restore target for one light, from its snapshot."""
    c = st.get("color") or {}; k = st.get("colorTemInKelvin") or 0
    color = {"r": 0, "g": 0, "b": 0} if k else {"r": c.get("r", 255), "g": c.get("g", 140), "b": c.get("b", 40)}
    return {"color": color, "k": k, "bright": st.get("brightness", 50), "on": st.get("onOff", 1)}

def apply(ip, w):
    gl.send(ip, "colorwc", {"color": w["color"], "colorTemInKelvin": w["k"]}); time.sleep(0.15)
    gl.send(ip, "brightness", {"value": w["bright"]}); time.sleep(0.15)
    gl.send(ip, "turn", {"value": w["on"]}); time.sleep(0.15)

def matches(st, w):
    if st is None: return False
    if (st.get("onOff", 1) != w["on"]): return False
    if not w["on"]: return True                      # an off light's colour does not matter
    if st.get("brightness") != w["bright"]: return False
    if w["k"]: return (st.get("colorTemInKelvin") or 0) == w["k"]
    c = st.get("color") or {}
    return all(abs(c.get(x, -99) - w["color"][x]) <= 2 for x in ("r", "g", "b"))

# 1. snapshot
s, r = gl.sockets(2.0); devs = gl.scan(3.0); before = {}
for d in devs:
    st = read_state(d["ip"], s, r)
    if st is None: print(f"club alert: {d['name']} ({d['ip']}) gave no status, leaving it alone"); continue
    if (st.get("color") or {}) == CLUB and st.get("brightness") == 100:
        print(f"club alert: {d['name']} is already club blue (stale from a previous alert), leaving it alone"); continue
    before[d["ip"]] = (d, st)
tv = cloud("device/state", {"sku": TVB[0], "device": TVB[1]}); caps = {c["instance"]: c["state"]["value"] for c in tv.get("payload", {}).get("capabilities", [])}
# 2. club blue
for ip, (d, st) in before.items():
    gl.send(ip, "turn", {"value": 1}); gl.send(ip, "colorwc", {"color": CLUB, "colorTemInKelvin": 0}); gl.send(ip, "brightness", {"value": 100}); time.sleep(0.15)
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
# 4. restore, verified
ok, bad = [], []
for ip, (d, st) in before.items():
    w = want(st); done = False
    for attempt in range(3):
        apply(ip, w); time.sleep(0.6)
        if matches(read_state(ip, s, r), w): done = True; break
    (ok if done else bad).append(f"{d['name']}{'' if done else ' (unverified after 3 tries)'}")
if caps:
    if caps.get("colorTemperatureK"): tvb_set("colorTemperatureK", "devices.capabilities.color_setting", caps["colorTemperatureK"])
    elif caps.get("colorRgb") is not None: tvb_set("colorRgb", "devices.capabilities.color_setting", caps["colorRgb"])
    tvb_set("brightness", "devices.capabilities.range", caps.get("brightness", 20)); tvb_set("powerSwitch", "devices.capabilities.on_off", caps.get("powerSwitch", 0))
print(f"club alert done: {len(ok)} LAN lights verified restored{(' , NOT verified: ' + ', '.join(bad)) if bad else ''} + TV backlight; {vol_msg}")
if bad:
    subprocess.run(["bash", os.path.expanduser("~/code/bamware-ai/scripts/discord-post.sh"), f"⚠️ Club alert: could not confirm restore for {', '.join(bad)}. Check for a light left blue."], capture_output=True, text=True, env=ENV)
