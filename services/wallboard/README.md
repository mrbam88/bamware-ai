# Wall board: the living-room screensaver

The build server's lid stays open in the living room. After 150 s without input
it shows a wall board instead of Omarchy's terminal animation: time, date, month,
agenda, weather, and the state of Bamware. Any key or mouse movement dismisses it.

It reads files other timers already write, so it spends **no agent tokens**.

## What it shows, and where each part comes from

| On screen | Source |
|---|---|
| Time, date, month grid, week, day of year | the clock |
| Weather, sunrise and sunset line | Open-Meteo (free, no key), cached 20 min |
| Up next | a private calendar feed, if linked (below), cached 10 min |
| BrewDesk API | `~/.local/state/bamware/brewdesk-probe/` |
| Agent seats, Timers | `systemctl --user` (Discord router, assistant, failed units) |
| Power | `/sys/class/power_supply` (on battery is an alert) |
| Ready for QA / In progress / To do | `~/.local/state/bamware/board/latest.json` |
| Waiting on you, Ready for QA line | `owner-blockers/*.json`, the board cache |
| Claude weekly allowance | `~/.local/state/bamware/cfo/capacity.json` |
| CFO halt banner | `~/.local/state/bamware/cfo/halt.json` |

Colours follow the Omarchy theme. Trouble is amber with a different mark shape
(dot = fine, ring = warning, square = alert), never red against green.

## Install, update, remove

```
services/wallboard/install.sh             # copies to ~/.local/share/bamware/wallboard, starts the unit
services/wallboard/install.sh uninstall   # removes it and restores Omarchy's screensaver
wallboard show | hide | toggle | status   # drive it by hand
```

Install sets `idle.screensaver` to `0` in `~/.config/omarchy/shell.json` so the
stock screensaver does not also start. The lock timer there is left alone: the
lock screen covers the board when it fires, so on a machine meant to show the
board all day set `idle.lock` to `0` as well. That is a security choice for
Bilal, not for an agent.

## Settings

Optional, in `~/.config/bamware/wallboard.env` (never committed), then
`systemctl --user restart bamware-wallboard`:

```
WALLBOARD_ICS_URLS=https://calendar.google.com/calendar/ical/.../basic.ics
WALLBOARD_SCREENS=all            # or connector names: eDP-1,DP-4
WALLBOARD_IDLE_SECONDS=150
WALLBOARD_LAT=40.7128
WALLBOARD_LON=-74.0060
WALLBOARD_NAME=Bilal
```

The calendar feed is Google Calendar's "Secret address in iCal format"
(Settings, the calendar, Integrate calendar). It is read-only and several feeds
can be listed, separated by commas. The URL is a credential: keep it in that
file only.

## Pieces

- `collect.py`: gathers everything into one JSON document. Each section fails
  on its own; a missing source blanks that section only. Tests:
  `python3 -m unittest tests.test_wallboard_collect`.
- `Board.qml`: the picture. Plain Qt Quick, sized from the screen height.
- `shell.qml`: a small Quickshell instance that watches for idle and puts the
  board on an overlay layer. It honours Omarchy's stay-awake and
  screensaver-off switches.
- `bin/preview [width height [data.json]]`: renders a PNG offscreen, for
  checking a design change over SSH without touching a display.
- `fonts/`: Instrument Serif and Inter, both under the SIL Open Font License.
