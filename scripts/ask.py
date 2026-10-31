#!/usr/bin/env python3
"""Push-to-talk for Bilal's apartment and company. Runs on omarchy (ask.service), 127.0.0.1:8788, stdlib only.
Primer: https://claude.ai/artifact/2eWru4MPctwJKDPrNBGMmB  Ticket: bamware-ai#295

A Siri Shortcut dictates a sentence and POSTs it here; whatever comes back is spoken aloud.

  POST /ask        body = the sentence (raw text, or JSON {"text": "..."}) -> plain-text reply
  GET  /health     "ok"

Two routes, reflex first:
  1. REFLEX  the sentence names one of the buttons.py actions ("lights on", "kill the lights", "next song")
             -> call buttons.py over loopback, answer in under a second, no model.
  2. AGENT   anything else -> one headless `claude -p` in the shared repo checkout, read-only tools only,
             spoken-style answer, hard timeout. Honors the CFO halt file (company Rule #1).

Reachable only through `tailscale serve --https=8788 http://127.0.0.1:8788` (Bilal's devices). Never binds a LAN port.
Every ask is one line in ~/.local/state/bamware/ask.log: the usage meter for the 14-day trial.
"""
import json, os, re, subprocess, sys, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOME = os.path.expanduser("~"); STATE = f"{HOME}/.local/state/bamware"
BUTTONS = os.environ.get("ASK_BUTTONS", "http://127.0.0.1:8787")
REPO = os.environ.get("BAMWARE_REPO", f"{HOME}/code/worktrees/bamware-ai-main")
HALT = os.environ.get("BAMWARE_CFO_HALT", f"{STATE}/cfo/halt.json")
AGENT_TIMEOUT = int(os.environ.get("ASK_TIMEOUT", "45"))
MODEL = os.environ.get("ASK_MODEL", "")  # empty = the CLI's default
# Everything that can act on the world is denied; this path answers questions, the whitelist does things.
DENY = ("Bash,Write,Edit,NotebookEdit,WebFetch,WebSearch,Agent,mcp__claude_ai_Gmail,mcp__claude_ai_Google_Drive,"
        "mcp__claude_ai_Composio,mcp__claude_ai_Vercel,mcp__claude_ai_Postman,mcp__claude_ai_Claude_Docs,"
        "mcp__claude_ai_Sentry,mcp__claude_ai_Mermaid_Chart,mcp__claude_ai_Notion")
ALLOW = "Read,Grep,Glob"

# phrase -> buttons.py action. Longest phrase wins, so "lights off" beats "lights". Keep every phrase lowercase.
REFLEX = {
    "lights-on":   ["lights on", "turn on the lights", "turn the lights on", "light on"],
    "lights-off":  ["lights off", "kill the lights", "kill lights", "turn off the lights", "turn the lights off", "kill everything", "kill"],
    "dim":         ["dim", "dim the lights", "dimmer"],
    "bright":      ["bright", "brighter", "full brightness", "max brightness"],
    "morning":     ["morning", "morning mode", "good morning"],
    "work":        ["work", "work mode", "focus", "focus mode"],
    "evening":     ["evening", "evening mode", "romantic", "chill"],
    "cleaning":    ["cleaning", "clean mode", "cleaning mode", "clean up"],
    "daylight":    ["match the sun", "daylight", "sun mode"],
    "play":        ["play", "pause", "play pause", "resume", "stop the music"],
    "next":        ["next", "next song", "skip", "skip this", "next track"],
    "prev":        ["previous", "previous song", "go back", "last song"],
    "vol-down":    ["quieter", "volume down", "turn it down", "lower"],
    "vol-up":      ["louder", "volume up", "turn it up"],
    "peacock":     ["peacock"],
    "prime":       ["prime", "prime video", "amazon"],
    "espn":        ["espn"],
    "pluto":       ["pluto", "pluto tv"],
    "tubi":        ["tubi"],
    "game-on":     ["game on", "put the game on", "the game", "nba game"],
    "local-tv":    ["local tv", "local news", "channel 4"],
    "mute-alert":  ["quiet the mic", "mute the mic", "stop listening"],
    "tv-off":      ["tv off", "tvs off", "turn off the tv", "television off"],
}
FILLER = re.compile(r"^(hey|ok|okay|jarvis|please|can you|could you|would you|and)\b\s*|\s*\b(please|now|thanks|thank you)[.!?]*$")

def normalize(text):
    t = re.sub(r"[^a-z0-9 ]+", " ", text.lower()).strip()
    t = re.sub(r"\s+", " ", t)
    for _ in range(3): t = FILLER.sub("", t).strip()
    return t

def reflex_for(text):
    """Action name when the sentence is one of the whitelisted phrases, else None. Exact phrase only: a sentence that
    merely contains 'kill' is a question for the agent, not a command."""
    t = normalize(text)
    if not t: return None
    best = None
    for action, phrases in REFLEX.items():
        for ph in phrases:
            if t == ph or t == "the " + ph or t == ph.replace("the ", ""):
                if best is None or len(ph) > len(best[1]): best = (action, ph)
    return best[0] if best else None

GLOSSARY = ("Names you will hear, spelled right: Bamware (his company), BrewDesk (the cafe app), omarchy (the server in the "
            "apartment), Govee (the lights), Tailscale, Neon, Vercel, TestFlight, Discord router, the CFO halt.")

def agent_prompt(text):
    return (f"You are answering Bilal by voice. Your reply will be read aloud by Siri, so: plain speech, at most 40 words, "
            f"no markdown, no lists, no code, no URLs, no hashes. Lead with the answer. If you cannot find it in the repo, say so in one sentence. "
            f"You may only read files in this repo (STATE.md first). {GLOSSARY}\n\nHe said: {text}")

def halted():
    try:
        with open(HALT) as f: h = json.load(f)
        return h.get("reason") or "CFO halt" if h.get("halted") else None
    except (OSError, ValueError): return None

def run_reflex(action):
    with urllib.request.urlopen(urllib.request.Request(f"{BUTTONS}/do/{action}", method="POST"), timeout=60) as r:
        return r.status == 200, r.read().decode().strip().splitlines()[0]

def run_agent(text):
    cmd = ["claude", "-p", "--output-format", "text", "--allowedTools", ALLOW, "--disallowedTools", DENY]
    if MODEL: cmd += ["--model", MODEL]
    env = {**os.environ, "PATH": f"{HOME}/.local/bin:{HOME}/.local/share/mise/shims:" + os.environ.get("PATH", "/usr/bin:/bin")}
    try:
        p = subprocess.run(cmd, input=agent_prompt(text), capture_output=True, text=True, cwd=REPO, env=env, timeout=AGENT_TIMEOUT)
    except subprocess.TimeoutExpired:
        return False, "That took too long. Ask me on Discord instead."
    out = (p.stdout or "").strip()
    if p.returncode != 0 or not out:
        err = (p.stderr or "").strip().splitlines()
        return False, "The agent did not answer." + (f" {err[-1][:120]}" if err else "")
    return True, re.sub(r"\s+", " ", out)

def log(route, ok, ms, text):
    os.makedirs(STATE, exist_ok=True)
    with open(f"{STATE}/ask.log", "a") as f:
        f.write(f"{time.strftime('%F %T')} {route} {'ok' if ok else 'FAIL'} {ms}ms {text[:80]!r}\n")

def answer(text):
    """(ok, reply, route). The whole decision in one place so it can be tested without a server."""
    text = text.strip()
    if not text: return False, "I did not catch that.", "empty"
    action = reflex_for(text)
    if action:
        ok, msg = run_reflex(action); return ok, msg, f"reflex:{action}"
    h = halted()
    if h: return False, f"Spending is halted, so no agent runs. Reason: {h}", "halt"
    ok, msg = run_agent(text); return ok, msg, "agent"

def body_text(raw):
    raw = raw.decode("utf-8", "replace").strip()
    if raw.startswith("{"):
        try: return str(json.loads(raw).get("text", "")).strip()
        except ValueError: pass
    return raw

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body):
        b = body.encode(); self.send_response(code); self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(b))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path.split("?")[0].rstrip("/") == "/health": return self.send(200, "ok")
        self.send(404, "POST /ask with a sentence")
    def do_POST(self):
        if self.path.split("?")[0].rstrip("/") != "/ask": return self.send(404, "POST /ask with a sentence")
        n = int(self.headers.get("Content-Length") or 0); text = body_text(self.rfile.read(n)) if n else ""
        t0 = time.time()
        try: ok, reply, route = answer(text)
        except Exception as e: ok, reply, route = False, f"Something broke on omarchy: {type(e).__name__}", "error"
        ms = int((time.time() - t0) * 1000); log(route, ok, ms, text)
        self.send(200 if ok else 500, reply)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8788
    os.makedirs(STATE, exist_ok=True)
    print(f"ask on 127.0.0.1:{port}, {len(REFLEX)} reflexes, agent in {REPO}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
