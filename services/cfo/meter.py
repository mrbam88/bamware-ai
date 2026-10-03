#!/usr/bin/env python3
"""CFO meter: what each task costs in % of each subscription pool (#107).

On subscription plans the limit is the currency. The executor runs tasks one
at a time, so a fresh reading of every pool before and after a task gives that
task's cost. Standard library only; reuses the burn alert's source parsers.

  meter.py snapshot                 # fresh readings of every pool, as JSON
  meter.py record < task.json       # {batch, task, ticket, state, before, after} -> ledger
  meter.py summary [--days N]       # cost per ticket and per day
"""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import burn_alert  # noqa: E402  (shared source parsers)

HOME = Path.home()
LEDGER = HOME / '.local/state/bamware/cfo/costs.jsonl'
OPENAI_COLLECTOR = Path(os.environ.get('BAMWARE_OPENAI_COLLECTOR') or
                        HOME / 'srv/bamware-ai/services/assistant-web/scripts/collect-server-quota.py')
CLAUDE_SAMPLER_DIR = Path(os.environ.get('BAMWARE_CLAUDE_SAMPLER_DIR') or
                          HOME / 'code/bamware-web/.claude/worktrees/ai-spend-dashboard')
ROLLOVER_S = 3600


def refresh(run=subprocess.run):
    """Ask each collector for a fresh reading now. Failures are reported, never raised."""
    errors = {}
    jobs = {'openai-codex': ([sys.executable, str(OPENAI_COLLECTOR)], None),
            'claude-max': (['npm', 'run', '--silent', 'ai-quota:sample'], CLAUDE_SAMPLER_DIR)}
    for name, (argv, cwd) in jobs.items():
        try:
            out = run(argv, cwd=cwd, capture_output=True, text=True, timeout=60)
            if out.returncode != 0:
                errors[name] = f'refresh exit {out.returncode}'
        except (OSError, subprocess.SubprocessError) as error:
            errors[name] = f'refresh failed: {error.__class__.__name__}'
    return errors


def other_claude_sessions(run=subprocess.run):
    """Interactive Claude sessions share the Claude Max pool and blur attribution."""
    try:
        out = run(['pgrep', '-c', '-x', 'claude'], capture_output=True, text=True, timeout=5)
        return int(out.stdout.strip() or 0)
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def snapshot(sources=None, refresher=refresh, sessions=other_claude_sessions):
    errors = refresher()
    sources = sources or {'openai-codex': burn_alert.openai_source,
                          'claude-max': lambda: burn_alert.claude_source(tail=1),
                          'copilot': burn_alert.copilot_source}
    pools = {}
    for name, source in sources.items():
        observations, error = source()
        if error:
            errors.setdefault(name, error)
        for obs in observations:
            latest = pools.get(obs['key'])
            if latest is None or obs['observed_at'] >= latest['observed_at']:
                pools[obs['key']] = {'label': obs['label'], 'used_pct': obs['used_pct'],
                                     'reset_at': obs['reset_at'], 'observed_at': obs['observed_at']}
    return {'at': datetime.now(timezone.utc).timestamp(), 'pools': pools, 'errors': errors,
            'other_claude_sessions': sessions()}


def cost(before, after):
    """Per-pool delta. A reset rollover or a drop makes the delta unknown, never negative."""
    pools = {}
    for key, b in before.get('pools', {}).items():
        a = after.get('pools', {}).get(key)
        if a is None:
            pools[key] = {'delta_pct': None, 'note': 'no reading after the task'}
            continue
        rolled = b.get('reset_at') and a.get('reset_at') and abs(a['reset_at'] - b['reset_at']) > ROLLOVER_S
        delta = round(a['used_pct'] - b['used_pct'], 2)
        if rolled or delta < -0.5:
            pools[key] = {'delta_pct': None, 'note': 'window reset during the task'}
        else:
            pools[key] = {'delta_pct': max(delta, 0.0), 'before': b['used_pct'], 'after': a['used_pct'],
                          'label': a.get('label')}
    busy = [n for n in (before.get('other_claude_sessions'), after.get('other_claude_sessions')) if n]
    return {'pools': pools, 'attribution': 'shared' if busy else 'exclusive' if None not in
            (before.get('other_claude_sessions'), after.get('other_claude_sessions')) else 'unknown'}


def record(entry, ledger=LEDGER):
    result = {**{k: entry.get(k) for k in ('batch', 'task', 'ticket', 'state')},
              'started_at': entry['before'].get('at'), 'finished_at': entry['after'].get('at'),
              **cost(entry['before'], entry['after'])}
    ledger.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with open(ledger, 'a') as stream:
        stream.write(json.dumps(result) + '\n')
    return result


def summary(ledger=LEDGER, days=7, now=None):
    now = now if now is not None else datetime.now(timezone.utc).timestamp()
    rows = []
    try:
        lines = ledger.read_text().splitlines()
    except OSError:
        return {'tasks': [], 'per_day': {}}
    for line in lines:
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if (row.get('finished_at') or 0) >= now - days * 86400:
            rows.append(row)
    per_day = defaultdict(lambda: defaultdict(float))
    for row in rows:
        day = datetime.fromtimestamp(row['finished_at']).strftime('%Y-%m-%d')
        for key, pool in row['pools'].items():
            if pool.get('delta_pct') is not None:
                per_day[day][key] += pool['delta_pct']
    return {'tasks': rows, 'per_day': {d: dict(v) for d, v in per_day.items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('snapshot')
    sub.add_parser('record')
    summary_cmd = sub.add_parser('summary')
    summary_cmd.add_argument('--days', type=int, default=7)
    args = parser.parse_args()
    if args.action == 'snapshot':
        print(json.dumps(snapshot()))
    elif args.action == 'record':
        print(json.dumps(record(json.load(sys.stdin))))
    else:
        report = summary(days=args.days)
        for row in report['tasks']:
            spent = ', '.join(f"{k.split(':')[0]}:{k.split(':')[-1]} {p['delta_pct']:.1f}%"
                              for k, p in row['pools'].items() if p.get('delta_pct')) or 'no measurable cost'
            print(f"{row.get('ticket') or row.get('task')} [{row.get('state')}, {row['attribution']}]: {spent}")
        for day, pools in sorted(report['per_day'].items()):
            print(f"{day}: " + ', '.join(f"{k.split(':')[0]}:{k.split(':')[-1]} {v:.1f}%" for k, v in pools.items()))


if __name__ == '__main__':
    main()
