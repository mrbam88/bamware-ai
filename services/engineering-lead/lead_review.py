#!/usr/bin/env python3
"""Engineering Lead trigger: independent review and merge of green PRs. Standard library only.

A systemd timer runs this. It finds open PRs that are green and new at their
head commit, and launches one headless Claude Code Engineering Lead per PR
(skills/qa-engineer). On PASS the Lead merges; this script then deploys to the
one deployed copy of main. The PR author never launches its own reviewer, and
the founder never merges (#125). Selection, guards and deploy are deterministic;
the only model call is the review itself.
Operating guide: services/engineering-lead/README.md.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'overnight'))
from run_engineer import subscription_env  # noqa: E402  (one copy of the paid-API strip list)

OK_CHECKS = {'SUCCESS', 'NEUTRAL', 'SKIPPED'}
MERGE_STATES = {'CLEAN', 'HAS_HOOKS'}
HOLD_LABEL = 'lead:hold'
FINAL = {'PASS', 'FAIL', 'BLOCKED', 'HUMAN_GATE'}
MAX_ERROR_ATTEMPTS = 2
REVIEW_TIMEOUT_S = 45 * 60
# qa-engineer human gates: these never auto-merge; the CEO decides.
HUMAN_GATE = [re.compile(p) for p in (r'^\.github/workflows/', r'(^|/)vercel\.json$', r'(^|/)fastlane/',
                                      r'\.(p12|mobileprovision|cer)$', r'(^|/)eas\.json$')]
TOOLS = 'Read,Write,Glob,Grep,Bash'  # no Edit: the Lead never changes the code it reviews
READ_ONLY = ['Read', 'Glob', 'Grep', 'Write', 'Bash(git diff *)', 'Bash(git log *)', 'Bash(git show *)',
             'Bash(git status*)', 'Bash(python3 *)', 'Bash(node *)', 'Bash(npm ci*)', 'Bash(npm test*)',
             'Bash(npm run *)', 'Bash(bash -n *)', 'Bash(ls *)', 'Bash(rg *)', 'Bash(cat *)', 'Bash(sed -n *)',
             'Bash(gh pr view *)', 'Bash(gh pr diff *)', 'Bash(gh pr checks *)', 'Bash(gh issue view *)']
PROMPT = Path(__file__).resolve().parent / 'review-prompt.md'


class SourceError(Exception):
    pass


def key(repo, number):
    return f'{repo}#{number}'


def human_gate_paths(paths):
    return [p for p in paths if any(g.search(p) for g in HUMAN_GATE)]


def is_green(pr):
    if pr.get('isDraft') or pr.get('mergeable') != 'MERGEABLE' or pr.get('mergeStateStatus') not in MERGE_STATES:
        return False
    if any(l.get('name') == HOLD_LABEL for l in pr.get('labels') or []):
        return False
    return all((c.get('conclusion') or c.get('state')) in OK_CHECKS for c in pr.get('statusCheckRollup') or [])


def candidates(repo, prs, reviewed):
    out = []
    for pr in prs:
        if not is_green(pr):
            continue
        last = reviewed.get(key(repo, pr['number']))
        if last and last.get('head') == pr['headRefOid']:
            if last.get('verdict') in FINAL or last.get('attempts', 0) >= MAX_ERROR_ATTEMPTS:
                continue
        out.append(pr)
    return out


def paused(state_dir):
    """The founder emergency stop: while its file exists, launch nothing."""
    path = Path(state_dir) / 'emergency-stop.json'
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text()).get('reason') or 'emergency stop'
    except (OSError, ValueError):
        return 'emergency stop (unreadable file)'


def allowlist(repo, number):
    scoped = [f'Bash(gh pr {verb} {number} -R {repo} *)' for verb in ('comment', 'review', 'merge')]
    return READ_ONLY + scoped


def claude_argv(prompt, repo, number, model, claude=None):
    claude = claude or shutil.which('claude') or str(Path.home() / '.local/bin/claude')
    return [claude, '-p', '--model', model, '--safe-mode', '--strict-mcp-config',
            '--permission-mode', 'dontAsk', '--tools', TOOLS, '--allowedTools', *allowlist(repo, number),
            '--output-format', 'json', prompt]


def gh_runner(gh_bin):
    def gh(args):
        try:
            r = subprocess.run([gh_bin, *args], capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise SourceError(str(exc)) from exc
        if r.returncode:
            raise SourceError((r.stderr or f'exit {r.returncode}').strip().splitlines()[-1])
        return json.loads(r.stdout)
    return gh


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, indent=2) + '\n')
    os.replace(tmp, path)


def read_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return default


def deploy(cfg, run):
    """Move the deployed main worktree to origin/main, unless a batch runs or it is dirty."""
    target = cfg.get('deploy_worktree')
    if not target:
        return None, None
    units = run(['systemctl', '--user', 'list-units', '--state=active', '--no-legend', 'bamware-overnight-*'],
                capture_output=True, text=True).stdout.strip()
    if units:
        return None, 'an Overnight batch is running; deploy on the next cycle'
    if run(['git', '-C', target, 'status', '--porcelain'], capture_output=True, text=True).stdout.strip():
        return None, f'{target} has local changes; not touching it'
    run(['git', '-C', cfg['checkout'], 'fetch', '-q', 'origin'], capture_output=True, text=True)
    run(['git', '-C', target, 'checkout', '-q', '--detach', 'origin/main'], capture_output=True, text=True)
    return run(['git', '-C', target, 'log', '--oneline', '-1'], capture_output=True, text=True).stdout.strip(), None


def review(repo, cfg, pr, lead_dir, gh, run, claude, model):
    number, head = pr['number'], pr['headRefOid']
    name = f"{repo.replace('/', '-')}-{number}-{head[:7]}"
    receipt_dir = lead_dir / 'reviews' / name
    receipt_dir.mkdir(parents=True, exist_ok=True)
    gate = human_gate_paths([f['path'] for f in pr.get('files') or []])
    if gate:
        return {'verdict': 'HUMAN_GATE', 'human_gate_paths': gate, 'merged': False}, receipt_dir
    checkout, worktree = cfg['checkout'], lead_dir / 'checkouts' / name
    prompt = PROMPT.read_text().format(repo=repo, number=number, head=head, receipt_dir=receipt_dir)
    (receipt_dir / 'prompt.md').write_text(prompt)
    result = {}
    try:
        run(['git', '-C', checkout, 'fetch', '-q', 'origin', f'pull/{number}/head'], capture_output=True, text=True)
        run(['git', '-C', checkout, 'worktree', 'add', '-q', '--detach', str(worktree), head],
            capture_output=True, text=True)
        env = subscription_env()
        env['BAMWARE_LEAD_RECEIPT_DIR'] = str(receipt_dir)
        r = run(claude_argv(prompt, repo, number, model, claude), capture_output=True, text=True,
                timeout=REVIEW_TIMEOUT_S, cwd=str(worktree), env=env, stdin=subprocess.DEVNULL)
        (receipt_dir / 'result.json').write_text(r.stdout or '')
        out = read_json(receipt_dir / 'result.json', {})
        result['lead'] = {k: out.get(k) for k in ('is_error', 'num_turns', 'session_id')}
        result['lead']['denied_commands'] = len(out.get('permission_denials') or [])
    except subprocess.TimeoutExpired:
        result['lead'] = {'is_error': True, 'error': f'timed out after {REVIEW_TIMEOUT_S}s'}
    finally:
        run(['git', '-C', checkout, 'worktree', 'remove', '--force', str(worktree)], capture_output=True, text=True)
    verdict = read_json(receipt_dir / 'verdict.json', {})
    result['verdict'] = verdict.get('verdict') if verdict.get('verdict') in FINAL else 'ERROR'
    result['findings'] = verdict.get('findings') or []
    try:
        view = gh(['pr', 'view', str(number), '-R', repo, '--json', 'state,mergeCommit'])
        result['merged'] = view.get('state') == 'MERGED'
        result['merge_commit'] = (view.get('mergeCommit') or {}).get('oid')
    except SourceError as exc:
        result['merged'], result['source_failure'] = None, str(exc)
    return result, receipt_dir


def cycle(repos, state_dir, gh, run, claude, model, max_reviews, now):
    if paused(state_dir):
        return []
    lead_dir = Path(state_dir) / 'engineering-lead'
    reviewed = read_json(lead_dir / 'reviewed.json', {})
    receipts = []
    for repo, cfg in repos.items():
        try:
            prs = gh(['pr', 'list', '-R', repo, '--state', 'open', '--limit', '50', '--json',
                      'number,title,headRefOid,isDraft,mergeable,mergeStateStatus,statusCheckRollup,labels,files'])
        except SourceError as exc:
            receipts.append({'repo': repo, 'source_failure': str(exc)})
            continue
        for pr in candidates(repo, prs, reviewed)[:max(0, max_reviews - len(receipts))]:
            started = now()
            result, receipt_dir = review(repo, cfg, pr, lead_dir, gh, run, claude, model)
            result['deployed'], result['deploy_skipped'] = (deploy(cfg, run) if result.get('merged') else (None, None))
            receipt = {'repo': repo, 'number': pr['number'], 'head': pr['headRefOid'], 'title': pr.get('title'),
                       'model': model, 'started_at': iso(started), 'finished_at': iso(now()), **result}
            write_json(receipt_dir / 'receipt.json', receipt)
            last = reviewed.get(key(repo, pr['number'])) or {}
            attempts = last.get('attempts', 0) + 1 if last.get('head') == pr['headRefOid'] else 1
            reviewed[key(repo, pr['number'])] = {'head': pr['headRefOid'], 'verdict': result['verdict'],
                                                 'attempts': attempts, 'at': receipt['finished_at'],
                                                 'receipt': str(receipt_dir / 'receipt.json')}
            write_json(lead_dir / 'reviewed.json', reviewed)
            receipts.append(receipt)
    return receipts


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def parse_repo(spec):
    """OWNER/NAME=CHECKOUT[=DEPLOY_WORKTREE]"""
    parts = spec.split('=')
    if len(parts) not in (2, 3):
        raise argparse.ArgumentTypeError(f'expected OWNER/NAME=CHECKOUT[=DEPLOY_WORKTREE], got {spec!r}')
    cfg = {'checkout': os.path.expanduser(parts[1])}
    if len(parts) == 3:
        cfg['deploy_worktree'] = os.path.expanduser(parts[2])
    return parts[0], cfg


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--repo', action='append', type=parse_repo, required=True,
                        help='OWNER/NAME=CHECKOUT[=DEPLOY_WORKTREE]; repeatable')
    parser.add_argument('--state-dir', type=Path, default=Path.home() / '.local/state/bamware')
    parser.add_argument('--model', default='opus', help='top tier, config/model-routing.yaml')
    parser.add_argument('--max-reviews', type=int, default=2)
    parser.add_argument('--gh', default=shutil.which('gh') or str(Path.home() / '.local/bin/gh'))
    args = parser.parse_args()
    reason = paused(args.state_dir)
    if reason:
        print(json.dumps({'paused': reason}))
        return
    receipts = cycle(dict(args.repo), args.state_dir, gh_runner(args.gh), subprocess.run, None,
                     args.model, args.max_reviews, now=lambda: datetime.now(timezone.utc).timestamp())
    print(json.dumps([{k: r.get(k) for k in ('repo', 'number', 'verdict', 'merged', 'deployed', 'source_failure')}
                      for r in receipts]))


if __name__ == '__main__':
    main()
