---
name: bamware-smart-home
description: Bilal's apartment from any Bamware agent - Govee lights (inventory, on/off, color, brightness, scenes) and the living-room stereo (Spotify on omarchy over the media bus). Use for any "lights", "lamp", "strip", "Govee", "music", "Spotify", "stereo", "play", "smart home" request, from Discord, Claude Code, or any other harness.
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
| "bottom": white ring under the disc | `bottomLightToggle` | no | no, ignores `brightness` | on/off only; same in the app |

- **Ripple and bottom ring never run together.** Turning one on makes the
  lamp report the other off, both directions. Asking for both is a no.
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
