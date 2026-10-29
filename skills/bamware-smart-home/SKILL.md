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

## The lights (inventory, verified live 2026-10-29)

One-bedroom apartment in New York City. The living room is one open space
with the kitchen; the TV wall is on the right, windows at the back.

| Name in Govee | Model | Device id | Where | Notes |
|---|---|---|---|---|
| Smart LED Bulb | H6006 | `11:AC:5C:E7:53:99:CB:E6` | ceiling fixture, living room | main room light |
| Smart LED Bulb Top | H6006 | `16:BA:5C:E7:53:99:82:EE` | same ceiling fixture | **offline since at least 2026-10-26**: Govee answers 400 "Device is offline". Bilal is not worried about it; mention once, never nag |
| Uplighter Floor Lamp | H60B0 | `40:F9:DA:C3:41:06:03:53` | right wall by the TV | bright; has side/bottom light toggles; reads brighter than the number says |
| TV Backlight 3 Lite | H6099 | `1C:CF:D4:0F:40:46:18:6A` | behind the TV | wall wash; the TV is usually off, so this is the accent light |
| Indoor thermometer | H5075 | `68:68:A4:C1:38:87:AB:20` | living room | Bluetooth-only, reports offline to the cloud. Not a light |
| Kill, Morning, Basic Group Control | BaseGroup | | app groups | listed by the API but **not controllable** through it; drive the member lights |

Not in the account: a kitchen under-cabinet LED strip. It lights up fine on
its own but lost its pairing; Bluetooth finds it, pairing always fails, and
the controller button does not reset it. Bilal decided to leave it
(2026-10-29). Do not troubleshoot it unless he brings it up.

Key location: `~/.config/bamware/govee.env` on the MacBook (installed
2026-10-26). The same file still needs copying to `omarchy` for the Discord
seat. The key is only in those files, never in a repo, Notion or Discord.

Known Govee behaviour: the Home app is glitchy and lights drop off Wi-Fi at
random; the cloud `online` flag is the honest signal. Three to four seconds
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
