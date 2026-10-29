#!/usr/bin/env python3
"""Bilal's living-room Samsung QN90B (65", Tizen) from omarchy. Needs ~/.venvs/smarthome (websocket-client).

  samsung_tv.py status                 power state + model (REST :8001, no auth)
  samsung_tv.py wake                   Wake-on-LAN (it answers within ~5 s)
  samsung_tv.py key KEY_HOME [KEY_...] remote keys: KEY_POWER KEY_VOLUP KEY_VOLDOWN KEY_MUTE KEY_HOME
                                       KEY_RETURN KEY_ENTER KEY_UP/DOWN/LEFT/RIGHT KEY_HDMI KEY_SOURCE KEY_MENU
  samsung_tv.py app <id|name>          launch app via REST (Netflix 11101200001, YouTube 111299001912,
                                       Spotify 3201606009684, Prime 3201910019365, Disney+ 3201901017640)
Token from the one-time "Allow Bamware?" prompt lives in ~/.config/bamware/samsung_tv.token (600).
"""
import base64, json, os, socket, ssl, sys, time, urllib.request
IP, MAC = "192.168.1.152", "e09d136af20c"
APPS = {"netflix": "11101200001", "youtube": "111299001912", "spotify": "3201606009684", "prime": "3201910019365", "disney": "3201901017640"}
TOK = os.path.expanduser("~/.config/bamware/samsung_tv.token")

def rest(path, method="GET"):
    req = urllib.request.Request(f"http://{IP}:8001/api/v2/{path}", method=method)
    return json.load(urllib.request.urlopen(req, timeout=5))

def wake():
    pkt = b"\xff" * 6 + bytes.fromhex(MAC) * 16
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    for _ in range(3):
        for dst in ("192.168.1.255", "255.255.255.255", IP): s.sendto(pkt, (dst, 9))
        time.sleep(0.3)

def keys(names):
    import websocket
    tok = open(TOK).read().strip() if os.path.exists(TOK) else ""
    name = base64.b64encode(b"Bamware").decode()
    ws = websocket.create_connection(f"wss://{IP}:8002/api/v2/channels/samsung.remote.control?name={name}&token={tok}", sslopt={"cert_reqs": ssl.CERT_NONE}, timeout=30)
    r = json.loads(ws.recv())
    if r.get("data", {}).get("token"):
        open(TOK, "w").write(r["data"]["token"]); os.chmod(TOK, 0o600)
    for k in names:
        ws.send(json.dumps({"method": "ms.remote.control", "params": {"Cmd": "Click", "DataOfCmd": k, "Option": "false", "TypeOfRemote": "SendRemoteKey"}})); time.sleep(0.4)
    ws.close(); return r.get("event")

def main(a):
    if not a: print(__doc__.strip()); return 1
    if a[0] == "status":
        try: d = rest("")["device"]; print(f"{d.get('name')} ({d.get('modelName')}): power {d.get('PowerState')}")
        except Exception as e: print(f"standby or unreachable ({type(e).__name__}); try: samsung_tv.py wake")
    elif a[0] == "wake": wake(); print("wol sent")
    elif a[0] == "key": print("keys sent,", keys(a[1:]))
    elif a[0] == "app":
        app = APPS.get(a[1].lower(), a[1]); req = urllib.request.Request(f"http://{IP}:8001/api/v2/applications/{app}", method="POST")
        print("launch:", urllib.request.urlopen(req, timeout=8).status)
    return 0

if __name__ == "__main__": sys.exit(main(sys.argv[1:]))
