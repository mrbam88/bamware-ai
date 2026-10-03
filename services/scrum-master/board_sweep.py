#!/usr/bin/env python3
"""Scrum Master board sweep: deterministic, read-only collector. Standard library only.

Reads the Projects board and, for every active item, its issue, linked PRs and
PR checks with `gh`, flags delivery problems, and writes a receipt. It never
writes to GitHub and makes no model calls; the scrum-master Hermes cron job
runs it with `--script` and only summarizes its output (#98).
Operating guide: services/scrum-master/README.md.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

INACTIVE = {'Done', 'Backlog', 'Ideas'}
STALE_HOURS = 72
# Most urgent first; rank() orders findings by this, then by board priority.
SEVERITY = ['failing-checks', 'merged-but-active', 'closed-but-active', 'qa-without-pr',
            'in-progress-no-worker', 'no-owner', 'stale-72h', 'no-status']
FAILING_BUCKETS = {'fail', 'cancel'}
PR_URL = re.compile(r'github\.com/([^/]+/[^/]+)/pull/(\d+)')
WORKERS = 8
TOP_N = 10


class SourceError(Exception):
    pass


def epoch(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def finding(item, flag, evidence):
    content = item.get('content') or {}
    return {'repo': content.get('repository'), 'number': content.get('number'),
            'url': content.get('url'), 'title': item.get('title'), 'status': item.get('status'),
            'priority': item.get('priority'), 'flag': flag, 'evidence': evidence}


def assess(item, issue, prs, now):
    """Flags for one active board item. issue is None for drafts and PR items."""
    out = []
    status, worker = item.get('status'), item.get('worker')
    assignees = [a['login'] for a in (issue or {}).get('assignees') or []]
    if not worker and not assignees:
        out.append(finding(item, 'no-owner', 'no assignee and no Worker field'))
    if status == 'In Progress' and not worker:
        out.append(finding(item, 'in-progress-no-worker', 'status In Progress, Worker empty'))
    if issue and issue.get('state') == 'CLOSED':
        out.append(finding(item, 'closed-but-active', f'issue closed; board status {status}'))
    for pr in prs:
        if pr.get('mergedAt'):
            out.append(finding(item, 'merged-but-active', f"{pr.get('url')} merged {pr['mergedAt']}"))
        elif pr.get('state') == 'OPEN':
            failing = [c.get('name') or c['bucket'] for c in pr.get('checks') or []
                       if c.get('bucket') in FAILING_BUCKETS]
            if failing:
                out.append(finding(item, 'failing-checks', f"{pr.get('url')}: {', '.join(failing)}"))
    if (status or '').lower().startswith('ready for qa') and not prs:
        out.append(finding(item, 'qa-without-pr', 'Ready for QA with no linked PR'))
    updated = issue['updatedAt'] if issue else (prs[0].get('updatedAt') if prs else None)
    if updated and now - epoch(updated) > STALE_HOURS * 3600:
        out.append(finding(item, 'stale-72h', f'last updated {updated}'))
    return out


def rank(findings):
    return sorted(findings, key=lambda f: (SEVERITY.index(f['flag']), f.get('priority') is None,
                                           f.get('priority') or ''))


def gh_runner(gh_bin):
    def run(args):
        try:
            r = subprocess.run([gh_bin, *args], capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise SourceError(str(exc)) from exc
        out = r.stdout.strip()
        # `gh pr checks` exits non-zero for pending/failing checks but still prints JSON.
        if out:
            try:
                return json.loads(out)
            except ValueError:
                pass
        if args[:2] == ['pr', 'checks'] and 'no checks reported' in r.stderr:
            return []
        lines = (r.stderr or out or f'exit {r.returncode}').strip().splitlines()
        raise SourceError(lines[-1] if lines else f'exit {r.returncode}')
    return run


def collect(gh, item):
    """Issue, PRs and failures for one active item. Never raises SourceError."""
    content = item.get('content') or {}
    kind, repo, number = content.get('type'), content.get('repository'), content.get('number')
    ref = f'{repo}#{number}'
    issue, prs, failures = None, [], []
    urls = list(item.get('linked pull requests') or [])
    if kind == 'Issue':
        try:
            issue = gh(['issue', 'view', str(number), '-R', repo, '--json',
                        'assignees,updatedAt,state,closedByPullRequestsReferences'])
        except SourceError as exc:
            return None, [], [{'stage': 'issue view', 'ref': ref, 'error': str(exc)}]
        urls += [p['url'] for p in issue.get('closedByPullRequestsReferences') or [] if p.get('url')]
    elif kind == 'PullRequest':
        urls.append(content.get('url'))
    for url in dict.fromkeys(u for u in urls if u):
        m = PR_URL.search(url)
        if not m:
            continue
        pr_repo, pr_number = m.group(1), m.group(2)
        try:
            pr = gh(['pr', 'view', pr_number, '-R', pr_repo, '--json',
                     'state,mergedAt,updatedAt,isDraft,url'])
            pr.setdefault('url', url)
            if pr.get('state') == 'OPEN':
                pr['checks'] = gh(['pr', 'checks', pr_number, '-R', pr_repo, '--json', 'bucket,name'])
            prs.append(pr)
        except SourceError as exc:
            failures.append({'stage': 'pr view', 'ref': url, 'error': str(exc)})
    return issue, prs, failures


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, indent=2) + '\n')
    os.replace(tmp, path)


def revision():
    try:
        return subprocess.run(['git', '-C', str(Path(__file__).parent), 'rev-parse', '--short', 'HEAD'],
                              capture_output=True, text=True, timeout=10).stdout.strip() or None
    except (OSError, subprocess.TimeoutExpired):
        return None


def sweep(gh, project, owner, state_dir, now):
    started = now()
    findings, failures, unknowns = [], [], []
    try:
        board = gh(['project', 'item-list', project, '--owner', owner, '--limit', '500',
                    '--format', 'json'])['items']
    except SourceError as exc:
        board = []
        failures.append({'stage': 'project item-list', 'error': str(exc)})
    active = [i for i in board if i.get('status') and i['status'] not in INACTIVE]
    findings += [finding(i, 'no-status', 'board item has no Status') for i in board if not i.get('status')]
    with ThreadPoolExecutor(WORKERS) as pool:
        results = list(pool.map(lambda i: collect(gh, i), active))
    issues_checked = prs_checked = 0
    for item, (issue, prs, item_failures) in zip(active, results):
        content = item.get('content') or {}
        failures += item_failures
        if item_failures:
            unknowns.append(f"{content.get('repository')}#{content.get('number')}")
        if content.get('type') == 'Issue' and issue is None:
            continue
        issues_checked += issue is not None
        prs_checked += len(prs)
        findings += assess(item, issue, prs, started)
    findings = rank(findings)
    finished = now()
    stamp = datetime.fromtimestamp(started, timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    receipt_path = Path(state_dir) / 'sweeps' / f'{stamp}.json'
    counts = {flag: sum(f['flag'] == flag for f in findings) for flag in SEVERITY}
    receipt = {
        'receipt': str(receipt_path),
        'started_at': iso(started), 'finished_at': iso(finished),
        'profile': 'scrum-master',
        'collector': {'path': 'services/scrum-master/board_sweep.py', 'revision': revision()},
        'coverage': {'items_total': len(board), 'items_active': len(active),
                     'statuses_seen': sorted({i.get('status') or '(none)' for i in board}),
                     'issues_checked': issues_checked, 'prs_checked': prs_checked},
        'counts': {k: v for k, v in counts.items() if v},
        'findings': findings,
        'actions_taken': [],
        'source_failures': failures,
        'unknowns': unknowns,
    }
    write_json(receipt_path, receipt)
    write_json(Path(state_dir) / 'latest.json', receipt)
    top = [{k: f[k] for k in ('repo', 'number', 'status', 'priority', 'flag', 'evidence')}
           for f in findings[:TOP_N]]
    return {'receipt': receipt['receipt'], 'started_at': receipt['started_at'],
            'finished_at': receipt['finished_at'], 'coverage': receipt['coverage'],
            'counts': receipt['counts'], 'top_findings': top,
            'source_failures': len(failures), 'unknowns': unknowns}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--project', required=True, help='Projects board number')
    parser.add_argument('--owner', required=True, help='board owner login')
    parser.add_argument('--state-dir', required=True, type=Path, help='receipt directory')
    parser.add_argument('--gh', default=shutil.which('gh') or str(Path.home() / '.local/bin/gh'))
    args = parser.parse_args()
    summary = sweep(gh_runner(args.gh), args.project, args.owner, args.state_dir,
                    now=lambda: datetime.now(timezone.utc).timestamp())
    json.dump(summary, sys.stdout, indent=1)
    print()


if __name__ == '__main__':
    main()
