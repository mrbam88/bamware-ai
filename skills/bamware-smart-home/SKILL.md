---
name: bamware-smart-home
description: Bilal's apartment from any Bamware agent - Govee lights (inventory, on/off, color, brightness, scenes), the living-room stereo (Spotify on omarchy over the media bus), and both TVs (Samsung Tizen, Roku). Use for any "lights", "lamp", "strip", "Govee", "music", "Spotify", "stereo", "play", "TV", "Netflix", "movie", "smart home" request, from Discord, Claude Code, or any other harness.
---

# Smart home: Govee lights

Bilal (2026-10-21): "Can you turn on the lights if I ask you to? And change the
color?" He uses the Govee Home app (glitchy). The build server `omarchy` sits
on the apartment Wi-Fi (192.168.1.0/24), but Govee LAN Control answered nothing,
so control goes through Govee's free cloud API. No spend.

## Do

- `scripts/govee.sh devices` → his lights (name, model, id). Match his words to
  a name; `all` for everything.
- `scripts/govee.sh on <name|all>` / `off`.
- `scripts/govee.sh color <name|all> <red|warm|blue|white|purple|orange|pink|#rrggbb>`.
- `scripts/govee.sh bright <name|all> <1-100>`.
- Bilal is red-green colorblind: never pair red with green in a scene, and
  never use red/green as a status signal. Soothing palette that works for him:
  amber, peach, warm white at low brightness, with blue or lavender as the one
  accent (2026-10-29 evening scene: ceiling amber 12%, floor lamp peach 18%,
  TV backlight lavender 30%).
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
search is unproven. `yt-dlp` is in the venv if a direct stream is ever needed.

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
(uncalibrated: < -45 quiet, -45..-30 music or talk, > -25 loud). **Too-loud
feedback loop (Bilal's idea, 2026-10-29):** above the threshold
(`~/.local/state/bamware/roomlevel.threshold`, default -25, calibrate in
daytime) `scripts/club_alert.py` snapshots every light, turns the room club
blue for 10 s, steps the stereo down 15%, posts "Too loud, the neighbours can
hear" to Discord via `scripts/discord-post.sh`, then restores every light
exactly. 5-min cooldown. Safe test any time: `roomlevel.sh club-test` (lights
and alert only, volume untouched); verified 2026-10-29 03:20, all four lights
restored to the running sunset lavender.
Plugging the EarPods in also made them the default OUTPUT; the stereo must stay
on sink "Apple Audio Device Headphones" (`wpctl set-default <id>`), check this
if the stereo goes silent after a USB change.

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
| "bottom": white ring under the disc | `bottomLightToggle` | no | unproven: ignored lamp `brightness` once; Bilal says the app dims it to 2% | |

- Ripple and bottom ring DO run together (verified 2026-10-29 in both orders;
  an earlier "mutually exclusive" finding came from stale state reads right
  after a toggle). Wait 5 s before reading state after a toggle.
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

Marshall Kilburn Bluetooth speaker under the TV, fed by an AUX cable from
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
