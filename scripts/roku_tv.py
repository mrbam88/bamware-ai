#!/usr/bin/env python3
"""Bilal's bedroom 55" TCL Roku TV from omarchy. Roku ECP on :8060, no auth.

  roku_tv.py status                     power + active app
  roku_tv.py on | off                   PowerOn / PowerOff keypress
  roku_tv.py key Home [Back Select Up Down Left Right Play VolumeUp VolumeDown VolumeMute ...]
  roku_tv.py app <name>                 launch by app name substring (netflix, youtube, spotify, ...)
  roku_tv.py apps
"""
import sys, urllib.request, re
R = "http://192.168.1.93:8060"
def get(p): return urllib.request.urlopen(R + p, timeout=5).read().decode()
def post(p): return urllib.request.urlopen(urllib.request.Request(R + p, method="POST"), timeout=5).status
def main(a):
    if not a: print(__doc__.strip()); return 1
    if a[0] == "status":
        pm = re.search(r"<power-mode>([^<]*)", get("/query/device-info")); ap = re.search(r"<app[^>]*>([^<]*)", get("/query/active-app"))
        print(f"power {pm.group(1) if pm else '?'}, app {ap.group(1) if ap else '?'}")
    elif a[0] in ("on", "off"): print(a[0], post("/keypress/Power" + a[0].capitalize()))
    elif a[0] == "key":
        for k in a[1:]: print(k, post("/keypress/" + k))
    elif a[0] == "apps": print("\n".join(re.findall(r"<app id=\"(\d+)\"[^>]*>([^<]*)", get("/query/apps")).__str__()))
    elif a[0] == "app":
        apps = re.findall(r"<app id=\"(\d+)\"[^>]*>([^<]*)", get("/query/apps"))
        m = [i for i, n in apps if a[1].lower() in n.lower()]
        print("launch", a[1], post("/launch/" + m[0]) if m else "not found; Netflix is 12")
    return 0
if __name__ == "__main__": sys.exit(main(sys.argv[1:]))
