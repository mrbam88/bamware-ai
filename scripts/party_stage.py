#!/usr/bin/env python3
"""Party stage: the lights dance to the music in the colours of the track's artwork, and the TV shows the video.

  party_stage.py             run until killed (SIGTERM) or for 3 h
  party_stage.py --listen    analyse the audio for 20 s and print the bands; touch no light, no TV
  party_stage.py --palette   print the palette for the track playing now and exit

Run it with the smarthome venv (it needs websocket-client). It never chooses or changes the music.

Three things run side by side:

* Colours. The cover of the track playing in Spotify is reduced to its few most vivid hues; every light
  draws from that palette, and it is renewed when the track changes. Bilal (2026-11-26): "I want the
  colors from Spotify to be the inspiration for the lights dancing in my room." He is red-green
  colourblind, so a palette never keeps green beside red.
* Movement. The server listens to its own output (the sink monitor, so the room and the speaker's
  dial play no part) and splits it into bass, mids and treble.
    - The two bulbs have no music mode of their own, so they are driven live over the LAN about eight
      times a second: one breathes with the bass, the other with the mids and treble, and both slide
      through the palette, jumping a step on every beat.
    - The strip, the TV wall and the floor lamp have Govee's own music modes, which animate every LED
      from the light's built-in microphone far more fluidly than commands over Wi-Fi could. They are
      put in those modes ("Spectrum" follows frequency) in the palette's colours, once per track.
* The TV. Through Spotify's local developer port: a track with a video gets that video full screen;
  a track without one gets Spotify's own full-screen cover view. Keyboard focus is handed back.
"""
from __future__ import annotations

import colorsys
import importlib.util
import json
import math
import os
import pathlib
import signal
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

HOME = pathlib.Path.home()
HERE = pathlib.Path(__file__).resolve().parent
LOG = HOME / ".local/state/bamware/party-stage.log"
FALLBACK = [(255, 20, 110), (255, 110, 0), (255, 200, 0), (230, 40, 160)]   # the old party palette
BULBS = ["smart led bulb", "bulb top"]            # LAN, driven live; name fragments
# Every light on the LAN that can show a colour. Not the floor lamp: in party mode only its ceiling ripple is on
# (Bilal 2026-11-26), a fixed rainbow prism, and a colour command would wake the disc he asked to be off.
ROOM = ["smart led bulb", "bulb top", "strip"]
TV_WALL = ("H6099", "1C:CF:D4:0F:40:46:18:6A")    # cloud only, so it follows a few seconds behind
# "screen": the whole room takes one colour, read live from what is on the TV (Bilal 2026-11-26: "all the lights in
# sync together, like the whole room was changing colors... go completely off the music video screen and don't
# worry about the blue rule"). "cover": each light its own colour from the track's artwork (the first version).
MODE = os.environ.get("PARTY_MODE", "screen")
# Govee's own music modes: (sku, device id, mode number, label). Spectrum follows frequency.
NATIVE = [
    ("H61F2", "22:A6:C2:53:56:54:74:A1", 3, "strip: Spectrum"),
    ("H6099", "1C:CF:D4:0F:40:46:18:6A", 2, "TV wall: Spectrum"),
    ("H60B0", "40:F9:DA:C3:41:06:03:53", 3, "floor lamp: Flowing Light"),
]
SENSITIVITY = 90

RATE = 16000
FRAME = 512                       # 32 ms
BASS_CUT = 1 - math.exp(-2 * math.pi * 150 / RATE)
MID_CUT = 1 - math.exp(-2 * math.pi * 2000 / RATE)
HISTORY = 40                      # about 1.3 s
ONSET_RATIO = 1.5
MIN_GAP = 0.30
SILENCE = 60
SEND_EVERY = 0.12                 # seconds between updates to the bulbs
MAX_SECONDS = 3 * 3600
CDP_PORT = 9222
SPOTIFY = ["busctl", "--user", "--json=short", "get-property", "org.mpris.MediaPlayer2.spotify",
           "/org/mpris/MediaPlayer2", "org.mpris.MediaPlayer2.Player"]


def log(text: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as stream:
        stream.write(f"{time.strftime('%F %T')} {text}\n")


# --- colours from the artwork ---------------------------------------------

def track() -> tuple[str, str, str]:
    """(track id, title, artwork URL) of what Spotify is playing, or empty strings."""
    try:
        reply = json.loads(subprocess.run(SPOTIFY + ["Metadata"], capture_output=True, text=True, timeout=5).stdout)
        data = reply["data"]
        return (data.get("mpris:trackid", {}).get("data", ""), data.get("xesam:title", {}).get("data", ""),
                data.get("mpris:artUrl", {}).get("data", ""))
    except Exception:  # noqa: BLE001 - Spotify closed or silent: no track
        return "", "", ""


def pixels(url: str) -> list[tuple[int, int, int]]:
    """The artwork as a 24x24 grid of colours (ffmpeg does the decoding)."""
    if not url.startswith("https://"):
        return []
    with tempfile.NamedTemporaryFile(suffix=".img") as image:
        image.write(urllib.request.urlopen(url, timeout=8).read())  # noqa: S310 - https only, checked above
        image.flush()
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", image.name, "-vf", "scale=24:24",  # noqa: S603, S607
                              "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, timeout=15).stdout
    return [tuple(raw[i:i + 3]) for i in range(0, len(raw) - 2, 3)]


def palette_from(colours: list[tuple[int, int, int]], size: int = 4) -> list[tuple[int, int, int]]:
    """The few most vivid hues in a picture, as full-strength light colours.

    Dull pixels are ignored, hues are pooled in 30-degree bins weighted by how saturated and bright
    they are, and the strongest bins win. A cover with no real colour gets the classic party palette.
    Green is dropped when red is present: he cannot tell them apart, so the pair reads as one muddy light.
    """
    bins: dict[int, list[float]] = {}
    for r, g, b in colours:
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s < 0.35 or v < 0.25:
            continue
        weight = s * v
        entry = bins.setdefault(int(h * 12) % 12, [0.0, 0.0, 0.0])
        entry[0] += weight
        entry[1] += math.cos(2 * math.pi * h) * weight
        entry[2] += math.sin(2 * math.pi * h) * weight
    total = sum(entry[0] for entry in bins.values())
    if total < 0.03 * max(1, len(colours)):
        return list(FALLBACK)
    ranked = sorted(bins.values(), key=lambda entry: -entry[0])
    hues = [(math.atan2(e[2], e[1]) / (2 * math.pi)) % 1 for e in ranked if e[0] > 0.06 * total][:size]

    def is_red(h):
        return h < 0.055 or h > 0.945

    def is_green(h):
        return 0.20 < h < 0.47

    if any(is_red(h) for h in hues):
        hues = [h for h in hues if not is_green(h)]
    # A one-colour cover still needs somewhere to move: add its neighbours on the colour wheel.
    spread = [0.0, 0.07, -0.07, 0.14]
    while len(hues) < 3:
        candidate = (hues[0] + spread[len(hues)]) % 1
        if is_red(hues[0]) and is_green(candidate):
            candidate = (hues[0] - 0.1) % 1
        hues.append(candidate)
    return [tuple(round(c * 255) for c in colorsys.hsv_to_rgb(h, 1.0, 1.0)) for h in hues]


# --- listening --------------------------------------------------------------

class Ear:
    """Splits the music into bass, mids and treble and finds the beat. Time comes from the frame count."""

    def __init__(self):
        self.low = self.mid = 0.0
        self.level = [0.0, 0.0, 0.0]        # smoothed band levels, 0..1 against each band's own recent peak
        self.peak = [1.0, 1.0, 1.0]
        self.history: list[float] = []
        self.clock = 0.0
        self.last_beat = -1.0
        self.rms = 0.0

    def feed(self, frame) -> bool:
        """Take one frame; returns True when it starts a beat."""
        self.clock += len(frame) / RATE
        sums = [0.0, 0.0, 0.0]
        total = 0.0
        for sample in frame:
            self.low += BASS_CUT * (sample - self.low)
            self.mid += MID_CUT * (sample - self.mid)
            sums[0] += self.low * self.low
            band = self.mid - self.low
            sums[1] += band * band
            high = sample - self.mid
            sums[2] += high * high
            total += sample * sample
        self.rms = math.sqrt(total / len(frame))
        for i in range(3):
            value = math.sqrt(sums[i] / len(frame))
            self.peak[i] = max(self.peak[i] * 0.9992, value, 1.0)     # each band is judged against itself
            target = value / self.peak[i]
            # Up fast, down slowly: a hit lands at once and then glows out.
            self.level[i] = target if target > self.level[i] else self.level[i] * 0.80 + target * 0.20
        bass = sums[0] / len(frame)
        average = sum(self.history) / len(self.history) if self.history else 0.0
        self.history.append(bass)
        if len(self.history) > HISTORY:
            self.history.pop(0)
        beat = (self.rms > SILENCE and average > 0 and bass > ONSET_RATIO * average
                and self.clock - self.last_beat > MIN_GAP)
        if beat:
            self.last_beat = self.clock
        return beat

    @property
    def playing(self) -> bool:
        return self.rms > SILENCE


def frames():
    capture = subprocess.Popen(  # noqa: S603, S607
        ["parec", "-d", "@DEFAULT_MONITOR@", "--format=s16le", f"--rate={RATE}", "--channels=1", "--raw",
         "--latency-msec=30", "--client-name=party-stage"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        while True:
            data = capture.stdout.read(FRAME * 2)
            if len(data) < FRAME * 2:
                return
            yield struct.unpack(f"<{FRAME}h", data)
    finally:
        capture.terminate()


# --- the bulbs, live --------------------------------------------------------

def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


class Bulbs:
    def __init__(self, names=BULBS):
        spec = importlib.util.spec_from_file_location("govee_lan", HERE / "govee_lan.py")
        self.lan = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.lan)
        devices = self.lan.cached_scan()
        self.ips = []
        self.sock, _ = self.lan.sockets(0.2)
        for fragment in names:
            found = sorted((d for d in devices if fragment in d["name"].lower()), key=lambda d: len(d["name"]))
            if not found:
                continue
            self.ips.append(found[0]["ip"])
            # Loudness is carried by the colour itself, so bulbs and strip sit at full. The floor lamp is the
            # exception: its one dimmer sets the ceiling ripple and the ring, and Bilal sets that by hand.
            if "uplighter" not in fragment:
                self.lan.send(found[0]["ip"], "brightness", {"value": 100}, self.sock)
        self.sent = [None] * len(self.ips)

    def show(self, colours) -> None:
        for index, ip in enumerate(self.ips):
            rgb = tuple(max(0, min(255, round(c))) for c in colours[index % len(colours)])
            if self.sent[index] and sum(abs(a - b) for a, b in zip(rgb, self.sent[index])) < 6:
                continue          # nothing visible would change; keep the Wi-Fi quiet
            self.sent[index] = rgb
            self.lan.send(ip, "colorwc", {"color": {"r": rgb[0], "g": rgb[1], "b": rgb[2]}, "colorTemInKelvin": 0}, self.sock)


def bulb_colours(ear: Ear, palette, position: float):
    """Two colours for this instant: where each bulb is in the palette, and how hard its band is hitting."""
    n = len(palette)
    out = []
    for offset, drive in ((0.0, ear.level[0]), (n / 2, max(ear.level[1], ear.level[2]))):
        place = (position + offset) % n
        base = mix(palette[int(place) % n], palette[(int(place) + 1) % n], place - int(place))
        glow = 0.16 + 0.84 * min(1.0, drive) ** 1.4 if ear.playing else 0.5      # never fully dark
        out.append(tuple(c * glow for c in base))
    return out


# --- Govee's own music modes -------------------------------------------------

def govee_key() -> str:
    for line in (HOME / ".config/bamware/govee.env").read_text().splitlines():
        if line.startswith("GOVEE_API_KEY="):
            return line.split("=", 1)[1].strip().strip("'\"")
    return ""


def native_music(palette) -> None:
    """Put the lights that can animate themselves into a music mode, each in its own palette colour."""
    key = govee_key()
    if not key:
        return
    for index, (sku, device, mode, label) in enumerate(NATIVE):
        r, g, b = palette[(index + 1) % len(palette)]
        body = {"requestId": "party", "payload": {"sku": sku, "device": device, "capability": {
            "type": "devices.capabilities.music_setting", "instance": "musicMode",
            "value": {"musicMode": mode, "sensitivity": SENSITIVITY, "autoColor": 0, "rgb": (r << 16) + (g << 8) + b}}}}
        request = urllib.request.Request("https://openapi.api.govee.com/router/api/v1/device/control",
                                         data=json.dumps(body).encode(),
                                         headers={"Govee-API-Key": key, "Content-Type": "application/json"})
        try:
            reply = json.loads(urllib.request.urlopen(request, timeout=8).read())  # noqa: S310 - fixed https URL
            if reply.get("code") != 200:
                log(f"{label}: Govee said {reply.get('code')} {str(reply.get('msg'))[:80]}")
        except Exception as error:  # noqa: BLE001 - a slow cloud must not stop the party
            log(f"{label}: {type(error).__name__}")


# --- the TV -------------------------------------------------------------------

STAGE_JS = """(async () => {
  const video = [...document.querySelectorAll('video')].find(v => v.videoWidth > 0 && !v.paused);
  const label = b => (b.getAttribute('aria-label') || b.innerText || '').trim();
  if (video) {
    if (document.fullscreenElement === video) return 'video';
    if (document.fullscreenElement) await document.exitFullscreen();
    await video.requestFullscreen();
    return 'video: now full screen';
  }
  if (document.fullscreenElement && document.fullscreenElement.tagName === 'VIDEO') await document.exitFullscreen();
  if (document.fullscreenElement) return 'cover';
  const enter = [...document.querySelectorAll('button')].find(b => label(b) === 'Enter Full screen');
  if (enter) { enter.click(); return 'cover: now full screen'; }
  return 'nothing to show';
})()"""


def hypr(*args: str):
    return subprocess.run(["hyprctl", *args], capture_output=True, text=True, timeout=5).stdout  # noqa: S603, S607


def screen_colour(picture: list[tuple[int, int, int]]):
    """One light colour for a frame of video: its dominant vivid hue at full strength, or None for a dark frame.

    Pixels vote with their saturation and brightness, so a neon sign outweighs a grey wall. The winner is
    pushed to full saturation: a lamp showing the frame's true washed-out average would just look white.
    """
    if not picture:
        return None
    bins: dict[int, list[float]] = {}
    light = 0.0
    for r, g, b in picture:
        h, sat, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        light += v
        weight = (sat ** 1.5) * v
        if weight < 0.02:
            continue
        entry = bins.setdefault(int(h * 12) % 12, [0.0, 0.0, 0.0, 0.0])
        entry[0] += weight
        entry[1] += math.cos(2 * math.pi * h) * weight
        entry[2] += math.sin(2 * math.pi * h) * weight
        entry[3] += sat * weight
    if light / len(picture) < 0.09:
        return None                              # a black frame: hold the last colour instead of flashing
    best = max(bins.values(), key=lambda entry: entry[0]) if bins else None
    if not best or best[0] < 0.004 * len(picture):
        # Light but no colour (a white room, grey credits): warm white, as bright as the frame is.
        level = min(1.0, 0.2 + 1.4 * light / len(picture))
        return tuple(round(c * level) for c in (255, 244, 229))
    hue = (math.atan2(best[2], best[1]) / (2 * math.pi)) % 1
    saturation = min(1.0, 0.55 + best[3] / best[0])
    return tuple(round(c * 255) for c in colorsys.hsv_to_rgb(hue, saturation, 1.0))


class Stage:
    """One connection to Spotify's page: keeps the video (or the cover) full screen, and looks at the picture."""

    def __init__(self):
        import websocket     # in the smarthome venv; imported here so the audio side runs without it
        pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json", timeout=3))
        page = next(p for p in pages if p["type"] == "page" and "spotify" in p["url"])
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=8,
                                              origin=f"http://127.0.0.1:{CDP_PORT}")
        self.sent = 0
        self.last = None

    def call(self, method: str, params: dict) -> dict:
        self.sent += 1
        self.ws.send(json.dumps({"id": self.sent, "method": method, "params": params}))
        while True:
            reply = json.loads(self.ws.recv())
            if reply.get("id") == self.sent:
                if "error" in reply:
                    raise RuntimeError(f"{method}: {reply['error'].get('message', 'refused')[:80]}")
                return reply.get("result", {})

    def arrange(self) -> str:
        """Make the TV show the video (or the cover) full screen. Returns what it found."""
        before = json.loads(hypr("activewindow", "-j") or "{}")
        reply = self.call("Runtime.evaluate", {"expression": STAGE_JS, "returnByValue": True,
                                               "awaitPromise": True, "userGesture": True})
        result = reply.get("result", {}).get("value") or "error"
        if "now" in result:
            # Going full screen pulls the keyboard to the TV. Give it back to whoever had it.
            time.sleep(0.8)
            after = json.loads(hypr("activewindow", "-j") or "{}")
            if (after.get("class", "").lower() == "spotify" and before.get("class", "").lower() != "spotify"
                    and before.get("address")):
                hypr("dispatch", f'hl.dsp.focus({{ window = "address:{before["address"]}" }})')
        self.keep_keyboard()
        if result != self.last:
            log(f"TV: {result}")
            self.last = result
        return result

    def keep_keyboard(self) -> None:
        """Spotify raises itself when a track or playlist starts. Typing must never land on the TV window.

        Remember the last window that had the keyboard; if Spotify has taken it while the pointer is not on
        the TV (so nobody went there on purpose), give it back.
        """
        active = json.loads(hypr("activewindow", "-j") or "{}")
        if active.get("class", "").lower() != "spotify":
            self.owner = active.get("address") or getattr(self, "owner", None)
            return
        owner = getattr(self, "owner", None)
        if not owner:
            clients = json.loads(hypr("clients", "-j") or "[]")
            owner = next((c["address"] for c in clients if c.get("class", "").lower() != "spotify"
                          and c.get("monitor") != active.get("monitor")), None)
        if not owner:
            return
        try:
            x = int(hypr("cursorpos").split(",")[0])
            monitors = json.loads(hypr("monitors", "-j") or "[]")
            tv = next(m for m in monitors if m["id"] == active.get("monitor"))
            on_tv = tv["x"] <= x < tv["x"] + tv["width"] / tv["scale"]
        except Exception:  # noqa: BLE001 - cannot tell where the pointer is: leave focus alone
            return
        if not on_tv:
            hypr("dispatch", f'hl.dsp.focus({{ window = "address:{owner}" }})')

def tv_strips() -> list[str]:
    """Three thin horizontal strips across the TV output, as grim regions; empty when the TV is not an output."""
    monitors = json.loads(hypr("monitors", "-j") or "[]")
    tv = next((m for m in monitors if "Samsung" in m.get("description", "")), None)
    if not tv:
        return []
    width, height = tv["width"] / tv["scale"], tv["height"] / tv["scale"]
    left, span = round(tv["x"] + width * 0.1), round(width * 0.8)
    return [f"{left},{round(tv['y'] + height * part)} {span}x4" for part in (0.33, 0.5, 0.67)]


def strip_pixels(box: str) -> list[tuple[int, int, int]]:
    """One strip of what is on the TV right now, thinned to a few hundred pixels.

    A capture by the compositor, so it sees exactly what the panel shows: Spotify's videos are protected
    and read as black from inside the app, and page screenshots left the app's page stuck at zero size.
    The cost of a capture grows with its area (the pixels come back from the graphics card): a strip takes
    about 0.1 s while a video plays, the middle half of the screen 0.7 s, the whole 4K output 1.4 s.
    """
    ppm = subprocess.run(["grim", "-g", box, "-t", "ppm", "-"], capture_output=True, timeout=5).stdout  # noqa: S603, S607
    parts = ppm.split(b"\n", 3)
    if len(parts) < 4 or parts[0] != b"P6":
        return []
    data = parts[3]
    return [tuple(data[i:i + 3]) for i in range(0, len(data) - 2, 3 * 23)]     # every 23rd pixel


def stage_loop(stop: threading.Event, shared: dict) -> None:
    """Keep the TV arranged (every 2 s, through Spotify) and keep looking at it (as fast as the capture allows)."""
    if "WAYLAND_DISPLAY" not in os.environ:      # started from a service: find the session's display
        runtime = pathlib.Path(os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}"))
        sockets = sorted(p.name for p in runtime.glob("wayland-[0-9]*") if not p.name.endswith(".lock"))
        if sockets:
            os.environ["WAYLAND_DISPLAY"] = sockets[0]
    stage = None
    strips: list[str] = []
    recent: dict[int, list] = {}
    turn = 0
    last_arrange = last_note = last_box = 0.0
    while not stop.wait(0.05 if MODE == "screen" else 2.0):
        now = time.monotonic()
        if now - last_arrange >= 2.0:
            last_arrange = now
            try:
                stage = stage or Stage()
                stage.arrange()
            except Exception as error:  # noqa: BLE001 - Spotify closed, or started without its developer port
                stage = None
                if now - last_note > 30:
                    last_note = now
                    log(f"TV: Spotify not reachable ({type(error).__name__}: {str(error)[:80]})")
        if MODE != "screen":
            continue
        try:
            if not strips or now - last_box > 30:
                strips, last_box = tv_strips(), now
            if strips:
                # One strip per look, in turn; the room's colour comes from the last three together, so the
                # whole picture is covered about three times a second.
                turn += 1
                recent[turn % len(strips)] = strip_pixels(strips[turn % len(strips)])
                colour = screen_colour([pixel for strip in recent.values() for pixel in strip])
                if colour:
                    shared["screen"] = colour
                shared["looks"] = shared.get("looks", 0) + 1
        except Exception as error:  # noqa: BLE001 - a failed capture must not stop the lights
            if now - last_note > 30:
                last_note = now
                log(f"TV: could not look at the screen ({type(error).__name__}: {str(error)[:80]})")
            stop.wait(1.0)


def wall(colour) -> None:
    """The TV wall only listens to Govee's cloud, so it gets the room's colour every few seconds."""
    key = govee_key()
    if not key:
        return
    r, g, b = (round(c) for c in colour)
    body = {"requestId": "party", "payload": {"sku": TV_WALL[0], "device": TV_WALL[1], "capability": {
        "type": "devices.capabilities.color_setting", "instance": "colorRgb", "value": (r << 16) + (g << 8) + b}}}
    request = urllib.request.Request("https://openapi.api.govee.com/router/api/v1/device/control",
                                     data=json.dumps(body).encode(),
                                     headers={"Govee-API-Key": key, "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(request, timeout=8).read()  # noqa: S310 - fixed https URL
    except Exception:  # noqa: BLE001 - a slow cloud must not stop the party
        pass


def room_colour(ear: Ear, current, target):
    """Glide the room toward the screen's colour and let the whole room breathe with the bass.

    Returns (the smoothed colour to remember, the colour to send). The glide is what makes it fluid:
    a hard cut on screen becomes a quick sweep in the room instead of a flicker.
    """
    current = mix(current, target, 0.38)
    glow = 0.42 + 0.58 * min(1.0, ear.level[0]) ** 1.3 if ear.playing else 0.6
    return current, tuple(c * glow for c in current)


# --- running it ------------------------------------------------------------------

def run() -> int:
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    shared = {"palette": list(FALLBACK), "track": None, "screen": FALLBACK[0], "looks": 0}

    def follow_track():
        while not stop.is_set():
            track_id, title, art = track()
            if track_id and track_id != shared["track"]:
                shared["track"] = track_id
                if MODE == "cover":
                    try:
                        shared["palette"] = palette_from(pixels(art))
                    except Exception:  # noqa: BLE001 - no cover: keep dancing in the fallback colours
                        shared["palette"] = list(FALLBACK)
                    log(f"track: {title[:50]} -> {['#%02x%02x%02x' % c for c in shared['palette']]}")
                    native_music(shared["palette"])
                else:
                    log(f"track: {title[:50]}")
            stop.wait(3.0)

    threading.Thread(target=follow_track, daemon=True).start()
    threading.Thread(target=stage_loop, args=(stop, shared), daemon=True).start()

    lights = Bulbs(ROOM if MODE == "screen" else BULBS)
    ear = Ear()
    log(f"started in {MODE} mode: {len(lights.ips)} lights driven live")
    position = 0.0
    last_send = last_wall = minute = 0.0
    beats = 0
    current = shared["screen"]
    for frame in frames():
        if stop.is_set() or ear.clock > MAX_SECONDS:
            break
        if ear.feed(frame):
            beats += 1
            position += 1.0
        position += (0.010 + 0.05 * ear.level[1]) if ear.playing else 0.006
        if ear.clock - last_send >= SEND_EVERY:
            last_send = ear.clock
            if MODE == "screen":
                current, send = room_colour(ear, current, shared["screen"])
                lights.show([send])               # one colour, every light, the same instant
                if ear.clock - last_wall >= 5:
                    last_wall = ear.clock
                    threading.Thread(target=wall, args=(current,), daemon=True).start()
            else:
                lights.show(bulb_colours(ear, shared["palette"], position))
        if ear.clock - minute >= 60:
            seen = f", {shared['looks']} looks at the screen, colour now #%02x%02x%02x" % tuple(round(c) for c in current) if MODE == "screen" else ""
            log(f"{beats} beats in the last minute{seen}" + ("" if ear.playing else " (silent)"))
            beats, minute, shared["looks"] = 0, ear.clock, 0
    stop.set()
    # Leave the room lit rather than frozen mid-pulse.
    final = [current] if MODE == "screen" else [tuple(c * 0.8 for c in shared["palette"][i % len(shared["palette"])]) for i in range(2)]
    lights.show(final)
    log("stopped")
    return 0


def listen() -> int:
    ear = Ear()
    beats = 0
    shown = 0.0
    for frame in frames():
        if ear.clock > 20:
            break
        beats += ear.feed(frame)
        if ear.clock - shown >= 1.0:
            shown = ear.clock
            bars = "  ".join(f"{name} {'#' * round(level * 12):<12}" for name, level in zip(("bass", "mid", "treble"), ear.level))
            print(f"{ear.clock:4.0f}s  {bars}  beats so far {beats}", flush=True)
    print(f"{beats} beats in {ear.clock:.0f} s = about {beats / max(1.0, ear.clock) * 60:.0f} a minute; playing: {ear.playing}")
    return 0


if __name__ == "__main__":
    if "--listen" in sys.argv:
        sys.exit(listen())
    if "--palette" in sys.argv:
        _, name, art_url = track()
        print(name, ["#%02x%02x%02x" % c for c in palette_from(pixels(art_url))])
        sys.exit(0)
    sys.exit(run())
