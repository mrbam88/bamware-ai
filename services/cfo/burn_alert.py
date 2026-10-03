#!/usr/bin/env python3
"""CFO burn alert: deterministic quota burn-rate detection. Standard library only.

Reads quota observations, keeps a per-window history, forecasts time to the
reserve and to exhaustion from the recent burn rate, and posts one Discord
alert per escalation. No model calls: detection must not spend the allowance
it is protecting (#101). Operating guide: services/cfo/README.md.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys

POLICY = {
    'reserve_used_pct': 85.0,    # the founder's reserve starts here
    'warn_used_pct': 80.0,
    'critical_used_pct': 95.0,
    'warn_horizon_h': 24.0,      # warn if the reserve is hit within this, before reset
    'critical_horizon_h': 6.0,   # critical if exhaustion is within this, before reset
    'rate_window_min': 60.0,     # burn rate is measured over the trailing hour
    'rate_min_span_min': 15.0,   # ...from samples spanning at least this long
    'stale_after_min': 30.0,     # newest sample older than this = monitoring stale
    'history_h': 48.0,
    'max_delivery_attempts': 5,
}
LEVELS = {'ok': 0, 'warn': 1, 'critical': 2}
HOME = Path.home()
STATE_DIR = HOME / '.local/state/bamware/cfo'
OPENAI_SNAPSHOT = HOME / '.local/state/bamware/server-quota.json'


def epoch(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).timestamp()
    except ValueError:
        return None


# --- sources: each returns (observations, error) ----------------------------

def openai_source(path=OPENAI_SNAPSHOT):
    """Windows written by the server quota collector (collect-server-quota.py)."""
    try:
        snapshot = json.loads(Path(path).read_text())
    except (OSError, ValueError) as error:
        return [], f'openai snapshot unreadable: {error.__class__.__name__}'
    collected = epoch(snapshot.get('collectedAt'))
    observations = []
    for window in snapshot.get('windows', []):
        used = window.get('utilizationPct')
        minutes = re.search(r'-(\d+(?:\.\d+)?)min$', window.get('scope', ''))
        if used is None or not minutes:
            continue
        # Shared accounts appear once per harness; key by account so they dedupe.
        account = window.get('account') or window.get('harness') or 'unknown'
        observations.append({
            'key': f"openai-codex:{account}:{window['scope']}",
            'label': 'OpenAI (ChatGPT/Codex) ' + ('weekly' if float(minutes[1]) >= 10080 else f'{float(minutes[1]):g}-min') + ' pool',
            'used_pct': float(used),
            'window_min': float(minutes[1]),
            'reset_at': epoch(window.get('resetAt')),
            'observed_at': epoch((window.get('source') or {}).get('fetchedAt')) or collected,
        })
    return observations, None


def copilot_source(run=subprocess.run, now=None):
    """GitHub Copilot monthly premium-request quota via the gh CLI."""
    try:
        out = run(['gh', 'api', '/copilot_internal/user'], capture_output=True, text=True, timeout=20)
        data = json.loads(out.stdout) if out.returncode == 0 else None
    except (OSError, ValueError, subprocess.SubprocessError):
        data = None
    if not data:
        return [], 'copilot quota unavailable (gh api failed)'
    premium = (data.get('quota_snapshots') or {}).get('premium_interactions') or {}
    if premium.get('unlimited') or premium.get('percent_remaining') is None:
        return [], None
    reset_at = epoch(data.get('quota_reset_date_utc'))
    return [{
        'key': 'copilot:premium-monthly',
        'label': 'GitHub Copilot premium requests (monthly)',
        'used_pct': round(100.0 - float(premium['percent_remaining']), 2),
        'window_min': 30 * 24 * 60.0,
        'reset_at': reset_at,
        'observed_at': now if now is not None else datetime.now(timezone.utc).timestamp(),
    }], None


SOURCES = {'openai-codex': openai_source, 'copilot': copilot_source}


# --- state -------------------------------------------------------------------

def load_state(state_dir):
    try:
        return json.loads((state_dir / 'state.json').read_text())
    except (OSError, ValueError):
        return {'version': 1, 'windows': {}, 'alerts': {}, 'sources': {}}


def save_state(state_dir, state):
    state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    tmp = state_dir / 'state.json.tmp'
    tmp.write_text(json.dumps(state, indent=1) + '\n')
    tmp.chmod(0o600)
    tmp.replace(state_dir / 'state.json')


def log_event(state_dir, event):
    state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    with open(state_dir / 'alerts.jsonl', 'a') as stream:
        stream.write(json.dumps(event) + '\n')


def record(state, obs, policy=POLICY):
    """Add one observation. A reset rollover starts a new trend for that window."""
    window = state['windows'].setdefault(obs['key'], {'samples': []})
    rolled = window.get('reset_at') and obs['reset_at'] and abs(obs['reset_at'] - window['reset_at']) > 3600
    dropped = window['samples'] and obs['observed_at'] > window['samples'][-1][0] and obs['used_pct'] < window['samples'][-1][1] - 5
    if rolled or dropped:
        window['samples'] = []
        state['alerts'].pop(obs['key'], None)
    window.update(label=obs['label'], window_min=obs['window_min'], reset_at=obs['reset_at'] or window.get('reset_at'))
    if obs['observed_at'] is None or any(t == obs['observed_at'] for t, _ in window['samples']):
        return
    window['samples'].append([obs['observed_at'], obs['used_pct']])
    window['samples'].sort()
    cutoff = window['samples'][-1][0] - policy['history_h'] * 3600
    window['samples'] = [s for s in window['samples'] if s[0] >= cutoff]


# --- evaluation --------------------------------------------------------------

def assess(window, now, policy=POLICY):
    t_last, used = window['samples'][-1]
    recent = [s for s in window['samples'] if s[0] >= t_last - policy['rate_window_min'] * 60]
    rate = None
    if recent[-1][0] - recent[0][0] >= policy['rate_min_span_min'] * 60:
        rate = (recent[-1][1] - recent[0][1]) / ((recent[-1][0] - recent[0][0]) / 3600)
    to_reset_h = (window['reset_at'] - now) / 3600 if window.get('reset_at') else None
    eta_reserve = (policy['reserve_used_pct'] - used) / rate if rate and rate > 0 and used < policy['reserve_used_pct'] else None
    eta_exhaust = (100 - used) / rate if rate and rate > 0 else None

    def before_reset(eta, horizon):
        return eta is not None and eta <= horizon and (to_reset_h is None or eta < to_reset_h)

    level = 'ok'
    if used >= policy['warn_used_pct'] or before_reset(eta_reserve, policy['warn_horizon_h']):
        level = 'warn'
    if used >= policy['critical_used_pct'] or before_reset(eta_exhaust, policy['critical_horizon_h']):
        level = 'critical'
    return {'level': level, 'used_pct': used, 'observed_at': t_last, 'rate_pct_h': rate,
            'eta_reserve_h': eta_reserve, 'eta_exhaust_h': eta_exhaust, 'to_reset_h': to_reset_h,
            'stale': now - t_last > policy['stale_after_min'] * 60}


def hours(h):
    return 'unknown' if h is None else (f'{h * 60:.0f} min' if h < 1 else f'{h:.1f} h' if h < 48 else f'{h / 24:.1f} days')


def clock(ts):
    return datetime.fromtimestamp(ts).astimezone().strftime('%a %b %d %I:%M %p')


def message(window, a, policy=POLICY):
    icon = '🚨' if a['level'] == 'critical' else '⚠️'
    lines = [f"{icon} **CFO burn alert ({a['level']})**: {window['label']}",
             f"- {a['used_pct']:.0f}% used as of {clock(a['observed_at'])}"]
    if a['rate_pct_h'] is not None:
        lines.append(f"- Burning {a['rate_pct_h']:+.1f}%/h over the last hour")
        lines.append(f"- At this rate: reserve ({policy['reserve_used_pct']:.0f}%) in {hours(a['eta_reserve_h'])}, exhausted in {hours(a['eta_exhaust_h'])}")
    if window.get('reset_at'):
        lines.append(f"- Resets {clock(window['reset_at'])} (in {hours(a['to_reset_h'])})")
    lines.append('- Action: move non-urgent work to another pool now (config/model-routing.yaml). Nothing was switched automatically.')
    lines.append('- Forecast is linear over the last hour from 10-min samples; a provider-side change can outrun it.')
    return '\n'.join(lines)


def deliver(text, sender):
    try:
        return sender(text), None
    except Exception as error:  # delivery must never crash the detector
        return False, f'{error.__class__.__name__}: {error}'


def discord_post_path():
    repo = os.environ.get('BAMWARE_AI_DIR') or Path(__file__).resolve().parents[2]
    return Path(repo) / 'scripts/discord-post.sh'


def discord_sender(text):
    env = {**os.environ, 'BAMWARE_POST_TO': 'assistant'}
    out = subprocess.run([str(discord_post_path()), text], env=env, capture_output=True, text=True, timeout=30)
    if out.returncode != 0:
        raise RuntimeError(f'discord-post exit {out.returncode}')
    return True


def notify(state, state_dir, key, level, reset_at, text, sender, now, policy=POLICY):
    """Send once per escalation; retry failed sends; never resend a delivered level."""
    alert = state['alerts'].setdefault(key, {'sent_level': 'ok', 'reset_at': reset_at, 'pending': None})
    if LEVELS[level] > LEVELS[alert['sent_level']]:
        pending = alert.get('pending') or {}
        if pending.get('level') != level:
            alert['pending'] = {'level': level, 'attempts': 0}
    pending = alert.get('pending')
    if not pending:
        return None
    if pending['attempts'] >= policy['max_delivery_attempts']:
        return 'exhausted'
    pending['attempts'] += 1
    ok, error = deliver(text, sender)
    log_event(state_dir, {'at': now, 'key': key, 'level': pending['level'], 'attempt': pending['attempts'],
                          'delivered': bool(ok), 'error': error})
    if ok:
        alert['sent_level'], alert['pending'] = pending['level'], None
        return 'delivered'
    if pending['attempts'] >= policy['max_delivery_attempts']:
        print(f'cfo-burn-alert: delivery retries exhausted for {key}', file=sys.stderr)
        return 'exhausted'
    return 'failed'


def run(state_dir=STATE_DIR, sources=None, sender=discord_sender, now=None, policy=POLICY):
    now = now if now is not None else datetime.now(timezone.utc).timestamp()
    state = load_state(state_dir)
    results = []
    for name, source in (sources if sources is not None else SOURCES).items():
        observations, error = source()
        status = state['sources'].setdefault(name, {})
        status.update(last_run=now, last_error=error)
        if observations:
            status['last_ok'] = now
        for obs in observations:
            record(state, obs, policy)
        # Monitoring itself going dark is an alert, not a calm day.
        if error and now - status.get('last_ok', now) > policy['stale_after_min'] * 60:
            text = f"⚠️ **CFO monitoring stale**: {name} has had no fresh quota data since {clock(status['last_ok'])} ({error}). Burn alerts for it are blind."
            results.append((f'monitor:{name}', notify(state, state_dir, f'monitor:{name}', 'warn', None, text, sender, now, policy)))
        elif not error:
            state['alerts'].pop(f'monitor:{name}', None)
    for key, window in state['windows'].items():
        if not window['samples']:
            continue
        a = assess(window, now, policy)
        if a['stale']:
            continue  # covered by the source's monitoring alert
        if a['level'] != 'ok':
            results.append((key, notify(state, state_dir, key, a['level'], window.get('reset_at'), message(window, a, policy), sender, now, policy)))
    save_state(state_dir, state)
    return results


def replay(fixture_path, policy=POLICY):
    """Feed a synthetic fixture sample by sample and print when alerts fire."""
    fixture = json.loads(Path(fixture_path).read_text())
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        sent = []
        for sample in fixture['samples']:
            obs = {'key': 'replay', 'label': fixture.get('label', 'replay pool'), 'used_pct': sample['used_pct'],
                   'window_min': fixture['window_min'], 'reset_at': fixture['reset_at'], 'observed_at': sample['t']}
            for key, outcome in run(Path(tmp), {'replay': lambda o=obs: ([o], None)},
                                    lambda text: sent.append(text) or True, sample['t'], policy):
                if outcome == 'delivered':
                    print(f"t+{(sample['t'] - fixture['samples'][0]['t']) / 60:.0f} min at {sample['used_pct']:.0f}%:\n{sent[-1]}\n")
        if not sent:
            print('no alerts fired')


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--state-dir', type=Path, default=STATE_DIR)
    parser.add_argument('--dry-run', action='store_true', help='print alerts instead of posting')
    parser.add_argument('--replay', type=Path, help='replay a synthetic fixture; never posts')
    args = parser.parse_args()
    if args.replay:
        return replay(args.replay)
    if args.dry_run:
        # Work on a throwaway copy so a dry run never marks a level as sent.
        import shutil
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            if (args.state_dir / 'state.json').exists():
                shutil.copy(args.state_dir / 'state.json', tmp)
            for key, outcome in run(Path(tmp), sender=lambda text: print(text + '\n') or True):
                print(f'{key}: {outcome}')
        return
    for key, outcome in run(args.state_dir):
        print(f'{key}: {outcome}')


if __name__ == '__main__':
    main()
