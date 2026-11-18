# BrewDesk production probe

Runs on the build server (omarchy) as a systemd user timer. Pings
`https://venuekit.bamware.io/v1/ping` every 5 minutes, runs a deeper check
(health, storage, one venue query) once an hour, and posts to the Discord
status channel when the backend goes down or comes back.

It lives here, not in GitHub Actions, because the engine repo is private and
a 10-minute schedule used more than the 2,000 free Actions minutes a month;
GitHub stopped running that repo's jobs on 2026-11-18.

Install or update (from a machine with the repo and the vault):

    scp services/brewdesk-probe/probe.sh omarchy:.local/bin/brewdesk-probe.sh
    scp services/brewdesk-probe/bamware-brewdesk-probe.{service,timer} omarchy:.config/systemd/user/
    ssh omarchy 'systemctl --user daemon-reload && systemctl --user enable --now bamware-brewdesk-probe.timer'

The webhook URL is read from `~/.config/bamware/discord-webhook-status`
(mode 600), copied from SSM `/bamware/shared/discord-webhook-status`.

Check it: `ssh omarchy 'journalctl --user -u bamware-brewdesk-probe -n 5 --no-pager'`.
Limit: if the build server itself is off, nothing is watching.
