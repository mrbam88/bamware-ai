#!/usr/bin/env python3
"""Govee lights over the apartment LAN (no cloud, no API key). Run on omarchy.

  govee_lan.py scan                          lights answering LAN Control: ip, sku, id
  govee_lan.py status [name|ip|all]
  govee_lan.py on|off  <name|ip|all>
  govee_lan.py bright  <name|ip|all> <1-100>
  govee_lan.py color   <name|ip|all> <warm|amber|blue|lavender|white|#rrggbb|r,g,b>
  govee_lan.py kelvin  <name|ip|all> <2700-6500>

Protocol: UDP multicast 239.255.255.250:4001 for scan, unicast <ip>:4001 for
commands, replies to our port 4002 (ufw must allow udp 4002 from 192.168.1.0/24).
Only devices with "LAN Control" switched on in the Govee Home app answer.
Names come from NAMES below (Govee ids -> Bilal's words); cloud names differ.
"""
import json, socket, sys, time

NAMES = {
    "11:AC:5C:E7:53:99:CB:E6": "Smart LED Bulb",
    "16:BA:5C:E7:53:99:82:EE": "Smart LED Bulb Top",
    "40:F9:DA:C3:41:06:03:53": "Uplighter Floor Lamp",
    "1C:CF:D4:0F:40:46:18:6A": "TV Backlight 3 Lite",
}
COLORS = {"warm": (255, 160, 60), "amber": (255, 140, 40), "peach": (255, 170, 100),
          "blue": (40, 90, 255), "lavender": (110, 70, 200), "teal": (0, 230, 190),
          "white": (255, 255, 255), "orange": (255, 120, 0), "pink": (255, 105, 180)}
MCAST, CMD_PORT, REPLY_PORT = "239.255.255.250", 4001, 4002


def sockets(timeout=2.0):
    r = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    r.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    r.bind(("", REPLY_PORT)); r.settimeout(timeout)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)
    return s, r


def scan(wait=3.0):
    s, r = sockets(wait)
    for _ in range(3):
        s.sendto(json.dumps({"msg": {"cmd": "scan", "data": {"account_topic": "reserve"}}}).encode(), (MCAST, CMD_PORT))
        time.sleep(0.3)
    found, t0 = {}, time.time()
    while time.time() - t0 < wait:
        try:
            d, a = r.recvfrom(4096)
            m = json.loads(d)["msg"]["data"]
            found[a[0]] = {"ip": a[0], "sku": m.get("sku"), "id": m.get("device"), "name": NAMES.get(m.get("device"), m.get("device"))}
        except socket.timeout:
            break
    return list(found.values())


def resolve(q, devices):
    if q == "all":
        return devices
    ql = q.lower()
    return [d for d in devices if d["ip"] == q or d["id"] == q or ql in d["name"].lower()]


def send(ip, cmd, data, s=None, r=None, want_reply=False):
    s = s or socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.sendto(json.dumps({"msg": {"cmd": cmd, "data": data}}).encode(), (ip, CMD_PORT))
    if want_reply:
        try:
            d, _ = r.recvfrom(4096); return json.loads(d)["msg"]["data"]
        except socket.timeout:
            return None


def status(dev):
    s, r = sockets()
    st = send(dev["ip"], "devStatus", {}, s, r, True)
    if not st:
        return f"{dev['name']}: no reply"
    c = st.get("color") or {}
    col = f"{st.get('colorTemInKelvin')}K" if st.get("colorTemInKelvin") else f"rgb({c.get('r')},{c.get('g')},{c.get('b')})"
    return f"{dev['name']}: {'on' if st.get('onOff') else 'off'}, {st.get('brightness')}%, {col}"


def parse_color(c):
    c = c.lower()
    if c in COLORS: return COLORS[c]
    if c.startswith("#") and len(c) == 7: return tuple(int(c[i:i+2], 16) for i in (1, 3, 5))
    if c.count(",") == 2: return tuple(int(x) for x in c.split(","))
    sys.exit(f"govee_lan: unknown color '{c}' ({', '.join(COLORS)}, #rrggbb, r,g,b)")


def main(argv):
    if not argv or argv[0] not in ("scan", "status", "on", "off", "bright", "color", "kelvin"):
        print(__doc__.strip()); return 1
    cmd = argv[0]
    devices = scan()
    if cmd == "scan":
        for d in devices: print(f"{d['name']}\t{d['sku']}\t{d['ip']}\t{d['id']}")
        return 0 if devices else 2
    targets = resolve(argv[1] if len(argv) > 1 else "all", devices)
    if not targets:
        print(f"govee_lan: nothing matches '{argv[1] if len(argv) > 1 else ''}' among {[d['name'] for d in devices]}"); return 2
    for d in targets:
        if cmd in ("on", "off"):
            send(d["ip"], "turn", {"value": 1 if cmd == "on" else 0})
        elif cmd == "bright":
            send(d["ip"], "brightness", {"value": max(1, min(100, int(argv[2])))})
        elif cmd == "color":
            r_, g, b = parse_color(argv[2])
            send(d["ip"], "colorwc", {"color": {"r": r_, "g": g, "b": b}, "colorTemInKelvin": 0})
        elif cmd == "kelvin":
            send(d["ip"], "colorwc", {"color": {"r": 0, "g": 0, "b": 0}, "colorTemInKelvin": int(argv[2])})
    time.sleep(1.2)
    for d in targets: print(status(d))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
