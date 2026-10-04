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
    'stale_critical_after_h': 6.0,  # blind this long = critical: a dark collector must not hide for a day
    'history_h': 48.0,
    'max_delivery_attempts': 5,
    # Self-verification: every forecast is graded against the API's later reading.
    'forecast_horizon_min': 60.0,
    'forecast_every_min': 30.0,
    'verify_tolerance_min': 15.0,
    'calibration_min_n': 6,      # graded forecasts needed before correcting
    'max_rate_factor': 2.0,      # correction only ever makes alerts earlier
    'calibration_keep': 200,
    'disagree_pct': 5.0,         # cross-source disagreement worth an alert
    'crosscheck_max_gap_min': 30.0,
}
LEVELS = {'ok': 0, 'warn': 1, 'critical': 2}
HOME = Path.home()
STATE_DIR = HOME / '.local/state/bamware/cfo'
OPENAI_SNAPSHOT = HOME / '.local/state/bamware/server-quota.json'
# Written every 10 min by bamware-web's ai-quota-sample.ts (same override variable).
CLAUDE_SAMPLES = Path(os.environ.get('AI_QUOTA_SAMPLES_PATH') or
                      HOME / 'code/bamware-web/.claude/worktrees/ai-spend-dashboard/.data/ai-quota-samples.jsonl')
CLAUDE_METERS = {
    'session': ('Claude Max 5-hour session', 300.0),
    'weekly': ('Claude Max weekly (all models)', 10080.0),
    'weekly-fable': ('Claude Max Fable allowance (half of weekly)', 10080.0),
}


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


def claude_source(path=None, now=None, policy=POLICY, tail=12):
    """Claude Max meters from the samples file, as Anthropic reports them in /usage."""
    path = Path(path or CLAUDE_SAMPLES)
    try:
        lines = path.read_text().splitlines()[-tail:]
    except OSError as error:
        return [], f'claude samples unreadable: {error.__class__.__name__}'
    observations, newest = [], None
    for line in lines:
        try:
            sample = json.loads(line)
        except ValueError:
            continue
        at = epoch(sample.get('at'))
        newest = max(newest or at, at) if at else newest
        for meter in sample.get('meters', []):
            label, window_min = CLAUDE_METERS.get(meter.get('kind'), (None, None))
            if label is None or meter.get('percent') is None or at is None:
                continue
            observations.append({'key': f"claude-max:{meter['kind']}", 'label': label,
                                 'used_pct': float(meter['percent']), 'window_min': window_min,
                                 'reset_at': epoch(meter.get('resetsAt')), 'observed_at': at})
    now = now if now is not None else datetime.now(timezone.utc).timestamp()
    if newest is None or now - newest > policy['stale_after_min'] * 60:
        # Old data is not fresh data: a stopped sampler must surface as stale.
        return observations, 'claude samples stale (sampler stopped or login expired?)'
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


SOURCES = {'openai-codex': openai_source, 'claude-max': claude_source, 'copilot': copilot_source}
# What to run when a source goes dark. The detector cannot see inside the collectors, so the
# alert names the place that can (2026-10-03: the Claude sampler got 429s for 34 h; one warning).
SOURCE_HINTS = {
    'openai-codex': 'journalctl --user -u ai-quota-sample.service -n 20 (collect-server-quota.py runs first)',
    'claude-max': 'journalctl --user -u ai-quota-sample.service -n 20 (429 = Claude /usage rate-limited; login expired = claude /login)',
    'copilot': 'gh auth status (burn_alert.py reads gh api /copilot_internal/user)',
}


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
        window['samples'], window['forecasts'] = [], []
        state['alerts'].pop(obs['key'], None)
    window.update(label=obs['label'], window_min=obs['window_min'], reset_at=obs['reset_at'] or window.get('reset_at'))
    if obs['observed_at'] is None or any(t == obs['observed_at'] for t, _ in window['samples']):
        return
    window['samples'].append([obs['observed_at'], obs['used_pct']])
    window['samples'].sort()
    cutoff = window['samples'][-1][0] - policy['history_h'] * 3600
    window['samples'] = [s for s in window['samples'] if s[0] >= cutoff]


# --- evaluation --------------------------------------------------------------

def raw_rate(window, policy=POLICY):
    """Burn rate in %/h over the trailing window, or None if too little data."""
    t_last = window['samples'][-1][0]
    recent = [s for s in window['samples'] if s[0] >= t_last - policy['rate_window_min'] * 60]
    if recent[-1][0] - recent[0][0] < policy['rate_min_span_min'] * 60:
        return None
    return (recent[-1][1] - recent[0][1]) / ((recent[-1][0] - recent[0][0]) / 3600)


# --- self-verification -------------------------------------------------------

def verify_forecasts(state, key, window, policy=POLICY):
    """Grade due forecasts against the observed reading nearest their target time."""
    samples, pending = window['samples'], []
    calibration = state.setdefault('calibration', {}).setdefault(key, [])
    tolerance = policy['verify_tolerance_min'] * 60
    for f in window.get('forecasts', []):
        if samples[-1][0] < f['target_at']:
            pending.append(f)  # wait for a reading at or after the target time
            continue
        nearest = min(samples, key=lambda s: abs(s[0] - f['target_at']))
        if abs(nearest[0] - f['target_at']) <= tolerance:
            calibration.append({'made_at': f['made_at'], 'target_at': f['target_at'], 'base': f['base'],
                                'predicted': f['predicted'], 'actual': nearest[1],
                                'error': round(nearest[1] - f['predicted'], 2)})
        # A forecast with no reading near its target is dropped, not graded.
    window['forecasts'] = pending
    del calibration[:-policy['calibration_keep']]


def rate_factor(calibration, policy=POLICY):
    """Learned correction: >1 when forecasts under-predicted the burn. Never <1."""
    graded = [c for c in calibration[-50:] if c['predicted'] - c['base'] > 0.5]
    if len(graded) < policy['calibration_min_n']:
        return 1.0
    predicted = sum(c['predicted'] - c['base'] for c in graded)
    actual = sum(c['actual'] - c['base'] for c in graded)
    return max(1.0, min(policy['max_rate_factor'], actual / predicted))


def calibration_summary(calibration):
    if not calibration:
        return None
    errors = [c['error'] for c in calibration[-50:]]
    return {'n': len(errors), 'bias': sum(errors) / len(errors), 'mae': sum(abs(e) for e in errors) / len(errors)}


def make_forecast(window, rate, policy=POLICY):
    """Record what the raw model predicts for one horizon ahead, to grade later."""
    if rate is None:
        return
    t_last, used = window['samples'][-1]
    forecasts = window.setdefault('forecasts', [])
    if forecasts and t_last - forecasts[-1]['made_at'] < policy['forecast_every_min'] * 60:
        return
    horizon = policy['forecast_horizon_min']
    forecasts.append({'made_at': t_last, 'target_at': t_last + horizon * 60, 'base': used,
                      'predicted': round(min(100.0, used + rate * horizon / 60), 2)})


def codex_log_verifier(home=HOME):
    """Independent OpenAI reading: the rate_limits Codex itself records in session logs."""
    paths = sorted((home / '.codex/sessions').glob('*/*/*/rollout-*.jsonl'), key=lambda p: p.stat().st_mtime)
    for path in reversed(paths[-5:]):
        for line in reversed(path.read_text(errors='replace').splitlines()):
            if '"rate_limits"' not in line:
                continue
            try:
                event = json.loads(line)
            except ValueError:
                continue
            limits = (event.get('payload') or {}).get('rate_limits') or {}
            primary = limits.get('primary') or {}
            if primary.get('used_percent') is None:
                continue
            return {'source': 'codex-session-log', 'window_min': float(primary.get('window_minutes') or 0),
                    'used_pct': float(primary['used_percent']), 'reset_at': epoch(primary.get('resets_at')),
                    'observed_at': epoch(event.get('timestamp')) or path.stat().st_mtime}
    return None


def crosscheck(state, reading, policy=POLICY):
    """Compare an independent reading with the detector's own data for that window."""
    if not reading:
        return None
    for key, window in state['windows'].items():
        if not key.startswith('openai-codex:') or window.get('window_min') != reading['window_min'] or not window['samples']:
            continue
        nearest = min(window['samples'], key=lambda s: abs(s[0] - reading['observed_at']))
        if abs(nearest[0] - reading['observed_at']) > policy['crosscheck_max_gap_min'] * 60:
            return None  # too far apart in time to compare fairly
        diff = round(reading['used_pct'] - nearest[1], 2)
        check = {'at': reading['observed_at'], 'key': key, 'collector': nearest[1],
                 'independent': reading['used_pct'], 'diff': diff}
        checks = state.setdefault('crosschecks', [])
        checks.append(check)
        del checks[:-50]
        return check
    return None


def assess(window, now, policy=POLICY, factor=1.0):
    t_last, used = window['samples'][-1]
    raw = raw_rate(window, policy)
    rate = raw * factor if raw is not None and raw > 0 else raw
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
    return {'level': level, 'used_pct': used, 'observed_at': t_last, 'rate_pct_h': rate, 'factor': factor,
            'reserve_before_reset': before_reset(eta_reserve, float('inf')),
            'exhaust_before_reset': before_reset(eta_exhaust, float('inf')),
            'eta_reserve_h': eta_reserve, 'eta_exhaust_h': eta_exhaust, 'to_reset_h': to_reset_h,
            'stale': now - t_last > policy['stale_after_min'] * 60}


def hours(h):
    return 'unknown' if h is None else (f'{h * 60:.0f} min' if h < 1 else f'{h:.1f} h' if h < 48 else f'{h / 24:.1f} days')


def clock(ts):
    return datetime.fromtimestamp(ts).astimezone().strftime('%a %b %d %I:%M %p')


def message(window, a, policy=POLICY, accuracy=None):
    icon = '🚨' if a['level'] == 'critical' else '⚠️'
    lines = [f"{icon} **CFO burn alert ({a['level']})**: {window['label']}",
             f"- {a['used_pct']:.0f}% used as of {clock(a['observed_at'])}"]
    if a['rate_pct_h'] is not None:
        lines.append(f"- Burning {a['rate_pct_h']:+.1f}%/h over the last hour")
        lines.append(f"- At this rate: reserve ({policy['reserve_used_pct']:.0f}%) in {hours(a['eta_reserve_h'])}, exhausted in {hours(a['eta_exhaust_h'])}")
    if window.get('reset_at'):
        lines.append(f"- Resets {clock(window['reset_at'])} (in {hours(a['to_reset_h'])})")
    if accuracy:
        lines.append(f"- Self-check: last {accuracy['n']} one-hour forecasts were off by ±{accuracy['mae']:.1f} pts"
                     f" (bias {accuracy['bias']:+.1f}); correction ×{a['factor']:.2f} applied")
    lines.append('- Action: move non-urgent work to another pool now (config/model-routing.yaml). Nothing was switched automatically.')
    lines.append('- Forecast is linear over the last hour from 10-min samples; a provider-side change can outrun it.')
    return '\n'.join(lines)


def source_pools(state, name):
    """The windows one source feeds, each with its last known reading: (label, used_pct, observed_at)."""
    return [(w['label'], w['samples'][-1][1], w['samples'][-1][0])
            for key, w in state['windows'].items() if key.startswith(name + ':') and w['samples']]


def last_known(pools):
    return '; '.join(f"{label} {used:.0f}%" for label, used, _ in pools) or 'nothing recorded yet'


def monitor_message(name, error, blind_h, level, pools, since, policy=POLICY):
    icon = '🚨' if level == 'critical' else '⚠️'
    lines = [f"{icon} **CFO monitoring stale ({level})**: {name} has had no fresh quota data for {hours(blind_h)}"
             f" (since {clock(since)}): {error}. Burn alerts for it are blind.",
             f"- Last known: {last_known(pools)}" + (f" (as of {clock(max(p[2] for p in pools))})" if pools else '')]
    if level == 'critical':
        lines.append(f"- Blind for over {policy['stale_critical_after_h']:.0f} h: a spike on these pools would go unalerted. Fix the collector now.")
    if name in SOURCE_HINTS:
        lines.append(f"- Check: {SOURCE_HINTS[name]}")
    lines.append('- Nothing was switched automatically.')
    return '\n'.join(lines)


def restored_message(name, blind_h, pools):
    return f"✅ **CFO monitoring restored**: {name} is reporting again after {hours(blind_h)} blind. Now: {last_known(pools)}."


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


def run(state_dir=STATE_DIR, sources=None, sender=discord_sender, now=None, policy=POLICY, verifier=codex_log_verifier):
    now = now if now is not None else datetime.now(timezone.utc).timestamp()
    state = load_state(state_dir)
    results = []
    for name, source in (sources if sources is not None else SOURCES).items():
        observations, error = source()
        status = state['sources'].setdefault(name, {})
        previous_ok = status.get('last_ok', now)
        status.update(last_run=now, last_error=error)
        if observations and not error:
            status['last_ok'] = now
        status.setdefault('last_ok', now)  # first sighting starts the stale clock
        for obs in observations:
            record(state, obs, policy)
        # Monitoring itself going dark is an alert, not a calm day. It escalates: a warning nobody
        # acts on must become a critical, and the end of the blind spot must be announced.
        monitor_key, blind_h = f'monitor:{name}', (now - status['last_ok']) / 3600
        if error and blind_h * 60 > policy['stale_after_min']:
            level = 'critical' if blind_h >= policy['stale_critical_after_h'] else 'warn'
            text = monitor_message(name, error, blind_h, level, source_pools(state, name), status['last_ok'], policy)
            results.append((monitor_key, notify(state, state_dir, monitor_key, level, None, text, sender, now, policy)))
        elif not error:
            if state['alerts'].pop(monitor_key, {}).get('sent_level', 'ok') != 'ok':
                # One attempt, logged either way: the alert said "blind", so say when sight returns.
                ok, failure = deliver(restored_message(name, (now - previous_ok) / 3600, source_pools(state, name)), sender)
                log_event(state_dir, {'at': now, 'key': monitor_key, 'level': 'restored', 'attempt': 1,
                                      'delivered': bool(ok), 'error': failure})
                results.append((monitor_key, 'restored' if ok else 'failed'))
    try:
        reading = verifier() if verifier else None
    except (OSError, ValueError):
        reading = None
    check = crosscheck(state, reading, policy)
    if check and abs(check['diff']) > policy['disagree_pct']:
        text = (f"⚠️ **CFO self-check failed**: OpenAI usage sources disagree by {check['diff']:+.1f} pts "
                f"(collector {check['collector']:.0f}%, Codex log {check['independent']:.0f}%). Burn alerts may be wrong until resolved.")
        results.append(('crosscheck:openai', notify(state, state_dir, 'crosscheck:openai', 'warn', None, text, sender, now, policy)))
    elif check:
        state['alerts'].pop('crosscheck:openai', None)
    capacity = []
    for key, window in state['windows'].items():
        if not window['samples']:
            continue
        verify_forecasts(state, key, window, policy)
        calibration = state.get('calibration', {}).get(key, [])
        factor = rate_factor(calibration, policy)
        a = assess(window, now, policy, factor)
        make_forecast(window, raw_rate(window, policy), policy)
        capacity.append({'key': key, 'label': window['label'], 'window_min': window.get('window_min'),
                         'reset_at': window.get('reset_at'),
                         **{k: a[k] for k in ('level', 'used_pct', 'observed_at', 'rate_pct_h', 'eta_reserve_h',
                                              'eta_exhaust_h', 'to_reset_h', 'stale', 'factor',
                                              'reserve_before_reset', 'exhaust_before_reset')}})
        if a['stale']:
            continue  # covered by the source's monitoring alert
        if a['level'] != 'ok':
            accuracy = calibration_summary(calibration) if len(calibration) >= policy['calibration_min_n'] else None
            results.append((key, notify(state, state_dir, key, a['level'], window.get('reset_at'), message(window, a, policy, accuracy), sender, now, policy)))
    save_state(state_dir, state)
    for pool in capacity:  # after delivery, so "sent" reflects this run
        pool['sent_level'] = state['alerts'].get(pool['key'], {}).get('sent_level', 'ok')
    publish_capacity(state_dir, capacity, state['sources'], now, policy)
    return results


def publish_capacity(state_dir, pools, sources, now, policy=POLICY):
    """The CFO's current view of every pool, for dashboards. One calculation, one owner."""
    doc = {'version': 1, 'generated_at': now,
           'policy': {k: policy[k] for k in ('reserve_used_pct', 'warn_used_pct', 'critical_used_pct')},
           'pools': sorted(pools, key=lambda p: (-LEVELS[p['level']], -p['used_pct'])),
           'sources': {name: {'last_ok': s.get('last_ok'), 'last_error': s.get('last_error'),
                              'blind_h': round((now - s.get('last_ok', now)) / 3600, 2),
                              'stale': now - s.get('last_ok', now) > policy['stale_after_min'] * 60}
                       for name, s in sources.items()}}
    tmp = state_dir / 'capacity.json.tmp'
    tmp.write_text(json.dumps(doc, indent=1) + '\n')
    tmp.chmod(0o600)
    tmp.replace(state_dir / 'capacity.json')


def print_status(state_dir, now=None, out=print):
    """The CFO check in one command: every source's health and every pool, read from capacity.json."""
    try:
        doc = json.loads((state_dir / 'capacity.json').read_text())
    except (OSError, ValueError):
        out('no capacity.json yet: the detector has not run')
        return
    now = now if now is not None else datetime.now(timezone.utc).timestamp()
    out(f"capacity as of {clock(doc['generated_at'])} ({hours((now - doc['generated_at']) / 3600)} ago)")
    for name, s in doc.get('sources', {}).items():
        health = f"STALE {hours(s['blind_h'])}" if s.get('stale') else 'ok'
        out(f"source {name}: {health}, last fresh {clock(s['last_ok'])}" + (f", error: {s['last_error']}" if s.get('last_error') else ''))
    for p in doc.get('pools', []):
        rate = f"{p['rate_pct_h']:+.1f}%/h" if p.get('rate_pct_h') is not None else 'rate unknown'
        eta = f", reserve in {hours(p['eta_reserve_h'])}" if p.get('eta_reserve_h') is not None else ''
        out(f"{p['level']:8} {p['used_pct']:5.1f}%  {p['label']}: {rate}{eta}, resets in {hours(p.get('to_reset_h'))}"
            + (', STALE' if p.get('stale') else '') + f", sent {p.get('sent_level', 'ok')}")


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
                                    lambda text: sent.append(text) or True, sample['t'], policy, verifier=None):
                if outcome == 'delivered':
                    print(f"t+{(sample['t'] - fixture['samples'][0]['t']) / 60:.0f} min at {sample['used_pct']:.0f}%:\n{sent[-1]}\n")
        if not sent:
            print('no alerts fired')


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--state-dir', type=Path, default=STATE_DIR)
    parser.add_argument('--dry-run', action='store_true', help='print alerts instead of posting')
    parser.add_argument('--replay', type=Path, help='replay a synthetic fixture; never posts')
    parser.add_argument('--calibration', action='store_true', help='print forecast accuracy and cross-checks')
    parser.add_argument('--status', action='store_true', help='every source and pool from capacity.json; the CFO check')
    args = parser.parse_args()
    if args.replay:
        return replay(args.replay)
    if args.status:
        return print_status(args.state_dir)
    if args.calibration:
        state = load_state(args.state_dir)
        for key, calibration in state.get('calibration', {}).items():
            summary = calibration_summary(calibration)
            print(f"{key}: n={summary['n']} bias={summary['bias']:+.2f} mae={summary['mae']:.2f} factor=x{rate_factor(calibration):.2f}")
        for check in state.get('crosschecks', [])[-5:]:
            print(f"crosscheck {clock(check['at'])}: collector {check['collector']}% vs independent {check['independent']}% (diff {check['diff']:+})")
        return
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
