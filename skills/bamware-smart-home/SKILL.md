---
name: bamware-smart-home
description: Control Bilal's apartment lights (Govee) from the build server when he asks the seat to turn lights on or off, change their color or brightness. Use for any "lights", "lamp", "Govee", "smart home" request in Discord.
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
- Report what changed in one line ("Living room: on, warm"). If Govee refused,
  say so plainly with its message. Exit 2 = no key on the server: tell Bilal
  the one-time setup below, do not guess.

## One-time setup (Bilal)

Govee Home app → profile tab → Settings (gear) → "Apply for API Key" → the key
arrives by email. On the server: `~/.config/bamware/govee.env` containing
`GOVEE_API_KEY=...` with `chmod 600`. The key is a secret: never in git, never
echoed. Govee allows 10,000 API calls per day per key; a light command is one.

## Don't

- No schedules, scenes or automations without an explicit ask (they are easy
  to add later: a systemd timer calling the script).
- Never store the key in this public repo, Notion or Discord.
