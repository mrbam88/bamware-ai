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
  samsung_tv.py sources                the TV's own source list by name, current one marked (SmartThings)
  samsung_tv.py source <name>          select a source by its label ("PC", "xbox") and read it back; exit 1 if the
                                       TV did not confirm. Use this, never counted KEY_SOURCE presses: the list reorders
SmartThings is the only path that can READ the TV's sources. It goes through Samsung's CLI (`smartthings`, npm
@smartthings/cli, signed in once in a browser, renews itself); ~/.config/bamware/smartthings.token is a 24 h fallback.
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

ST_TOK = os.path.expanduser("~/.config/bamware/smartthings.token")
ST_DEV = os.path.expanduser("~/.local/state/bamware/samsung_tv.smartthings-device")
ST_CAP = "samsungvd.mediaInputSource"

ST_NODE = os.path.expanduser("~/.local/share/mise/installs/node/latest/bin")
ST_CLI = os.path.join(ST_NODE, "smartthings")

def st_cli(*args):
    """Run Samsung's own CLI. Its browser sign-in renews itself, which a personal token (24 h) cannot do, and
    registering our own OAuth app needs a paid developer plan (2026-11-26). None when the CLI is not installed."""
    import subprocess
    if not os.path.exists(ST_CLI): return None
    env = dict(os.environ, PATH=ST_NODE + ":" + os.environ.get("PATH", "/usr/bin"))   # timers and buttons.service have a bare PATH
    try: r = subprocess.run([ST_CLI, *args], capture_output=True, text=True, timeout=40, env=env, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise RuntimeError("SmartThings sign-in has lapsed (the CLI is waiting for a browser login): run `smartthings devices` in a terminal on the server once")
    if r.returncode != 0: raise RuntimeError("SmartThings CLI failed: " + (r.stderr or r.stdout).strip()[-200:])
    return r.stdout

def st(path, body=None):
    """One SmartThings call: through the signed-in CLI when it is there, else the personal token.
    Raises RuntimeError with a sentence Bilal can act on."""
    import urllib.error
    parts = path.strip("/").split("/")
    if body: out = st_cli("devices:commands", parts[1], *[f"{c['component']}:{c['capability']}:{c['command']}({json.dumps(c['arguments'])[1:-1]})" for c in body["commands"]][:1])
    elif len(parts) == 3: out = st_cli("devices:status", parts[1], "-j")
    else: out = st_cli("devices", "-j")
    if out is not None:
        if body: return {}
        data = json.loads(out); return {"items": data} if isinstance(data, list) else data
    if not os.path.exists(ST_TOK): raise RuntimeError(f"no SmartThings CLI at {ST_CLI} and no token at {ST_TOK}")
    req = urllib.request.Request("https://api.smartthings.com/v1" + path, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": "Bearer " + open(ST_TOK).read().strip(), "Content-Type": "application/json"},
                                 method="POST" if body else "GET")
    try: return json.loads(urllib.request.urlopen(req, timeout=15).read() or b"{}")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403): raise RuntimeError("SmartThings refused the token (expired or missing device scopes): make a new one at account.smartthings.com/tokens")
        raise RuntimeError(f"SmartThings answered {e.code}: {e.read().decode()[:200]}")
    except OSError as e: raise RuntimeError(f"SmartThings unreachable ({e})")

def st_device():
    """The TV's SmartThings id: found once by capability, then remembered."""
    if os.path.exists(ST_DEV): return open(ST_DEV).read().strip()
    for d in st("/devices").get("items", []):
        if any(c["id"] == ST_CAP for comp in d.get("components", []) for c in comp.get("capabilities", [])):
            os.makedirs(os.path.dirname(ST_DEV), exist_ok=True); open(ST_DEV, "w").write(d["deviceId"]); return d["deviceId"]
    raise RuntimeError("no TV with a source list in this SmartThings account: add the Samsung in the SmartThings app")

def st_sources():
    """([{id, name}, ...], current id) as the TV reports them right now."""
    cap = st(f"/devices/{st_device()}/status").get("components", {}).get("main", {}).get(ST_CAP, {})
    return cap.get("supportedInputSourcesMap", {}).get("value") or [], cap.get("inputSource", {}).get("value")

def pick_source(sources, want):
    """Match Bilal's word to a source: exact label or id first, then a label that contains it."""
    w = want.strip().lower()
    exact = [s for s in sources if w in (s["name"].lower(), s["id"].lower())]
    return (exact or [s for s in sources if w in s["name"].lower()] or [None])[0]

def set_source(want):
    sources, current = st_sources()
    target = pick_source(sources, want)
    if not target:
        print(f"no source called '{want}'; the TV lists: " + ", ".join(s["name"] for s in sources), file=sys.stderr); return 1
    if current != target["id"]:
        st(f"/devices/{st_device()}/commands", {"commands": [{"component": "main", "capability": ST_CAP, "command": "setInputSource", "arguments": [target["id"]]}]})
        for _ in range(6):
            time.sleep(1.5); current = st_sources()[1]
            if current == target["id"]: break
    if current != target["id"]:
        print(f"TV did not confirm '{target['name']}' (it reports {current})", file=sys.stderr); return 1
    print(f"samsung: on {target['name']} ({target['id']}), confirmed by the TV"); return 0

def main(a):
    if not a: print(__doc__.strip()); return 1
    if a[0] in ("sources", "source"):
        try:
            if a[0] == "source" and len(a) > 1: return set_source(" ".join(a[1:]))
            sources, current = st_sources()
            for s in sources: print(("* " if s["id"] == current else "  ") + f"{s['name']} ({s['id']})")
            return 0
        except RuntimeError as e: print(f"samsung: {e}", file=sys.stderr); return 1
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
