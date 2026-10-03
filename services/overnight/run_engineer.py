#!/usr/bin/env python3
"""Launch one headless Claude Code worker for an executor task. Standard library only.

  run_engineer.py <task> [--work-dir DIR] [--model MODEL]

Reads <work-dir>/<task>.prompt, writes <work-dir>/<task>.result.json and prints
a one-line summary. Exits non-zero on a worker error or any permission denial.
API-key variables are stripped so workers always run on the Claude Max
subscription, never on pay-as-you-go API billing.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

WORK_DIR = Path(os.environ.get('BAMWARE_BATCH_WORK') or Path.home() / '.local/state/bamware/overnight/work')
# Fallback only: the batch should pass the CFO-routed model (config/model-routing.yaml).
DEFAULT_MODEL = 'sonnet'
TOOLS = 'Read,Write,Edit,Glob,Grep,Bash'
ALLOWED = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(pwd)', 'Bash(date *)', 'Bash(node *)',
           'Bash(npm test*)', 'Bash(npm run *)', 'Bash(python3 *)', 'Bash(git *)', 'Bash(gh issue view *)',
           'Bash(gh pr view *)', 'Bash(gh pr diff *)', 'Bash(gh api *)', 'Bash(ls *)', 'Bash(rg *)',
           'Bash(sed *)', 'Bash(cat *)', 'Bash(find *)', 'Bash(timeout *)']
PAID_API_VARS = ('ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
                 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY')


def claude_argv(prompt, model, claude=None):
    claude = claude or shutil.which('claude') or str(Path.home() / '.local/bin/claude')
    return [claude, '-p', '--model', model, '--safe-mode', '--strict-mcp-config',
            '--permission-mode', 'dontAsk', '--tools', TOOLS, '--allowedTools', *ALLOWED,
            '--output-format', 'json', prompt]


def subscription_env(environ=None):
    env = dict(environ if environ is not None else os.environ)
    for key in PAID_API_VARS:
        env.pop(key, None)
    return env


def run_task(task, work_dir=WORK_DIR, model=DEFAULT_MODEL, run=subprocess.run):
    prompt = (work_dir / f'{task}.prompt').read_text()
    result_path = work_dir / f'{task}.result.json'
    with open(result_path, 'w') as out:
        rc = run(claude_argv(prompt, model), stdin=subprocess.DEVNULL, stdout=out, env=subscription_env()).returncode
    try:
        data = json.loads(result_path.read_text())
    except (OSError, ValueError):
        return 1, {'error': 'worker returned no parseable result'}
    summary = {k: data.get(k) for k in ('is_error', 'subtype', 'num_turns', 'session_id', 'permission_denials', 'usage')}
    if data.get('is_error') or data.get('permission_denials'):
        rc = 1
    return rc, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('task')
    parser.add_argument('--work-dir', type=Path, default=WORK_DIR)
    parser.add_argument('--model', default=DEFAULT_MODEL)
    args = parser.parse_args()
    rc, summary = run_task(args.task, args.work_dir, args.model)
    print(json.dumps(summary))
    sys.exit(rc)


if __name__ == '__main__':
    main()
