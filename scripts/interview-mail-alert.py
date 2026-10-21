#!/usr/bin/env python3
"""Interview-mail safety net: no model, no judgement, nothing to lie about.

Runs inside bamware-daily-brief.service (the read-only Google broker allow-lists
that unit). Searches Gmail for interview-related mail from the last two days and
posts sender, time and subject for anything not shown before to #chief-of-staff.
Ids already shown live in ~/.local/state/bamware/interview-mail/alert-seen.json.

Why (Bilal, 2026-10-21): the model-driven Interview Tracker reported "Gmail
healthy" on runs where it never reached Gmail. This script is the floor under
it: if a recruiter writes, he hears within two hours whatever the model does.
Read-only. Never sends or drafts mail. --dry-run prints instead of posting.
"""
import json, os, subprocess, sys, time, urllib.request
from pathlib import Path

STATE = Path.home() / '.local/state/bamware/interview-mail/alert-seen.json'
CLIENT = '/opt/bamware-google/client.py'
QUERY = ('newer_than:2d -in:sent -in:drafts -category:promotions '
         '-from:linkedin.com -from:indeed.com -from:glassdoor.com -from:ziprecruiter.com -from:github.com '
         '(subject:(interview OR assessment OR "next steps" OR "coding challenge" OR offer OR recruiter '
         'OR availability OR scheduling OR "phone screen" OR onsite OR "take-home" OR "take home") '
         'OR from:(ashbyhq.com OR lever.co OR greenhouse-mail.io OR greenhouse.io OR myworkday.com '
         'OR smartrecruiters.com OR calendly.com OR goodtime.io OR hirevue.com OR codesignal.com OR hackerrank.com))')
KEEP_DAYS = 30
MAX_LINES = 10


def search():
    req = json.dumps({'op': 'gmail_search', 'query': QUERY, 'limit': 50})
    out = subprocess.run(['python3', CLIENT], input=req, capture_output=True, text=True, timeout=90)
    try:
        resp = json.loads(out.stdout)
    except ValueError:
        raise RuntimeError(f'broker gave no JSON (exit {out.returncode}): {(out.stdout or out.stderr)[:200]}')
    if not resp.get('ok'):
        raise RuntimeError(f"broker refused: {resp.get('error', '?')}")
    return resp['result'].get('messages', [])


def load():
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return {'ids': {}}


def save(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    cutoff = time.time() - KEEP_DAYS * 86400
    state['ids'] = {k: v for k, v in state['ids'].items() if v >= cutoff}
    tmp = STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, indent=1) + '\n')
    os.replace(tmp, STATE)


def discord_env():
    env = {}
    for line in (Path.home() / '.config/bamware/discord.env').read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def post(text):
    env = discord_env()
    body = json.dumps({'content': text[:1990], 'flags': 4}).encode()
    req = urllib.request.Request(
        f"https://discord.com/api/v10/channels/{env['DISCORD_HOME_CHANNEL']}/messages", data=body,
        headers={'Authorization': f"Bot {env['DISCORD_BOT_TOKEN']}", 'Content-Type': 'application/json',
                 'User-Agent': 'DiscordBot (https://github.com/mrbam88/bamware-ai, 1.0)'})  # Discord 403s the urllib default
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())['id']


def line(m):
    return f"• {m.get('date', '?')} — {m.get('from', '?')} — {m.get('subject', '(no subject)')}"


def main():
    dry = '--dry-run' in sys.argv
    state = load()
    messages = search()
    new = [m for m in messages if m.get('id') and m['id'] not in state['ids']]
    state['last_ok'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    state['last_total'] = len(messages)
    if new:
        new.sort(key=lambda m: m.get('internalDateIso', ''), reverse=True)
        lines = [line(m) for m in new[:MAX_LINES]]
        more = f"\n…and {len(new) - MAX_LINES} more in Gmail." if len(new) > MAX_LINES else ''
        text = f"📬 Interview-related mail, new since the last check ({len(new)}):\n" + '\n'.join(lines) + more
        if dry:
            print(text)
        else:
            mid = post(text)
            print(f'interview-mail-alert: posted {len(new)} new (message id {mid})')
    else:
        print(f'interview-mail-alert: nothing new ({len(messages)} matches in the last 2 days, all shown before)')
    if not dry:
        now = time.time()
        for m in new:
            state['ids'][m['id']] = now
        save(state)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # make the failure loud in the journal, never silent
        print(f'interview-mail-alert: FAILED: {e}', file=sys.stderr)
        sys.exit(1)
