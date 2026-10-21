#!/usr/bin/env python3
"""Publish review artifacts and an actionable report even when QA tooling fails.

Batch-specific facts live in <work-dir>/finalize.json, never in this file:
  {"repo": "mrbam88/bamware-ai", "pr": "80", "branch": "feat/...",
   "tasks": ["75", "76"], "title": "Overnight build report — 2026-10-02"}
"""
import json
import os
import subprocess
from pathlib import Path

ARTIFACTS = Path(os.environ.get('BAMWARE_BATCH_WORK') or Path.home() / '.local/state/bamware/overnight/work')
CONFIG_KEYS = ('repo', 'pr', 'branch', 'tasks', 'title')


def load_config():
    config = json.loads((ARTIFACTS / 'finalize.json').read_text())
    missing = [k for k in CONFIG_KEYS if not config.get(k)]
    if missing:
        raise ValueError(f'finalize.json missing {missing}')
    return config


def run(argv, timeout=60):
    try:
        return subprocess.run(argv, timeout=timeout, text=True, capture_output=True)
    except (subprocess.TimeoutExpired, OSError) as exc:
        return subprocess.CompletedProcess(argv, 124, '', type(exc).__name__)


def evidence(task):
    try:
        return json.loads((ARTIFACTS / f'{task}.evidence.json').read_text())
    except (OSError, ValueError):
        return {}


def finalize(qa_exit, config=None):
    config = config or load_config()
    REPO, PR, BRANCH, tasks = config['repo'], str(config['pr']), config['branch'], [str(t) for t in config['tasks']]
    qa = evidence('qa')
    result = {'qa_process_exit': qa_exit, 'qa_status': qa.get('status', 'unknown'),
              'pr_url': None, 'code_published': False, 'report_published': False,
              'deployed': False, 'failures': [], 'report': str(ARTIFACTS / 'report.md')}
    sections = [f"# {config['title']}",
                'Scope: ' + ', '.join(f'#{t}' for t in tasks) + '. This report is not deployment evidence.']
    for task in tasks:
        data = evidence(task)
        sections += [f'## #{task}', f"Status: {data.get('status', 'no evidence')}",
                     str(data.get('summary', 'No completion evidence returned.')),
                     'Limitations: ' + json.dumps(data.get('limitations', []))]
    sections += ['## QA', f"Verdict: {result['qa_status']}; tool process exit: {qa_exit}",
                 str(qa.get('summary', 'QA did not return a verdict.')),
                 'Defects: ' + json.dumps(qa.get('defects', [])),
                 'Limitations: ' + json.dumps(qa.get('limitations', []))]
    # Publishing reviewable code is distinct from accepting or deploying it.
    # Explicit approval to publish remains necessary; a tool exit code alone
    # cannot override it. Missing/malformed approval still fails closed.
    if qa.get('approved_for_publish') is True:
        check = run(['git', 'diff', '--check'])
        if check.returncode:
            result['failures'].append('diff-check failed; code publication pending')
        else:
            push = run(['git', 'push', '-u', 'origin', BRANCH])
            if push.returncode:
                result['failures'].append('git push failed; commits remain server-local')
            else:
                result['code_published'] = True
    else:
        result['failures'].append('No explicit publish approval in QA evidence; code publication pending')
    sections += ['## Delivery',
                 f"Code published: {result['code_published']}. Deployed: false.",
                 'Delivery failures: ' + json.dumps(result['failures']),
                 'Next action: review published implementation and recorded gaps; '
                 'if publication failed, recover the server commits and fix the named delivery step.']
    body = ARTIFACTS / 'report.md'
    body.write_text('\n\n'.join(sections) + '\n')
    # Always publish the result, including when code push or QA failed.
    update = run(['gh', 'pr', 'edit', PR, '-R', REPO, '--body-file', str(body)])
    if update.returncode:
        result['failures'].append('PR report update failed; local report retained')
    else:
        result['report_published'] = True
        result['pr_url'] = f'https://github.com/{REPO}/pull/{PR}'
    if result['code_published'] and result['report_published']:
        ready = run(['gh', 'pr', 'ready', PR, '-R', REPO])
        if ready.returncode:
            # Already-ready PRs are a valid idempotent repeat.
            state = run(['gh', 'pr', 'view', PR, '-R', REPO, '--json', 'isDraft'])
            try:
                is_ready = state.returncode == 0 and json.loads(state.stdout)['isDraft'] is False
            except (ValueError, KeyError):
                is_ready = False
            if not is_ready:
                result['failures'].append('PR ready-for-review state unconfirmed')
    for task in tasks:
        data = evidence(task)
        note = ARTIFACTS / f'{task}.report.txt'
        note.write_text(f"Overnight implementation: {data.get('status', 'no evidence')}. "
                        f"QA: {result['qa_status']} (tool exit {qa_exit}). "
                        f"Code published: {result['code_published']}. "
                        f"Report published: {result['report_published']}. "
                        f"Details: https://github.com/{REPO}/pull/{PR}. "
                        'Limitations: ' + json.dumps(data.get('limitations', [])) +
                        ' Delivery failures: ' + json.dumps(result['failures']) +
                        ' No merge/deployment performed by this reporting step.\n')
        receipt = run(['gh', 'issue', 'comment', task, '-R', REPO, '--body-file', str(note)])
        result[f'issue_{task}_receipt'] = receipt.stdout.strip() if receipt.returncode == 0 else 'not confirmed'
    (ARTIFACTS / 'delivery.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
    return result


def main():
    # A timeout/crash cannot prevent the reporting stage.
    qa = run(['/usr/bin/python3', str(Path(__file__).with_name('run_engineer.py')), 'qa',
              '--work-dir', str(ARTIFACTS)], timeout=1500)
    finalize(qa.returncode)


if __name__ == '__main__':
    main()
