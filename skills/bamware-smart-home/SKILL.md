---
name: bamware-smart-home
description: Bilal's apartment from any Bamware agent - Govee lights (inventory, on/off, color, brightness, scenes), the living-room stereo (Spotify on omarchy over the media bus), and both TVs (Samsung Tizen, Roku). Use for any "lights", "lamp", "strip", "Govee", "music", "Spotify", "stereo", "play", "TV", "Netflix", "movie", "smart home" request, from Discord, Claude Code, or any other harness.
---

# Smart home: Govee lights

Bilal (2026-10-21): "Can you turn on the lights if I ask you to? And change the
color?" He uses the Govee Home app (glitchy). The build server `omarchy` sits
on the apartment Wi-Fi (192.168.1.0/24), but Govee LAN Control answered nothing,
so control goes through Govee's free cloud API. No spend.

**Where it runs:** everything below runs on the server only. From a laptop,
wrap each command: `ssh server '...'` on the X1, `ssh omarchy '...'` on the
M3. The X1's hostname is also `omarchy`, so check for
`~/.config/bamware/govee.env` (server only) rather than trusting `hostname`
(`docs/machines.md`, "Two laptops in heavy rotation").

## Do

- `scripts/govee.sh devices` → his lights (name, model, id). Match his words to
  a name; `all` for everything.
- `scripts/govee.sh on <name|all>` / `off`.
- `scripts/govee.sh color <name|all> <red|warm|blue|white|purple|orange|pink|#rrggbb>`.
- `scripts/govee.sh bright <name|all> <1-100>`.
- Bilal is red-green colorblind: never pair red with green in a scene, and
  never use red/green as a status signal.
- **Palette (Bilal, 2026-10-29 evening): no blue, ever, unless it is an
  alert.** "I don't like seeing this blue... I'm liking more romantic tones,
  perhaps fall vibes." Blue and lavender are reserved for the too-loud alert.
  Default to romantic fall tones: amber, peach, rust `rgb(190,60,15)`, ember
  `rgb(200,50,10)`, gold, copper, deep candle red `rgb(255,70,0)`, rose as the
  one cooler accent. `govee_lan.py color <light> rust|ember|gold|copper|rose`
  knows them. Night palette now: lamp peach 18%, bulbs and strip amber 8/6%,
  TV wall rust 30%. Earlier "lavender accent" notes below are superseded.
- Power-on restores each light's last saved color. When turning lights on,
  set color and brightness explicitly in the same request (2026-10-29: a bare
  power-on brought back an "obnoxious blue").
- Report what changed in one line ("Living room: on, warm"). If Govee refused,
  say so plainly with its message. Exit 2 = no key on the server: tell Bilal
  the one-time setup below, do not guess.

## LAN first, cloud second (2026-10-29)

From `omarchy`, `scripts/govee_lan.py` talks to the lights directly over the
apartment Wi-Fi: no Govee cloud, no API key, instant, and it reaches lights
the cloud calls "offline" (Bulb Top answered on the LAN at 192.168.1.162
while the cloud had said offline for days). Use it for on/off, brightness,
colour and colour temperature. Use the cloud script for what LAN lacks:
the Uplighter's three toggles, segments, scenes, snapshots, groups.

```
python3 scripts/govee_lan.py scan              # who answers (needs "LAN Control" on per device in the app)
python3 scripts/govee_lan.py status all
python3 scripts/govee_lan.py off "bulb top"    # name substring, ip, id or all
python3 scripts/govee_lan.py kelvin uplighter 3000
```

Requirements, done 2026-10-29: "LAN Control" toggled on in the app for the
bulbs and the Uplighter (the TV backlight did not answer; check its toggle),
and the ufw rule `allow from 192.168.1.0/24 to any port 4002 proto udp` on
omarchy (its default input policy is DROP, which silently ate the replies).
LAN addresses as of 2026-10-29: .161 Smart LED Bulb, .162 Bulb Top, .166
Uplighter, .167 Strip Light; they can change with DHCP, so always scan, never hardcode.

**Speed (2026-10-29, "it kind of will flicker before it gets it right"):**
`govee_lan.py` caches its scan 15 min in `~/.local/state/bamware/govee_lan.scan.json`
(`scan` forces a refresh) and skips the read-back when stdout is not a
terminal. Work mode went from 38 s to 6 s; lights now change together. If a
light stops answering after a router restart, run `govee_lan.py scan` once.
**Verified sends (2026-10-29, "my strip lights didn't update in some of the
modes"):** every on/off/bright/color/kelvin command reads the light back
(sender-checked) and resends up to 3 times; about 0.5 s per command, exit 1
and a stderr line naming the light if it never confirms. Work mode 10 s with
all four lights confirmed.
"Is it done?": the Shortcut's banner appears only after omarchy answers, the
button page prints "done (N ms)", a `/go/` icon's dot lights up.

## The TVs (verified live 2026-10-29)

| TV | Where | Address | Control |
|---|---|---|---|
| Samsung QN90B 65" (Tizen) | living room, the main one | 192.168.1.152, MAC e0:9d:13:6a:f2:0c | `scripts/samsung_tv.py`: REST :8001 for status/app launch, websocket :8002 for remote keys (token in `~/.config/bamware/samsung_tv.token`, paired as "Bamware"), Wake-on-LAN from standby |
| TCL Roku TV 55" (55R615) | bedroom, backup | 192.168.1.93 | `scripts/roku_tv.py`: Roku ECP :8060, no auth; power, keys, launch apps |
| Apple TV 4K gen 3 "Living Room" | living room, **his preferred TV OS, all accounts signed in** | 192.168.1.169 | `scripts/appletv.py` via pyatv (`~/.venvs/smarthome`, srptools pinned 1.0.1): status, apps, launch app, remote keys, type text. Paired Companion + AirPlay as "Bamware" 2026-10-29, creds in `~/.config/bamware/appletv.json`. Prefer it over the Samsung's own apps |

Both scripts run from omarchy; the Samsung one needs `~/.venvs/smarthome/bin/python`
(websocket-client; system python has no pip). In standby the Samsung closes every
port: send `wake` first, it answers within 5 s. First proof 2026-10-29: Roku
woke and opened Netflix on "TV on, Netflix"; Samsung paired and took KEY_HOME;
Apple TV paired and launched Netflix. Bilal (2026-10-29): both TVs are old, the
Apple TV is where he actually watches; a second one for the bedroom is on his
wish list. For "Netflix" default to the Apple TV, with the Samsung on its HDMI.
The pyatv CLI (`atvremote`) crashes on the server's Python 3.14; use the script.

**Samsung remote pairing revoked (2026-10-29 11:40, "turn off, I'm not home"):** the
websocket on :8002 accepted the stored token but answered `ms.error "No Authorized"`
to every key, and `samsung_tv.py key` hangs 30 s waiting for the connect ack. Status
on :8001 still worked. Apple TV `turn_off` did not put the Samsung into standby
over HDMI, so the Samsung stayed on while away. Fix needs Bilal in front of the TV:
delete `~/.config/bamware/samsung_tv.token`, run `samsung_tv.py key KEY_HOME`,
accept the "Allow Bamware?" prompt. Still unpaired on 2026-11-03 (token file dated
before the revocation); until then "away" cannot turn off the living-room TV.

**Live sports and local TV (2026-10-30):** Bilal's only subscription is
Peacock Premium ("I used to have subscriptions to everything but I canceled
them"); he wants NYC local on-air stuff too. Everything plays from the Apple
TV; the Samsung is just the panel ("I hate the Samsung TV OS"). So:
`Peacock` button (`/go/peacock`) wakes both and launches
`com.peacocktv.peacock`: NBC 4 New York live feed, Sunday Night Football,
NBA on NBC Mon/Tue, Premier League, golf. He also has Amazon Prime:
`Prime Video` button (`/go/prime`, `com.amazon.aiv.AIVApp`) for Thursday
Night Football and Amazon's NBA games. Later the same night he signed into
ESPN and installed Pluto TV and Tubi (free), so the button page has a TV
group: Peacock, Prime Video, ESPN, Pluto TV, Tubi (`/go/<name>`; bundle ids
in `TV_APPS` in `buttons.py`). ABC, FOX NOW, CBS Sports, NBC Sports,
Paramount+ are installed but have no login; do not offer them.
**NBA game watcher (2026-10-31, "any time I'm at home and there is a live
NBA game and I have access to it, turn on the TV"):** `scripts/nba_watch.py`
on omarchy, `nba-watch.timer` every 5 min. Reads ESPN's public scoreboard
(`site.api.espn.com/.../nba/scoreboard`: state pre/in/post and broadcaster
names; cdn.nba.com returns 403 from the server). Access map: Prime Video ->
Prime; NBC/Peacock -> Peacock; ESPN/ESPN2/ABC -> ESPN app. Knicks first.
Fires once per game (`nba_watch.<id>` marker), only while presence is home
and 11:00-23:30; turns on the Apple TV, opens the app, lands the Samsung on
the Apple TV, posts "Game on" to Discord. `nba_watch.py status` lists today's
games and access; `off`/`on` pause it; the `Game on` button (`/go/game-on`)
forces it. MSG / regional games are League Pass only: no access, say so.

**Local channels for free:** the Samsung's own Live TV (Samsung TV Plus)
carries NYC local channels; `KEY_TV` on the remote channel opens it
(verified by Bilal 2026-10-30: "that's the Live TV with local channels").
`Local TV` button (`/go/local-tv`). TV Plus is a system app, invisible to
the REST app launcher, and `ed.installedApp.get` over the websocket hung;
the key is the way. True local over-the-air (ABC 7, CBS 2, FOX 5, PIX11) needs
an antenna on the Samsung's tuner (indoor works in Manhattan), which is a
purchase and his call; Rule #1.
**Samsung source by name (2026-11-26, use this first):** Bilal: "you're just
guessing... it's a smart TV, things are always rearranging." The websocket
remote is one-way; only SmartThings can read the TV. `samsung_tv.py sources`
lists the TV's own labels with the current one marked; `samsung_tv.py source
pc` (or `xbox`, `tv`) selects by label and reads it back, exit 1 if the TV did
not confirm. Verified: TV (dtv), XBOX One (HDMI3), PC (HDMI4). A source only
appears while its device sends a signal, so the Apple TV was absent while
asleep. Never count `KEY_SOURCE` presses for a new source.
**Sign-in (2026-11-26):** the script calls Samsung's CLI (`smartthings`, npm
`@smartthings/cli` 3.0.1 in the mise node), which Bilal signed in once in a
browser and which renews itself. `samsung-tv-signin-keepalive.timer` reads the
source list Mon and Thu so the sign-in never sits idle. If it lapses the
script says so: run `smartthings devices` in a terminal on the server and
sign in again. Dead ends, do not retry: personal access tokens last 24 h and
cannot be given app scopes; registering our own OAuth app
(`smartapps:create`) answers "requires a paid plan" (Rule #1). A token file at
`~/.config/bamware/smartthings.token` is only a fallback when the CLI is
missing.
**The server on the TV:** `tv-cast.sh on` enables the output, then selects
"PC". The output is pinned to 4K at 30 Hz in `~/.config/hypr/monitors.lua`:
at 60 Hz the AMD card refused the stream on this cable (kernel `Adding stream
... failed with err 28`) and the panel showed no signal.
**Samsung input, older key path:** `KEY_HDMI1..4` do nothing on the QN90B; `KEY_SOURCE`
cycles inputs (home -> Xbox -> Apple TV, verified by Bilal 2026-10-30).
**`samsung_tv.py appletv`** = wake, wait for the REST port, KEY_HOME, then
KEY_SOURCE twice: lands on the Apple TV from any state. Every TV launch
(vibes `tv_youtube`, the TV buttons) calls it, after the 2026-10-30 morning
when the panel woke on Live TV and Bloomberg played to nobody. If the input
order ever changes (new HDMI device), re-verify the press count with him.
HDMI-CEC on both ends (Apple TV: Settings, Remotes and Devices, Control TVs
and Receivers; Samsung: General, External Device Manager, Anynet+) would
make this unnecessary. `appletv.py status` can lag or report the previous app, so
confirm with him.

### Putting a video on the living-room TV (integration test passed 2026-10-29)

"Put the latest NBA game on my TV": web-search the latest game's official
"FULL GAME HIGHLIGHTS" upload on YouTube (NBA channel), then on omarchy:

```
P=~/.venvs/smarthome/bin/python
$P ~/.local/bin/appletv.py key turn_on
$P ~/.local/bin/appletv.py app "youtube://www.youtube.com/watch?v=<VIDEO_ID>"   # queues it in the YouTube app
$P ~/.local/bin/appletv.py key select                                           # starts playback
$P ~/.local/bin/appletv.py status     # verify: "Playing <title> pos/total" comes from the Apple TV itself
```

Verified: `Playing 'WIZARDS at CAVALIERS | FULL GAME HIGHLIGHTS | October 28,
2026' 1/1008`. Bilal switched the Samsung to the Apple TV's HDMI by hand; the
HDMI port number and his Netflix profile position are still unknown (asked
2026-10-29), after which "Netflix" should wake the Samsung, switch input, open
Netflix on the Apple TV and pick his profile. Known dead ends: AirPlay
`play_url` from pyatv fails "not authenticated" despite a successful AirPlay
pairing (unsolved); `metadata.app` is None on this box, so verify with
`metadata.playing()`; YouTube keyboard focus never reported Focused, so typed
search is unproven. yt-dlp is in the venv if a direct stream is ever needed.

## Presence, quiet hours, and the room's loudness (2026-10-29)

Bilal works from cafes and is in and out all day (BrewDesk exists for that
reason). `scripts/presence.sh` runs every 2 min on omarchy (`presence.timer`):
home = his iPhone or MacBook answered on the apartment Wi-Fi within 15 min
(MACs in the script; the iPhone uses a private address that is stable per
network). On home -> away it turns every light off (LAN + the "Kill" group),
pauses Spotify, and powers off the Apple TV, Samsung and Roku. Coming home
triggers nothing by itself; the vibes timers skip while away. Manual check-in
from any agent: `presence.sh home|away` (3 h override), `presence.sh status`.
Quiet hours 22:00-08:00: the same check caps the stereo at 55% for the
neighbours. Room loudness: omarchy's built-in mic (Apple T2) is dead under Linux (constant
full scale), but Bilal plugged Apple USB-C EarPods into omarchy on 2026-10-29
and their mic works. `scripts/roomlevel.sh` samples 3 s every minute
(`roomlevel.timer`) into `~/.local/state/bamware/roomlevel.log` as dBFS
(uncalibrated: < -45 quiet, -45..-30 music or talk across the room, -25..-15
Bilal talking at the desk, > -15 loud). **Too-loud feedback loop (Bilal's
idea, 2026-10-29):** `scripts/club_alert.py` snapshots every light, turns the
room club blue for 10 s, steps the stereo down 15%, posts "Too loud, the
neighbours can hear" to Discord via `scripts/discord-post.sh`, then restores
every light and verifies each one (re-read, retry 3 times; an unverified light
gets a Discord warning). 5-min cooldown.
**Retuned 2026-10-29 evening:** the first version fired 12 times in one
afternoon because Bilal talks out loud at his desk (an interview read -18..-24
dBFS, as loud as music to the mic), and one dropped UDP restore left a desk
bulb club blue at 100% until he flipped the wall switch. Now it fires only
when the room reads above **-15 dBFS** (`roomlevel.threshold` overrides) for
**2 consecutive samples** (`roomlevel.need`): speech is bursty, music is
steady. `roomlevel.sh mute [minutes]` (default 120) pauses it for interviews
and calls, `unmute` resumes, `status` shows threshold, streak, mute, last
alert. If he mentions an interview or call, mute first. Safe test any time:
`roomlevel.sh club-test` (lights and alert only, volume untouched).
"The lights randomly flicker blue" = this loop; check `roomlevel.log` for
`TOO LOUD` lines before blaming Govee.
Plugging the EarPods in also made them the default OUTPUT; the stereo must stay
on sink "Apple Audio Device Headphones" (`wpctl set-default <id>`), check this
if the stereo goes silent after a USB change.

## Instant buttons (shipped 2026-10-29)

Bilal: "I can't use a prompting-like experience. That's way too slow. It has
to be instantaneous, like a button." `scripts/buttons.py` runs on omarchy as
`buttons.service` (port 8787, stdlib, no AI in the loop): `GET /` is a big
amber-on-dark button page for the iPhone home screen, `POST /do/<action>`
runs one whitelisted shell command (`/actions` lists them: lights-on/off,
dim, bright, evening, cleaning, party, daylight, play, next, prev, vol-up/down,
mute-alert, tv-off). Tailscale fronts it with HTTPS for his devices only:
**`https://omarchy.tailb7fa1e.ts.net:8443`** (set with `tailscale serve
--bg --https=8443 http://127.0.0.1:8787`, no sudo needed; the raw LAN port
stays behind ufw). Verified from the Mac: page 30 ms, "next" 6 ms. iOS
Shortcuts "Get Contents of URL" (POST) on a `/do/...` address gives Siri,
Apple Watch, widgets and the iPhone 15 Pro Action Button. Adding an action is
one line in `ACTIONS`; redeploy = scp + `systemctl --user restart buttons`.
**Lights are the product; music and TV are extras (Bilal 2026-10-31: "Don't ever
break the lights. The TV and the music are not that important. When I use
these shortcuts they better work.")** Incident 2026-10-31 20:46: `buttons.log`
shows Kill, Morning, Evening, Evening pressed within 63 s while the Govee
cloud answered in 3-7 s per call (measured from omarchy AND the Mac, so it
was Govee's side); `buttons.service` ran all four at once and their light
commands interleaved into a jumble that read as "evening is broken". Fixes,
live on omarchy: (1) **last press wins**: a `lights`/`scenes` press kills the
scene still running (`os.killpg`, logged `X CANCELLED by Y` / `X replaced`),
music and TV presses never wait on lights; (2) every Govee `curl` in
`vibes.sh` and `govee.sh` carries `-m 8`, so a hung cloud can never stall a
button past 8 s per call; (3) a phone that gives up waiting no longer
tracebacks the service (BrokenPipe swallowed). Diagnose a "broken" scene from
the log first: `tail ~/.local/state/bamware/buttons.log` (name, ok/FAIL,
ms), then time one cloud call; a normal scene is 5-12 s, a 30-60 s run means
the Govee cloud is slow, not the lights.
**One-tap home-screen buttons (2026-10-29, replacing his glitchy Govee
widgets "Kill / Lights / TV / Morning Lights"):** `GET /go/<action>` is a
page that runs the action the moment it opens and shows the result, with its
own name and amber/rust tile via `/icon/<action>.png`. Safari on the iPhone:
open `https://omarchy.tailb7fa1e.ts.net:8443/go/lights-off`, Share, Add to
Home Screen; the icon is the button. His set: `/go/lights-off` (Kill, every
light and the TV wall), `/go/lights-on`, `/go/cleaning`, `/go/party`, `/go/evening`. The
Govee app widgets and groups can be deleted; nothing here depends on them.
Tailscale serve answers 502 for a second or two after a restart: wait, do
not debug.
Log: `~/.local/state/bamware/buttons.log`. Primer:
https://claude.ai/artifact/7Jy7fEUvY1bwDqrwrFDe9N. When he asks for a new
reflex ("make X a button"), add it there, never a chat command.

## Push-to-talk (shipped 2026-10-31, trial until 2026-11-14)

Bilal's north star is a voice operating system (Jarvis, Her). He is one
person, so we build no audio stack: the phone's dictation and speech are the
microphone and speaker, and omarchy answers. `scripts/ask.py` runs as
`ask.service` on 127.0.0.1:8788, fronted by
**`https://omarchy.tailb7fa1e.ts.net:8788/ask`** (`tailscale serve --bg
--https=8788 http://127.0.0.1:8788`). `POST /ask` with the sentence as the body
(raw text or `{"text": ...}`), plain text back. Two routes, reflex first:

- **Reflex:** the sentence is one of the button phrases in `REFLEX` ("lights
  on", "kill the lights", "next song", "quiet the mic"); ask.py calls
  `buttons.py` over loopback. Measured 0.3 s end to end over the tailnet.
- **Agent:** anything else runs one headless `claude -p` in
  `~/code/worktrees/bamware-ai-main` with read-only tools (same deny list as
  `daily-brief.sh`), 45 s timeout, prompt asks for at most 40 spoken words.
  Honors `~/.local/state/bamware/cfo/halt.json`. Measured 15.6 s.
- Log: `~/.local/state/bamware/ask.log` (time, route, latency). This is the
  trial meter: an agent ask on 10 of 14 days means voice continues (wake
  word next); fewer means shelve it. Primer:
  https://claude.ai/artifact/2eWru4MPctwJKDPrNBGMmB. Ticket #295.

Shortcut **Jarvis** (Dictate Text, Get Contents of URL POST, Speak Text):
`python3 scripts/make-jarvis-shortcut.py ~/Downloads/Bamware\ Shortcuts`
signs it, `open` imports it (one "Add Shortcut" click), then Settings >
Action Button > Shortcut > Jarvis on the phone. Redeploy = scp `ask.py` and
`systemctl --user restart ask`. Tests: `python3 -I scripts/tests/test_ask.py`.
New phrase for an existing button = one entry in `REFLEX`; a new action still
goes in `buttons.py` first. Day-two idea, only if the log shows follow-up
questions: a session id per hour with `--resume`.

## Daily vibes (shipped 2026-10-29, v1)

Bilal's standing ask: "always set the scenery and set the vibes", replace the
alarm clock, news on the TV in the morning, bright and chill in the afternoon,
romantic wind-down in the evening; background company = NBA, golf, AI/tech
podcasts, NYC. `scripts/vibes.sh morning|afternoon|evening` runs on omarchy
from systemd user timers `vibes-{morning,afternoon,evening}.timer` at
08:00 / 13:00 / 19:30 America/New_York (`systemctl --user list-timers`).

| Moment | Lights | Stereo | Screen |
|---|---|---|---|
| morning | 6-min sunrise on the lamp (5->85%), strip and desk bulbs warm then 4000K | Peaceful Piano, 45% | Samsung + Apple TV on, YouTube live news (Bloomberg `@markets/live`, else CNBC, NBC) |
| afternoon | everything 4500K, lamp 100%, strip 70%, bulbs 40% | lo-fi beats, 70% | latest NBA channel video on YouTube |
| evening | Candlelight on lamp (55%) and TV wall (12%), strip rose 3%, bulbs amber 1% | Late Night Jazz, 65% | untouched |
| cleaning (on demand) | bulbs and strip 100% at 5000K; lamp bottom ring + ripple, disc off (his look, photo 2026-10-29); TV wall warm white `rgb(255,235,205)` 100% (5000K on the H6099 photographs lavender); touches `lights.hold` | I Love My '90s Hip-Hop `spotify:playlist:37i9dQZF1DX186v583rmzp`, 75%, shuffled ("Way better music" after Mood Booster flopped) | untouched |
| party (on demand, 2026-10-31) | cleaning brightness, moving colour: every light 100%, `party_loop` in `vibes.sh` rotates hot pink, orange, gold, candle red, fuchsia across bulbs, strip, lamp disc every 4 s (each device one step out of phase) and the TV wall every 8 s, for 3 h; lamp = `Cleaning` snapshot (ring + disc), ripple off; no blue, no green; touches `lights.hold`; PID in `~/.local/state/bamware/party.pid`, any other scene, Kill/Lights on/Dim/Bright or `vibes.sh party-stop` ends the loop | Dance Party `spotify:playlist:37i9dQZF1DXaXB8fQg7xif`, 80%, shuffled | untouched |

| work (on demand, v2 2026-10-29) | **light near the ceiling, nothing at eye level** ("I don't want to be blinded looking at my monitors"): lamp via app snapshot `Work` else `Low light chill both` (ripple 100% + faint ring, disc off); desk bulbs amber 1%; strip amber 1%; TV wall off; mutes the mic alert 3 h; touches `lights.hold` | Deep Focus `spotify:playlist:37i9dQZF1DWZeKCadgRdKQ`, 50% ("perfect") | untouched |

**Morning v2 (2026-10-29, "mimic the sun... gloomy rainy mornings... very
depressing"):** same eye-level rule as work. Desk bulbs amber 1%; lamp ripple
+ ring (snapshot "Morning", else "Work"); TV wall vibrant sunrise orange
`rgb(255,120,20)` 100%; kitchen strip warm 2700K ramping to 100% then 3000K
(he cooks); "Have a Great Day!" `spotify:playlist:37i9dQZF1DX7KNKjOK0o75`
55%; news on the TV in the background. The 08:00 timer ramps over ~6 min,
the button (`--now`) at once. **Ring level is app-only:** Bilal saves lamp
snapshots in the Govee app named `Work` (ripple on, ring 2-3%, disc off),
`Morning` (same, ring brighter) and `Clean` (ring 100% + disc 100% 5000K);
`vibes.sh` recalls them by name via `snapshot()` and falls back to toggles
when a name is missing. **His set after the 2026-10-30 cleanup:** `Focus
bright` (work), `Morning bright` (morning), `Cleaning` (cleaning), `Low
light chill both` (his default look). Calibration is his: Govee Home,
Uplighter, set the three lights by hand, save a snapshot, tell the agent
the name; the agent wires the name to a mode and replays it. The API can
replay a snapshot by number but never read or edit what is inside it.

**Morning as a button (2026-10-29):** `vibes.sh morning --now` does the
sunrise in seconds instead of 6 min and ends with the kitchen strip at 80%
because he cooks breakfast; the 08:00 timer still does the slow version. The
`Morning` and `Work` buttons exist on the button page and as `/go/morning`,
`/go/work`. **Welcome home (2026-10-29):** `presence.sh` on a real away ->
home flip runs the scene for the hour (before 11:00 morning at once,
11:00-18:30 `daylight.py`, after that evening), clears `lights.hold`, logs to
`~/.local/state/bamware/presence.log`. Presence is Wi-Fi based (his iPhone or
MacBook seen within 15 min), so "home" lags arrival by up to 2 min and
"away" by 15.

"Cleaning lights" (Bilal, 2026-10-29: "bottom definitely 100% and then
whatever is the most you can do with the other lights"): `vibes.sh cleaning`.
**Manual scenes win over the schedule:** scheduled morning/afternoon/evening
runs and `daylight.timer` skip while `~/.local/state/bamware/lights.hold` is
under 3 h old (the 19:30 run clobbered cleaning lights once). `vibes.sh
release` drops the hold; `vibes.sh evening --force` overrides it. When he says
he is done cleaning: release, then `daylight.py` (afternoon) or `vibes.sh
evening` (night).

**Daylight tracking (2026-10-29, "it's ridiculously bright in here, adjust
the lighting based on the daylight"):** the afternoon preset used to stay at
lamp 100% / 4500K until the 19:30 evening run, an hour after sunset.
`scripts/daylight.py` computes the sun's elevation over Greenwich Village
(NOAA formula, no network) and interpolates between keyframes: full day 4500K
lamp 100% bulbs 40% strip 70%; 15 deg 3900K; golden hour 3300K; sunset 2900K
lamp 40%; civil dusk 2700K; below -8 deg the soothing night palette (lamp
peach 18%, bulbs and strip amber 8/6%, TV wall lavender 30%). `daylight.timer`
runs it every 20 min 13:00-19:20 (`--dry --at 17:30` previews). It skips while
away and for 3 h after `~/.local/state/bamware/lights.hold` is touched: touch
that file after any manual scene in the afternoon so the tracker does not
undo it. Morning and evening vibes own their windows. Not built: cloud cover
(Open-Meteo is free and keyless if he wants grey days brighter).

Live video ids are resolved at run time with `yt-dlp --get-id <channel>/live`
(handles change; `@Bloomberg` is dead, `@markets` works). Iterate from his
feedback; he asked for creativity ("test your boundaries, impress me"). Ideas
not built yet: golf in the background, AI podcasts via Spotify shows, weather
and NYC events in the morning, a "movie night" preset, Peacock game nights
(timer `gameday.timer` exists for Mon 2026-11-02).

## The lights (inventory, verified live 2026-10-29)

One-bedroom apartment in New York City. The living room is one open space
with the kitchen; the TV wall is on the right, windows at the back.

| Name in Govee | Model | Device id | Where | Notes |
|---|---|---|---|---|
| Smart LED Bulb | H6006 | `11:AC:5C:E7:53:99:CB:E6` | ceiling fixture, living room | main room light |
| Smart LED Bulb Top | H6006 | `16:BA:5C:E7:53:99:82:EE` | same ceiling fixture | **offline since at least 2026-10-26**: Govee answers 400 "Device is offline". Bilal is not worried about it; mention once, never nag |
| Uplighter Floor Lamp | H60B0 | `40:F9:DA:C3:41:06:03:53` | black pole lamp by the window, left of the mirror | three lights, see below; his favourite, bought for the ceiling ripple |
| TV Backlight 3 Lite | H6099 | `1C:CF:D4:0F:40:46:18:6A` | behind the TV | wall wash; the TV is usually off, so this is the accent light |
| Strip Light | H61F2 | `22:A6:C2:53:56:54:74:A1` | kitchen under-cabinet | re-paired 2026-10-29 (was the "unpaired strip"); LAN at .167; on/off, brightness, colour |
| Indoor thermometer | H5075 | `68:68:A4:C1:38:87:AB:20` | living room | Bluetooth-only, reports offline to the cloud. Not a light |
| Kill, Morning, Basic Group Control | BaseGroup | 15560214 / 15560142 / 15546539 | app groups | accept `powerSwitch` on/off only (verified 2026-10-29); for colour drive the member lights |

The white torchiere with a gooseneck on the right wall by the desk holds the
two H6006 bulbs ("the smart bulbs by my desk", 2026-10-29). The ceiling
fixture is a dumb light.

### The Uplighter (H60B0), verified by photo 2026-10-29

Three lights, Bilal's words in quotes:

| Light | Toggle instance | Colour | Brightness | Notes |
|---|---|---|---|---|
| "top": ripple projection onto the ceiling | `rippleLightToggle` | no, fixed rainbow prism | no | the reason he bought it |
| "middle": the disc head | `sideLightToggle` | yes: `colorRgb`, `colorTemperatureK`, `segmentedColorRgb` zones 0-7 | yes: `brightness`, `segmentedBrightness` | |
| "bottom": white ring under the disc | `bottomLightToggle` | no | follows the lamp `brightness`, shared with the ripple (confirmed 2026-10-29 23:55); no separate control from the API | |

- **One dimmer for the whole lamp (confirmed 2026-10-29 23:55, by his eyes):**
  `brightness` dims whichever lights are on, ring and ripple together
  (brightness 1 with disc off: "the bottom ring is good now but the top is
  very dark"). `segmentedBrightness` does nothing for the ring. So "ring 1%,
  ripple 100%" cannot be SENT, but the Govee app can set the ring alone and
  an app snapshot keeps it: recalling "Low light chill both" gave ripple
  full + ring faint ("Yes this is what I wanted for work mode", 2026-10-30).
  Work recalls snapshot `Focus Bright` (he saved it 2026-10-30: ripple
  100%, ring ~1%, disc off), then `Work`, then `Low light chill both`.
  Snapshot names match loosely (case and surrounding spaces ignored; the app
  stored his as "Focus bright "). To change the ring level he re-saves the
  snapshot in the app. The earlier
  "brightness ignores the ring" note was wrong: that test sent 100 onto a
  ring already at 100. **We have no eyes:** the lamp reports toggles and a
  number, never what the room looks like; ask Bilal or ask for a photo
  before claiming a lamp result.
- **At most two of the three lights are on at once** (verified 2026-10-29
  evening with 6 s waits): ripple + bottom works only while the disc is off;
  turning the disc on drops the bottom ring; turning the bottom ring on while
  disc + ripple are on drops the ripple. Send the light you care about LAST.
  Bottom-heavy max (cleaning): bottom + disc 100%, ripple off. No API
  brightness exists for the bottom ring or ripple (only the disc's
  `brightness`). Wait 5 s before reading state after a toggle.
- His default lamp look: ripple on, bottom ring on, disc off ("the only part
  that's off is the middle"). Snapshot "Low light chill both" = that look.
- The lamp `brightness` and `colorTemperatureK` act on the disc only.
- `segmentedColorRgb` / `segmentedBrightness` accept segments 0-7 (8 returns
  "out of range"); they are zones of the disc, not the three lights.
- Scenes: `POST /device/scenes` lists ~120 (Water Drop, Floating Mist,
  Aurora, Candlelight, Starry Sky...). Send the option's `value` object
  verbatim (`{"id":27668,"paramId":39204}` for Water Drop); guessing
  `paramId` fails. "service is busy" = retry once after 5 s.
- Snapshots he saved in the app, recallable via `dynamic_scene`/`snapshot`:
  "Bam day", "Low light chill both".
- Music modes exist (Stippling, Hopping, Flowing Light, Luminous, Sprouting,
  Rhythm, Shiny) but are untested.
- His preference (2026-10-29): light at the top, floor level dim. The
  "ceiling-only" look that landed: bottom off, ripple on, disc warm 2700K at
  15%, ceiling bulb 5%, TV backlight amber 15-40%. He reads colours from
  photos, not by eye: ask for a photo instead of asking what colour he sees.

Not in the account: a kitchen under-cabinet LED strip. It lights up fine on
its own but lost its pairing; Bluetooth finds it, pairing always fails, and
the controller button does not reset it. Bilal decided to leave it
(2026-10-29). Do not troubleshoot it unless he brings it up.

Key location: `~/.config/bamware/govee.env` on the MacBook (installed
2026-10-26). The same file still needs copying to `omarchy` for the Discord
seat. The key is only in those files, never in a repo, Notion or Discord.

Known Govee behaviour (measured from omarchy 2026-10-29, same Wi-Fi): the
lights' Wi-Fi is fine. Three Govee devices on the LAN (192.168.1.161 = Smart
LED Bulb, .166 and .167 = TV backlight / Uplighter), 20 pings each, 0% loss,
jittery 2.4GHz (avg 12-61 ms, worst 237 ms) but no drops; 90 s of cloud
polling showed no flapping. The "connecting, disconnecting" he sees is the
Home app's Bluetooth path hopping between lights when his phone is nearby.
The cloud `online` flag is the honest signal. A cloud "offline" can be a lie: Bulb Top
answered on the LAN at .162 while the cloud said offline for days. Scan the
LAN before telling him a light is dead. Govee LAN Control (UDP 4001/4002) answered
nothing; it needs the per-device "LAN Control" toggle in the app first.
A Govee hub would not help: hubs bridge Bluetooth-only sensors (his H5075),
not Wi-Fi lights. Groups (Kill, Morning, Basic Group Control) DO accept
`powerSwitch` via the API (sku BaseGroup, device = the numeric id); they
expose nothing else. Three to four seconds
after a command, `device/state` reflects it. A control call is one of the
10,000 daily calls; a state call is another.

### Scenes that worked

- **Romance (2026-10-29, "I'm in love", "so impressed"):** every light on
  Govee's built-in `Candlelight` scene, per-light brightness first and the
  scene LAST (any brightness/toggle/colour sent after a scene cancels it):
  lamp 70% (ripple on, bottom ring on, disc off), TV backlight 15%, kitchen
  strip 6%, desk bulb 5%; Bulb Top (cloud-offline) steady `rgb(255,70,0)` at
  1% over the LAN; stereo on Spotify "Late Night Jazz"
  `spotify:playlist:37i9dQZF1DX4wta20PHgwo`, shuffled. The room goes one deep
  candle red with the ripple rolling over the ceiling. Other scenes all four
  lights share: Sunset, Aurora, Forest, Starry Sky, Valentine's Day, Rainbow.
- **Slow Sunset (2026-10-29):** `scripts/govee_sunset.py [minutes]` on omarchy,
  detached. All lights drift amber `rgb(255,140,40)` to lavender
  `rgb(110,70,200)` in 40 steps, ceiling easing 70% to 40%. Blue/orange
  endpoints by design for his colour vision. "Stop the sunset" =
  `pkill -f "govee_sunset.p[y]"` (bracket trick so pkill doesn't match its
  own shell, which has killed my commands three times tonight).
- **Desk bulbs too bright at 1%:** colour is the second dimmer. Deep amber
  `rgb(255,70,0)` at 1% reads like a candle; white at 1% reads like a lamp.


- **Evening / soothing (2026-10-29, "impress me"):** ceiling bulb amber
  `rgb(255,140,40)` 12%, floor lamp peach `rgb(255,170,100)` 18%, TV backlight
  lavender `rgb(110,70,200)` 30%. His verdict before this: "these lights are
  too bright bro".
- **Reset / neutral:** all three online lights `colorTemperatureK` 2700, 40%.

## The stereo (verified live 2026-10-29)

**Aux, not Bluetooth (Bilal, 2026-11-26):** the speaker is a Marshall
**Kilburn III**. He chose aux for quality (uncompressed, no lip-sync delay);
the server's Bluetooth adapter works and AAC/aptX are installed if that ever
changes, nothing is paired. **"It shuts off by itself":** Marshall speakers
go to standby after about 10 min without signal and, per a user report, treat
a quiet aux input as silence; Marshall says it cannot be disabled on the
Kilburn II, and nothing was found for the III (its Marshall Bluetooth app
settings are unchecked). Our side: keep the sink at the 0.83 reference so the
signal is strong. `presence.sh` remembers the level its 22:00 cap replaced
and restores it after 08:00 (before this the cap never lifted). If it still
sleeps in pauses, next is a keep-alive tone while nothing plays, tested with
him listening. Whether staying on wall power prevents standby is his open
experiment.

Marshall Kilburn III Bluetooth speaker under the TV, fed by an AUX cable from
`omarchy`'s headphone jack (Apple T2 audio, PipeWire sink "Apple Audio Device
Headphones", card profile "HiFi (Headphones, Mic)"). Bilal installed the
Spotify desktop app himself (`/opt/spotify/spotify`, his account); it runs in
his desktop session and exposes MPRIS. Drive it from an SSH shell:

```
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus XDG_RUNTIME_DIR=/run/user/1000
P="busctl --user"; D=org.mpris.MediaPlayer2.spotify; O=/org/mpris/MediaPlayer2; I=org.mpris.MediaPlayer2.Player
$P call $D $O $I OpenUri s "spotify:playlist:37i9dQZF1DX889U0CL85jj"   # play a URI (track/album/playlist)
$P call $D $O $I Pause | Play | Next | Previous
$P set-property $D $O $I Shuffle b true
$P get-property $D $O $I PlaybackStatus ; Metadata                       # verify, always
wpctl get-volume @DEFAULT_AUDIO_SINK@                                    # 0.83 = his reference level
```

- Reference volume: sink 0.83, Spotify volume 1.0, the Kilburn dial does the
  rest. Do not change either unless asked.
- **The speaker is portable and its dial moves (Bilal, 2026-11-26):** "I
  unplug the Bluetooth speaker all the time and take it outside, and so the
  knobs are going to change." So a server level is never a loudness: 0.83
  was "too loud" and 0.60 "the max, for my neighbours" on one afternoon with
  one dial position, and neither number means anything after the next trip
  outside. Do not hard-code ceilings from a remark like that (one was added
  and removed the same day). When he says too loud or too quiet, step the
  sink and stop; when starting music after the speaker may have moved, start
  modest and let him adjust. The scene levels in `vibes.sh` (0.50 to 0.80)
  are relative to each other only. The speaker may also simply be gone:
  silence with everything green can mean it is outside on Bluetooth with his
  phone.
- **Video on the big TV from the server: `tv-play.sh <id|url>`, `tv-play.sh
  stop` (2026-11-26).** Bilal: "I prefer 4K at the highest resolution
  possible." The script puts the TV on PC and runs mpv full screen on the TV
  output with the video's best stream up to 2160p (yt-dlp from the smarthome
  venv); it prints the resolution actually on screen. Verified: Drake "Cold
  Shoulder" at AV1 3840x2160, software decode at about 170% of one core, no
  dropped frames, keyboard focus untouched, sound out the aux. No browser
  page, so no quality guessing and no ads. Log:
  `~/.local/state/bamware/tv-play.log`. Newest official uploads:
  `yt-dlp --flat-playlist --playlist-end 12 --print "%(id)s | %(title)s" <channel>/videos`.
  The first version (a Chromium app window on the watch page, fullscreen,
  then `F`) worked but picked a lower quality and played an ad first.
- **Spotify music videos on the TV (verified 2026-11-26; Spotify is his
  primary music, he is building a party mode).** The Linux app (1.3.8) has
  them. Launch `spotify` on the TV's workspace, `OpenUri` a track or
  `spotify:search:<words>` (the search URI started playing the top song),
  then click "Switch to video" in the Now Playing panel. The app said
  "Desktop will keep playing video when available, until you change back to
  audio", so that click should be needed once, not per song (not yet
  re-verified after a restart). Full screen: set the window fullscreen in
  Hyprland, then double-click the video. Clicking Spotify's own fullscreen
  icons only paused playback. There is no MPRIS or Web API call for video;
  it is pointer work: `hl.dsp.cursor.move({ x, y })` then
  `hl.dsp.send_key_state` with key `mouse:272` down and up, in global
  logical pixels (the TV starts at x=1536). Button positions come from a
  `grim -o <tv>` screenshot, never from memory: the layout moves. Give
  keyboard focus back to his window afterwards. **Phone as the remote:**
  the app is a Spotify Connect device, so his phone's Spotify app can pick
  this computer and change songs with nothing built by us.
- **Party = lights + his music + the TV, not a playlist (Bilal, 2026-11-26).**
  "Party mode does not mean literally play party music! It's about sticking
  the lights and the music and the TV together." After the first version
  (rotating colours, Spotify's dashboard on the TV): "party mode sucks. I
  want the lights to be way more dynamic and changing with the music
  frequency... music videos full screen by default... the colors from Spotify
  as the inspiration for the lights dancing in my room. I want movement,
  fluidity, dynamism. Even the presets that come with the Govee app are
  better." What `vibes.sh party` does now:
  - **Music:** whatever is playing stays, at his volume. Dance Party starts
    only into silence, at the current volume.
  - **TV:** `tv-spotify.sh` casts, puts Spotify on the Samsung and makes sure
    it runs with its developer port. `party_stage.py` then keeps the TV right
    every 2 s: a track with a video gets that video element full screen, a
    track without one gets Spotify's own full-screen cover view, and keyboard
    focus goes back to whoever had it.
  - **Lights:** `party_stage.py` (smarthome venv). Palette = the few most
    vivid hues of the current cover, renewed per track; a colourless cover
    gets the classic party palette; green is dropped beside red. The two
    H6006 bulbs have no music mode, so they are driven live over the LAN
    about 8 times a second from the server's own audio (sink monitor): one
    follows the bass, the other mids and treble, both slide through the
    palette and jump on each beat. The strip (Spectrum), TV wall (Spectrum)
    and floor lamp (Flowing Light) are put in Govee's own music modes in the
    palette's colours, once per track; those animate from each light's
    built-in microphone.
  - **Lights, second version the same day: the whole room follows the TV.**
    "Much better... I just don't like the color pattern. It'd be really cool
    if all the lights were in sync together, like the whole room was changing
    colors. Let's go completely off the music video screen and don't worry
    about the blue rule." So the default (`PARTY_MODE=screen`) reads the
    picture on the TV about 6 times a second, takes its dominant vivid hue at
    full strength, and sends that one colour to all four LAN lights at the
    same instant; the room glides to each new colour and its brightness
    breathes with the bass. The TV wall is cloud-only and follows every 5 s.
    A black frame holds the last colour; a colourless frame is warm white, as
    bright as the frame. Verified over a minute of a video: 366 looks, four
    lights reading the same colour each time, tracking the picture's hue.
    **How it looks at the TV: `grim -g` on three thin strips, in turn, about
    0.1 s each.** It works for anything on the TV, not only Spotify. Capture
    cost grows with area: the middle half of the screen took 0.7 s with a
    video playing, the whole 4K output 1.4 s. Dead ends, do not retry:
    reading the `<video>` from inside Spotify returns black (protected
    video); `Page.captureScreenshot` over the developer port worked on the
    cover view, then stalled with a video full screen and left the page's
    viewport stuck at 0x0, which blanked the TV until full screen was left. `PARTY_MODE=cover` keeps the first
    version (a palette from the cover, each light its own colour, Govee's
    music modes on the strip, TV wall and lamp). **No colour rules apply in
    party mode**, by his word; every other scene keeps the warm palette.
    The Govee TV Backlight's own camera mode is not reachable from the API.
  - **The ceiling strip is Bluetooth-only (found 2026-11-26).** "That strip
    light on my ceiling is the only light that's not changing colors. Are
    you sure you can't change it?" It is a Govee **H617A**, Bluetooth
    address `E8:55:02:86:73:73` (advertises as `Govee_H617A_7373`). It is
    not on the Wi-Fi and not in the Govee account's device list, so the LAN
    and the cloud never saw it and it was missing from the inventory above.
    The server's own Bluetooth adapter reaches it with `bleak` (installed in
    the smarthome venv): write 20-byte packets to characteristic
    `00010203-0405-0607-0809-0a0b0c0d2b11`, last byte the XOR of the rest.
    Power `33 01 01`, brightness `33 04 <0-100>`, all segments one colour
    `33 05 15 01 R G B 00 00 00 00 00 FF FF`, read segments back with
    `AA A5 01` (answer on `...2b10`). Verified by read-back: orange, violet,
    then the same red as the four Wi-Fi lights mid-party. `party_stage.py`
    keeps the connection and repaints it with the room; while it is
    connected the Govee app on his phone cannot connect to that strip. No
    other scene or button knows this strip yet: Kill does not turn it off.
  - **The floor lamp in party mode: disc + ceiling ripple on, white ring
    off, dimmer 100.** His words, and how to read them: "the lamp has to be
    off, which is fine, but the top two should be on... I want the disk on
    too, obviously." **"The lamp" = the white bottom ring; "the top two" =
    the disc and the ripple.** (An agent first read "turn off the lamp and
    only use the top light with the ripple at 100%" as ripple alone and
    turned the disc off; he corrected it.) The disc takes the room's colour
    from the stage with the other three LAN lights; the ripple is a fixed
    rainbow prism with no colour control. The ring goes off first because
    the lamp runs two of three and the last toggle wins. An app snapshot
    named `Party` wins over the toggles. Verified by read-back twice after
    pressing the button: ripple 1, disc 1, ring 0, all four lights the same
    colour. It used to recall the "Cleaning" look (ring + disc at 100%).
  - Stop: any other scene, Kill, or `vibes.sh party-stop` (same PID file as
    the old loop, which remains the fallback). Log:
    `~/.local/state/bamware/party-stage.log` (track, palette, TV state,
    beats per minute). Dry runs that touch nothing: `party_stage.py --listen`,
    `--palette`. Tests: `python3 scripts/tests/test_party_stage.py`.
  - **Album colours override the "no blue" rule in party mode only.** He
    asked for Spotify's colours, and covers are often blue. Every other scene
    keeps the warm palette.
- **Driving Spotify: the developer port, not clicks.** Started with
  `--remote-debugging-port=9222` (localhost only; `tv-spotify.sh` restarts a
  launcher-started Spotify once to get it), the app's page takes JavaScript
  over the Chrome DevTools protocol: buttons by `aria-label`
  ("Enter Full screen", "Switch to video", "Video quality") and
  `video.requestFullscreen()` with `userGesture`. That is what made full
  screen reliable. Dead ends, do not retry: simulated pointer clicks
  (`send_key_state` with `mouse:272`) landed on some elements and were
  ignored by the video buttons; `OpenUri` navigates Spotify away from its
  full-screen view. Many tracks have no video (six in a row in Dance Party);
  Spotify's video tops out around 1080p, so `tv-play.sh` is still the 4K path.
- Verify after every command: PlaybackStatus "Playing" and an active Spotify
  stream on the Headphones sink (`wpctl status`). Silence with everything
  green means Spotify Connect moved playback to another device (phone,
  AirPods, the Mac): say where it went instead of retrying.
- No search by name yet: playing needs a Spotify URI or link. A Spotify Web
  API app on his developer dashboard would add search (client id in a
  600-mode file, never in the repo); he has not asked for it.
- Do not install Spotify clients or daemons on omarchy. 2026-10-29: spotifyd
  and spotify_player were installed and then removed at his request ("chill
  on the install Spotify, I'll do it myself"). The desktop app is his.
- "Chill" = Spotify's Chill Vibes `spotify:playlist:37i9dQZF1DX889U0CL85jj`
  (2026-10-29, "Perfect").

## One-time setup (Bilal)

Govee Home app → profile tab → Settings (gear) → "Apply for API Key" → the key
arrives by email. On the server: `~/.config/bamware/govee.env` containing
`GOVEE_API_KEY=...` with `chmod 600`. The key is a secret: never in git, never
echoed. Govee allows 10,000 API calls per day per key; a light command is one.

## Don't

- No schedules, scenes or automations without an explicit ask (they are easy
  to add later: a systemd timer calling the script).
- Never store the key in this public repo, Notion or Discord.
