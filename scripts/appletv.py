#!/usr/bin/env python3
"""Bilal's living-room Apple TV 4K (gen 3) from omarchy via pyatv (~/.venvs/smarthome).

  appletv.py status                    power, app, what's playing
  appletv.py apps
  appletv.py app <name|bundle>         launch: netflix, youtube, spotify, prime, disney, appletv, hbo/max
  appletv.py key <cmd> [...]           play pause menu home select up down left right volume_up volume_down turn_on turn_off
  appletv.py text <words>              type into the focused search box
Credentials (Companion + AirPlay, paired as "Bamware" 2026-10-29): ~/.config/bamware/appletv.json (600).
"""
import asyncio, json, os, sys
import pyatv
from pyatv.const import Protocol
CRED = os.path.expanduser("~/.config/bamware/appletv.json")
APPS = {"netflix": "com.netflix.Netflix", "youtube": "com.google.ios.youtube", "spotify": "com.spotify.client",
        "prime": "com.amazon.aiv.AIVApp", "disney": "com.disney.disneyplus", "appletv": "com.apple.TVWatchList",
        "hbo": "com.wbd.stream", "max": "com.wbd.stream", "hulu": "com.hulu.plus", "settings": "com.apple.TVSettings"}

async def connect(loop):
    c = json.load(open(CRED))
    devs = await pyatv.scan(loop, hosts=[c["address"]], timeout=6)
    if not devs: sys.exit("appletv: not found on the LAN (asleep? try key turn_on after a scan)")
    tv = devs[0]
    for p, cred in c["credentials"].items(): tv.set_credentials(Protocol[p], cred)
    return await pyatv.connect(tv, loop)

async def main(a):
    if not a: print(__doc__.strip()); return 1
    loop = asyncio.get_running_loop(); atv = await connect(loop)
    try:
        if a[0] == "status":
            pw = atv.power.power_state
            try: app = atv.metadata.app; appname = f"{app.name} ({app.identifier})" if app else "-"
            except Exception: appname = "-"
            pl = await atv.metadata.playing()
            print(f"power {pw.name}; app {appname}; {pl.device_state.name} {pl.title or ''} {('- ' + pl.artist) if pl.artist else ''}".strip())
        elif a[0] == "apps":
            for app in sorted(await atv.apps.app_list(), key=lambda x: x.name.lower()): print(f"{app.name}\t{app.identifier}")
        elif a[0] == "app":
            await atv.apps.launch_app(APPS.get(a[1].lower(), a[1])); print("launched", a[1])
        elif a[0] == "key":
            for k in a[1:]:
                await getattr(atv.remote_control if hasattr(atv.remote_control, k) else atv.power, k)(); print("sent", k); await asyncio.sleep(0.4)
        elif a[0] == "text":
            await atv.keyboard.text_set(" ".join(a[1:])); print("typed")
    finally:
        atv.close()
    return 0

sys.exit(asyncio.run(main(sys.argv[1:])))
