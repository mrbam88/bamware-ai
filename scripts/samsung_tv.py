#!/usr/bin/env python3
"""Bilal's living-room Samsung QN90B (65", Tizen) from omarchy. Needs ~/.venvs/smarthome (websocket-client).

  samsung_tv.py status                 power state + model (REST :8001, no auth)
  samsung_tv.py wake                   Wake-on-LAN (it answers within ~5 s)
  samsung_tv.py key KEY_HOME [KEY_...] remote keys: KEY_POWER KEY_VOLUP KEY_VOLDOWN KEY_MUTE KEY_HOME
                                       KEY_RETURN KEY_ENTER KEY_UP/DOWN/LEFT/RIGHT KEY_HDMI KEY_SOURCE KEY_MENU
  samsung_tv.py app <id|name>          launch app via REST (Netflix 11101200001, YouTube 111299001912,
                                       Spotify 3201606009684, Prime 3201910019365, Disney+ 3201901017640)
  samsung_tv.py appletv                TV on and on the Apple TV input: Apple TV turn_on first (HDMI-CEC does the
                                       rest when ~/.config/bamware/samsung_cec exists), else one-socket HOME, SOURCE x2
  samsung_tv.py off                    Apple TV turn_off first; KEY_POWER only if the panel is still on 8 s later
Token from the one-time "Allow Bamware?" prompt lives in ~/.config/bamware/samsung_tv.token (600).
Every websocket connect is a chance for the TV to ask "Allow Bamware?" again, so send a whole key
sequence over ONE socket and prefer the Apple TV (CEC) path, which never touches the websocket.
"""
import base64, json, os, socket, ssl, sys, time, urllib.request
IP, MAC = "192.168.1.152", "e09d136af20c"
APPS = {"netflix": "11101200001", "youtube": "111299001912", "spotify": "3201606009684", "prime": "3201910019365", "disney": "3201901017640"}
TOK = os.path.expanduser("~/.config/bamware/samsung_tv.token")
CEC = os.path.expanduser("~/.config/bamware/samsung_cec")   # touch it once Bilal has verified Anynet+ follows the Apple TV
ATV = [os.path.expanduser("~/.venvs/smarthome/bin/python"), os.path.expanduser("~/.local/bin/appletv.py")]

def appletv_key(k):
    import subprocess
    try: subprocess.run(ATV + ["key", k], capture_output=True, timeout=30)
    except Exception: pass

def power():
    try: return rest("")["device"].get("PowerState", "unknown")
    except Exception: return "standby"

def rest(path, method="GET"):
    req = urllib.request.Request(f"http://{IP}:8001/api/v2/{path}", method=method)
    return json.load(urllib.request.urlopen(req, timeout=5))

def wake():
    pkt = b"\xff" * 6 + bytes.fromhex(MAC) * 16
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    for _ in range(3):
        for dst in ("192.168.1.255", "255.255.255.255", IP): s.sendto(pkt, (dst, 9))
        time.sleep(0.3)

def keys(names, gap=0.4):
    import websocket
    tok = open(TOK).read().strip() if os.path.exists(TOK) else ""
    name = base64.b64encode(b"Bamware").decode()
    r = None
    for attempt in range(3):   # right after wake the remote channel can accept the socket and then say nothing; reconnect instead of hanging 30 s
        try:
            ws = websocket.create_connection(f"wss://{IP}:8002/api/v2/channels/samsung.remote.control?name={name}&token={tok}", sslopt={"cert_reqs": ssl.CERT_NONE}, timeout=10)
            r = json.loads(ws.recv()); break
        except Exception as e:
            try: ws.close()
            except Exception: pass
            if attempt == 2: raise
            time.sleep(2)
    if r.get("data", {}).get("token"):
        open(TOK, "w").write(r["data"]["token"]); os.chmod(TOK, 0o600)
    for k in names:
        ws.send(json.dumps({"method": "ms.remote.control", "params": {"Cmd": "Click", "DataOfCmd": k, "Option": "false", "TypeOfRemote": "SendRemoteKey"}})); time.sleep(gap)
    ws.close(); return r.get("event")

def main(a):
    if not a: print(__doc__.strip()); return 1
    if a[0] == "status":
        try: d = rest("")["device"]; print(f"{d.get('name')} ({d.get('modelName')}): power {d.get('PowerState')}")
        except Exception as e: print(f"standby or unreachable ({type(e).__name__}); try: samsung_tv.py wake")
    elif a[0] == "wake": wake(); print("wol sent")
    elif a[0] == "off":
        appletv_key("turn_off")
        for _ in range(4):
            time.sleep(2)
            if power() != "on": print("off via Apple TV (CEC)"); return 0
        print("off via KEY_POWER,", keys(["KEY_POWER"]))
    elif a[0] == "appletv":
        # Wake and land on the Apple TV's input without CEC. KEY_HDMIn is ignored on the QN90B; KEY_SOURCE cycles
        # home -> Xbox -> Apple TV (Bilal verified 2026-10-30). KEY_HOME first so the cycle starts from a known place.
        # 2026-10-30 morning: the panel woke on Live TV and the news played to nobody; this is the fix.
        wake(); appletv_key("turn_on")
        for _ in range(8):
            time.sleep(2)
            if power() == "on": break
        if os.path.exists(CEC): print("samsung: on, input follows the Apple TV (CEC)"); return 0
        time.sleep(3); keys(["KEY_HOME", "KEY_SOURCE", "KEY_SOURCE"], gap=2.5)
        print("samsung: awake, home, source x2 -> Apple TV (one socket)")
    elif a[0] == "key": print("keys sent,", keys(a[1:]))
    elif a[0] == "app":
        app = APPS.get(a[1].lower(), a[1]); req = urllib.request.Request(f"http://{IP}:8001/api/v2/applications/{app}", method="POST")
        print("launch:", urllib.request.urlopen(req, timeout=8).status)
    return 0

if __name__ == "__main__": sys.exit(main(sys.argv[1:]))
