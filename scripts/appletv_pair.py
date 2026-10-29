#!/usr/bin/env python3
"""One-time Apple TV pairing from omarchy (~/.venvs/smarthome). Run detached; it waits for the
on-screen PIN in ~/tmp/atv_pin (echo 1234 > ~/tmp/atv_pin). Pairs Companion then AirPlay.
Needs srptools==1.0.1 in the venv (2.0.0 breaks pyatv's SRP step). Done 2026-10-29.
"""
import asyncio, json, os, sys, time
import pyatv
from pyatv.const import Protocol
PIN_FILE = os.path.expanduser("~/tmp/atv_pin"); CRED = os.path.expanduser("~/.config/bamware/appletv.json")
async def main():
    loop = asyncio.get_running_loop()
    devs = await pyatv.scan(loop, hosts=["192.168.1.169"], timeout=10)
    tv = next((d for d in devs if "living" in (d.name or "").lower()), devs[0] if devs else None)
    if not tv: print("no apple tv found", flush=True); return
    print(f"found: {tv.name} {tv.address} model={tv.device_info.model} id={tv.identifier}", flush=True)
    print("protocols:", [s.protocol.name for s in tv.services], flush=True)
    creds = {}
    for proto in (Protocol.Companion, Protocol.AirPlay):
        if not tv.get_service(proto): continue
        pairing = await pyatv.pair(tv, proto, loop, name="Bamware")
        await pairing.begin()
        if pairing.device_provides_pin:
            print(f"PIN REQUIRED for {proto.name}: read it off the TV screen; waiting up to 180 s", flush=True)
            if os.path.exists(PIN_FILE): os.remove(PIN_FILE)
            t0 = time.time(); pin = None
            while time.time() - t0 < 180:
                if os.path.exists(PIN_FILE):
                    pin = open(PIN_FILE).read().strip(); os.remove(PIN_FILE); break
                await asyncio.sleep(1)
            if not pin: print("no PIN received, giving up", flush=True); await pairing.close(); return
            pairing.pin(int(pin))
        else:
            pairing.pin(1234); print(f"{proto.name}: enter 1234 on the TV if asked", flush=True)
        await pairing.finish()
        print(f"{proto.name} paired: {pairing.has_paired}", flush=True)
        if pairing.has_paired: creds[proto.name] = pairing.service.credentials
        await pairing.close()
    if creds:
        os.makedirs(os.path.dirname(CRED), exist_ok=True)
        json.dump({"identifier": tv.identifier, "address": str(tv.address), "name": tv.name, "credentials": creds}, open(CRED, "w")); os.chmod(CRED, 0o600)
        print("credentials saved", flush=True)
asyncio.run(main())
