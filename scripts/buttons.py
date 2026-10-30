#!/usr/bin/env python3
"""Instant buttons for Bilal's apartment. Runs on omarchy (buttons.service), port 8787, stdlib only.

Bilal (2026-10-29): "I can't use a prompting-like experience. That's way too slow. It has to be
instantaneous, like a button." So: one tiny HTTP server, a fixed whitelist of actions, no free text,
no AI in the loop. Two front doors share it:

  GET  /                 big-button page for a phone home screen (Safari: Share, Add to Home Screen)
  GET|POST /do/<action>  run one action, answer in plain text. iOS Shortcuts "Get Contents of URL"
                         points here, which gives Siri, the Action Button, Apple Watch and widgets.
  GET  /go/<action>      ONE-TAP HOME-SCREEN BUTTON: a page that runs the action the moment it opens and shows
                         the result. Add it to the home screen in Safari and the icon IS the button (its own name
                         and colour via /icon/<action>.png). Replaces the glitchy Govee widgets (Bilal 2026-10-29).
  GET  /icon/<action>.png 180x180 tile, colour by group, no blue
  GET  /actions          the whitelist as JSON

Reachable only on the apartment Wi-Fi (192.168.1.186:8787) and Bilal's tailnet
(omarchy.tailb7fa1e.ts.net:8787); ufw must allow 8787 from both. Adding an action = one line in ACTIONS.
Every action is a shell command built here, never from the request. Logs to ~/.local/state/bamware/buttons.log.
"""
import json, os, shlex, subprocess, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOME = os.path.expanduser("~"); BIN = f"{HOME}/.local/bin"; STATE = f"{HOME}/.local/state/bamware"
ENV = {**os.environ, "XDG_RUNTIME_DIR": "/run/user/1000", "DBUS_SESSION_BUS_ADDRESS": "unix:path=/run/user/1000/bus"}
MPRIS = "busctl --user call org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player"
LAN = f"python3 {BIN}/govee_lan.py"

# name: (label, group, shell)   order here = order on the page. Blue is alert-only, so the page never shows it.
ACTIONS = {
    "lights-on":   ("Lights on",      "lights", f"{LAN} on all && {LAN} kelvin all 3000 && {LAN} bright all 40"),
    "lights-off":  ("Kill",           "lights", f"{LAN} off all; {BIN}/govee.sh off 'TV Backlight 3 Lite' >/dev/null 2>&1; {BIN}/govee.sh off Kill >/dev/null 2>&1; true"),
    "dim":         ("Dim",            "lights", f"{LAN} bright all 8"),
    "bright":      ("Bright",         "lights", f"{LAN} on all && {LAN} bright all 100"),
    "morning":     ("Morning",        "scenes", f"{BIN}/vibes.sh morning --now"),
    "work":        ("Work",           "scenes", f"{BIN}/vibes.sh work"),
    "evening":     ("Evening",        "scenes", f"touch {STATE}/lights.hold; {BIN}/vibes.sh evening --force"),
    "cleaning":    ("Cleaning",       "scenes", f"{BIN}/vibes.sh cleaning"),
    "daylight":    ("Match the sun",  "scenes", f"rm -f {STATE}/lights.hold; python3 {BIN}/daylight.py"),
    "play":        ("Play / pause",   "music",  f"{MPRIS} PlayPause"),
    "next":        ("Next song",      "music",  f"{MPRIS} Next"),
    "prev":        ("Previous",       "music",  f"{MPRIS} Previous"),
    "vol-down":    ("Quieter",        "music",  "wpctl set-volume -l 1.0 @DEFAULT_AUDIO_SINK@ 10%-"),
    "vol-up":      ("Louder",         "music",  "wpctl set-volume -l 1.0 @DEFAULT_AUDIO_SINK@ 10%+"),
    "mute-alert":  ("Quiet the mic 2 h", "misc", f"{BIN}/roomlevel.sh mute 120"),
    "tv-off":      ("TVs off",        "misc",   f"{HOME}/.venvs/smarthome/bin/python {BIN}/appletv.py key turn_off >/dev/null 2>&1; {HOME}/.venvs/smarthome/bin/python {BIN}/samsung_tv.py off >/dev/null 2>&1; true"),
}
GROUPS = [("lights", "Lights"), ("scenes", "Scenes"), ("music", "Stereo"), ("misc", "Other")]

def run(name):
    label, _, cmd = ACTIONS[name]; t0 = time.time()
    p = subprocess.run(["bash", "-lc", cmd], capture_output=True, text=True, env=ENV, timeout=60)
    ms = int((time.time() - t0) * 1000); ok = p.returncode == 0
    with open(f"{STATE}/buttons.log", "a") as f: f.write(f"{time.strftime('%F %T')} {name} {'ok' if ok else 'FAIL'} {ms}ms {p.stderr.strip()[:120]}\n")
    return ok, f"{label}: {'done' if ok else 'failed'} ({ms} ms)" + ("" if ok else f"\n{(p.stderr or p.stdout).strip()[:300]}")

PAGE = """<title>Apartment Buttons</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>
:root{--bg:#141210;--fg:#f3ebe0;--muted:#9a8f80;--card:#221e1a;--card2:#2c261f;--accent:#e08a3c;--ok:#e0b33c;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.3 -apple-system,system-ui,sans-serif;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
h1{font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:8px 0 14px;font-weight:600}
h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:22px 0 8px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
button{appearance:none;border:0;border-radius:14px;background:var(--card);color:var(--fg);font:inherit;font-weight:600;padding:22px 12px;min-height:72px;text-align:center;cursor:pointer;transition:transform .08s,background .15s}
button:active{transform:scale(.96);background:var(--card2)}button.busy{opacity:.55}button.done{background:var(--accent);color:#141210}button.fail{outline:2px solid var(--accent)}
#msg{position:fixed;left:16px;right:16px;bottom:max(16px,env(safe-area-inset-bottom));background:var(--card2);color:var(--fg);padding:12px 14px;border-radius:12px;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none;white-space:pre-wrap}
#msg.show{opacity:1}
</style>
<h1>Apartment</h1>__GROUPS__
<div id="msg"></div>
<script>
const msg=document.getElementById('msg');let t;
async function go(b){const n=b.dataset.a;b.className='busy';try{const r=await fetch('/do/'+n,{method:'POST'});const s=await r.text();b.className=r.ok?'done':'fail';msg.textContent=s;}catch(e){b.className='fail';msg.textContent='omarchy did not answer';}
msg.classList.add('show');clearTimeout(t);t=setTimeout(()=>{msg.classList.remove('show');b.className='';},1800);}
document.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>go(b)));
</script>"""

def page():
    out = []
    for g, title in GROUPS:
        btns = "".join(f'<button data-a="{n}">{a[0]}</button>' for n, a in ACTIONS.items() if a[1] == g)
        out.append(f"<h2>{title}</h2><div class=\"grid\">{btns}</div>")
    return PAGE.replace("__GROUPS__", "".join(out))

# one-tap page: runs the action on open. Colours per group: amber, rust, gold, copper. Kill is near-black. No blue.
TILE = {"lights": (224, 138, 60), "scenes": (190, 60, 15), "music": (224, 179, 60), "misc": (184, 90, 40)}
GO = """<title>__LABEL__</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="__LABEL__"><link rel="apple-touch-icon" href="/icon/__NAME__.png">
<style>:root{color-scheme:dark}body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#141210;color:#f3ebe0;font:600 28px/1.2 -apple-system,system-ui,sans-serif;text-align:center;padding:24px}
#s{font-size:17px;font-weight:400;color:#9a8f80;white-space:pre-wrap}#dot{width:88px;height:88px;border-radius:50%;background:rgb(__RGB__);opacity:.5;transition:opacity .2s,transform .2s}#dot.on{opacity:1;transform:scale(1.08)}
a{color:#e08a3c;font-size:15px;font-weight:500;margin-top:30px}button{appearance:none;border:0;border-radius:14px;background:#2c261f;color:#f3ebe0;font:inherit;font-size:18px;padding:14px 22px}</style>
<div id="dot"></div><div>__LABEL__</div><div id="s">running…</div><button onclick="run()">Again</button><a href="/">All buttons</a>
<script>const s=document.getElementById('s'),d=document.getElementById('dot');async function run(){s.textContent='running…';d.className='';try{const r=await fetch('/do/__NAME__',{method:'POST'});s.textContent=await r.text();d.className=r.ok?'on':'';}catch(e){s.textContent='omarchy did not answer'}}run();</script>"""

def go_page(name):
    label, group, _ = ACTIONS[name]; rgb = TILE.get(group, TILE["misc"])
    if name == "lights-off": rgb = (60, 52, 44)
    return GO.replace("__LABEL__", label).replace("__NAME__", name).replace("__RGB__", ",".join(map(str, rgb)))

def icon_png(name, size=180):
    """Solid tile with a soft disc: no PIL on omarchy, so a hand-rolled PNG."""
    import struct, zlib
    _, group, _ = ACTIONS[name]; rgb = TILE.get(group, TILE["misc"])
    if name == "lights-off": rgb, disc = (40, 34, 28), (120, 104, 88)
    else: disc = tuple(min(255, int(c * 0.55 + 255 * 0.45)) for c in rgb)
    cx = cy = size / 2; r2 = (size * 0.27) ** 2; rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            row += bytes(disc if (x - cx) ** 2 + (y - cy) ** 2 <= r2 else rgb)
        rows.append(bytes(row))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body, ctype="text/plain; charset=utf-8"):
        b = body if isinstance(body, bytes) else body.encode(); self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(b)
    def handle_path(self):
        p = self.path.split("?")[0].rstrip("/") or "/"
        if p == "/": return self.send(200, page(), "text/html; charset=utf-8")
        if p == "/actions": return self.send(200, json.dumps({n: a[0] for n, a in ACTIONS.items()}), "application/json")
        if p.startswith("/go/"):
            name = p[4:]
            if name not in ACTIONS: return self.send(404, f"unknown action '{name}'")
            return self.send(200, go_page(name), "text/html; charset=utf-8")
        if p.startswith("/icon/") and p.endswith(".png"):
            name = p[6:-4]
            if name not in ACTIONS: return self.send(404, "no icon")
            return self.send(200, icon_png(name), "image/png")
        if p.startswith("/do/"):
            name = p[4:]
            if name not in ACTIONS: return self.send(404, f"unknown action '{name}'. Known: {', '.join(ACTIONS)}")
            try: ok, text = run(name)
            except subprocess.TimeoutExpired: ok, text = False, f"{ACTIONS[name][0]}: timed out"
            return self.send(200 if ok else 500, text)
        self.send(404, "not found")
    do_GET = do_POST = handle_path

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    os.makedirs(STATE, exist_ok=True)
    print(f"buttons on 0.0.0.0:{port}, {len(ACTIONS)} actions", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()
