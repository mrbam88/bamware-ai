#!/usr/bin/env python3
"""NBA game watcher for Bilal's apartment (omarchy, nba-watch.timer every 5 min).

Bilal (2026-10-31): "Any time I'm at home and there is a live NBA game and I have access to it, I want you to
turn on the TV." Access = the apps he is signed into on the Apple TV: Peacock (NBC/Peacock games), Prime Video,
ESPN (ESPN/ESPN2/ABC games). Knicks first if several are live. The TV comes on once per game; turning it off
again is his, we never re-trigger for the same game. Source: ESPN's public scoreboard, no key.

  nba_watch.py            check and act (what the timer runs)
  nba_watch.py status     today's games, which ones he can watch, what is live; no action
  nba_watch.py now        act even if the game already triggered (the "Game on" button)
  nba_watch.py off|on     pause / resume the watcher (~/.local/state/bamware/nba_watch.off)

Guards: presence must say home; local time 11:00-23:30 (a late West-coast tip-off must not wake him);
quiet hours untouched (the stereo is not involved). Logs to ~/.local/state/bamware/nba_watch.log.
"""
import json, os, subprocess, sys, time, urllib.request
from datetime import datetime

S = os.path.expanduser("~/.local/state/bamware"); BIN = os.path.expanduser("~/.local/bin"); PY = os.path.expanduser("~/.venvs/smarthome/bin/python")
LOG = f"{S}/nba_watch.log"; OFF = f"{S}/nba_watch.off"
ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
# broadcaster name on ESPN -> (Apple TV app label, bundle id)
ACCESS = {"Prime Video": ("Prime Video", "com.amazon.aiv.AIVApp"),
          "Peacock": ("Peacock", "com.peacocktv.peacock"), "NBC": ("Peacock", "com.peacocktv.peacock"),
          "ESPN": ("ESPN", "com.espn.ScoreCenter"), "ESPN2": ("ESPN", "com.espn.ScoreCenter"), "ABC": ("ESPN", "com.espn.ScoreCenter")}
FAVOURITE = "NY"

def log(msg):
    os.makedirs(S, exist_ok=True)
    with open(LOG, "a") as f: f.write(f"{time.strftime('%F %T')} {msg}\n")

def games():
    req = urllib.request.Request(ESPN, headers={"User-Agent": "Mozilla/5.0"})
    data = json.load(urllib.request.urlopen(req, timeout=20))
    out = []
    for ev in data.get("events", []):
        c = ev["competitions"][0]; st = c["status"]["type"]
        names = [b["names"][0] for b in c.get("broadcasts", []) if b.get("names")]
        app = next((ACCESS[n] for n in names if n in ACCESS), None)
        teams = [t["team"]["abbreviation"] for t in c["competitors"]]
        out.append({"id": ev["id"], "name": ev["shortName"], "state": st["state"], "detail": st["shortDetail"],
                    "broadcasts": names, "app": app, "knicks": FAVOURITE in teams})
    return out

def pick(gs):
    live = [g for g in gs if g["state"] == "in" and g["app"]]
    live.sort(key=lambda g: (not g["knicks"], g["name"]))
    return live[0] if live else None

def home():
    try: return open(f"{S}/presence.state").read().strip() == "home"
    except FileNotFoundError: return True

def turn_on(g):
    label, bundle = g["app"]
    subprocess.run([PY, f"{BIN}/appletv.py", "key", "turn_on"], capture_output=True, timeout=30)
    subprocess.run([PY, f"{BIN}/appletv.py", "app", bundle], capture_output=True, timeout=30)
    subprocess.run([PY, f"{BIN}/samsung_tv.py", "appletv"], capture_output=True, timeout=90)
    msg = f"🏀 Game on: {g['name']} ({g['detail']}) on {label}. TV is on."
    subprocess.run(["bash", os.path.expanduser("~/code/bamware-ai/scripts/discord-post.sh"), msg], capture_output=True, timeout=30)
    return msg

def main(argv):
    cmd = argv[0] if argv else "check"
    if cmd == "off": open(OFF, "w").close(); print("nba watcher paused"); return 0
    if cmd == "on":
        try: os.remove(OFF)
        except FileNotFoundError: pass
        print("nba watcher active"); return 0
    gs = games()
    if cmd == "status":
        for g in gs:
            can = f"-> {g['app'][0]}" if g["app"] else "no access"
            print(f"{'LIVE ' if g['state']=='in' else '     '}{g['name']:<12} {g['detail']:<22} {', '.join(g['broadcasts']) or '-':<32} {can}{'  (Knicks)' if g['knicks'] else ''}")
        print("watcher:", "paused" if os.path.exists(OFF) else "active", "| presence:", "home" if home() else "away")
        return 0
    g = pick(gs)
    if not g: return 0
    done = f"{S}/nba_watch.{g['id']}"
    if cmd != "now":
        if os.path.exists(OFF): return 0
        if os.path.exists(done): return 0
        h = datetime.now().hour + datetime.now().minute / 60
        if not (11 <= h <= 23.5): log(f"skip {g['name']}: outside 11:00-23:30"); return 0
        if not home(): log(f"skip {g['name']}: away"); return 0
    open(done, "w").close()
    msg = turn_on(g); log(msg); print(msg)
    return 0

if __name__ == "__main__": sys.exit(main(sys.argv[1:]))
