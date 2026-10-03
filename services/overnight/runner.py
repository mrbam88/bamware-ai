#!/usr/bin/env python3
"""Server-owned, bounded overnight batches. Standard library only."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def write(path, data):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, indent=2) + '\n')
    tmp.chmod(0o600)
    tmp.replace(path)


def read(path):
    return json.loads(Path(path).read_text())


def validate(batch):
    if batch.get('schema') != 1 or not batch.get('tasks'):
        raise ValueError('schema=1 and a nonempty tasks list required')
    if batch.get('unresolved_decisions') != []:
        raise ValueError('resolve all decisions before handoff')
    ids = set()
    for task in batch['tasks']:
        if task.get('id') in ids or not task.get('id'):
            raise ValueError('task ids must be unique and nonempty')
        if not set(task.get('depends_on', [])) <= ids:
            raise ValueError('dependencies must refer to earlier tasks')
        ids.add(task['id'])
        if task.get('approved') is not True:
            raise ValueError(f"{task['id']}: scope/permissions not approved")
        if not Path(task.get('cwd', '')).is_absolute() or not Path(task['cwd']).is_dir():
            raise ValueError('cwd must be an existing absolute directory')
        for field in ('argv',):
            command(task.get(field))
        for field in ('preflight', 'verify'):
            if not task.get(field):
                raise ValueError(f'{field} commands required')
            for argv in task[field]:
                command(argv)
        seconds = task.get('timeout_seconds', 0)
        if not isinstance(seconds, int) or not 1 <= seconds <= 14400:
            raise ValueError('timeout_seconds must be 1..14400')
    return batch


def command(argv):
    if not isinstance(argv, list) or not argv or not all(isinstance(x, str) for x in argv):
        raise ValueError('commands must be nonempty argv arrays')


def execute(argv, cwd, seconds, log, started=None):
    with open(log, 'ab') as out:
        proc = subprocess.Popen(argv, cwd=cwd, stdin=subprocess.DEVNULL,
                                stdout=out, stderr=out, start_new_session=True)
        try:
            if started:
                started(proc.pid)
            return proc.wait(timeout=seconds), False
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                pass
            # Kill any descendants that outlived the group leader, too.
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            proc.wait()
            return proc.returncode, True
        except BaseException:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            proc.wait()
            raise


def checks(commands, task, log):
    for argv in commands:
        rc, timeout = execute(argv, task['cwd'], 30, log)
        if rc or timeout:
            return False
    return True


def preflight(batch, root):
    validate(batch)
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    for i, task in enumerate(batch['tasks']):
        if not checks(task['preflight'], task, root / f'preflight-{i}.log'):
            raise ValueError(f"{task['id']}: preflight failed; batch not started")


def worker(root):
    batch = validate(read(root / 'batch.json'))
    # One batch on this host at a time; no accidental overlapping workers.
    with open(root.parent / 'worker.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = {'phase': 'running', 'started_at': time.time(), 'tasks': []}
        write(root / 'status.json', state)
        completed = set()
        for i, task in enumerate(batch['tasks']):
            record = {'id': task['id'], 'state': 'running', 'started_at': time.time()}
            state['tasks'].append(record)
            log = root / f'task-{i}.log'
            if not set(task.get('depends_on', [])) <= completed:
                record['state'] = 'blocked_dependency'
            else:
                write(root / 'status.json', state)
                def acknowledged(pid):
                    write(root / 'pickup.json', {'worker_pid': os.getpid(), 'task_pid': pid,
                        'task': task['id'], 'at': time.time(), 'batch_sha256':
                        hashlib.sha256((root / 'batch.json').read_bytes()).hexdigest()})
                try:
                    rc, timeout = execute(task['argv'], task['cwd'], task['timeout_seconds'],
                                          log, acknowledged)
                    record['exit_code'] = rc
                    if timeout:
                        record['state'] = 'timed_out'
                    elif rc:
                        record['state'] = 'failed'
                    elif checks(task['verify'], task, log):
                        record['state'] = 'verified'
                        completed.add(task['id'])
                    else:
                        record['state'] = 'verification_failed'
                except OSError as exc:
                    record.update(state='failed', reason=str(exc))
            record['finished_at'] = time.time()
            record['evidence_log'] = str(log)
            write(root / 'status.json', state)
        state.update(phase='finished', finished_at=time.time())
        write(root / 'status.json', state)
        (root / 'report.txt').write_text('\n'.join(
            f"{t['id']}: {t['state']} ({t['evidence_log']})" for t in state['tasks']) + '\n')


def launch(manifest, state_dir):
    os.umask(0o077)
    batch = read(manifest)
    model = Path('/sys/class/dmi/id/product_name').read_text().strip()
    if model != 'MacBookPro16,4':
        raise ValueError(f'wrong machine: {model}; launch on the verified server')
    linger = subprocess.check_output(['loginctl', 'show-user', str(os.getuid()), '-p', 'Linger'], text=True)
    if 'Linger=yes' not in linger:
        raise ValueError('user service linger is not enabled')
    root = Path(state_dir).expanduser().resolve() / f'{time.time_ns()}'
    preflight(batch, root)
    write(root / 'batch.json', batch)
    unit = 'bamware-overnight-' + root.name
    write(root / 'launch.json', {'unit': unit, 'machine': model, 'smoke_test': batch.get('smoke_test', False)})
    subprocess.run(['systemd-run', '--user', '--unit', unit, '--property=Type=exec',
                    '--property=KillMode=control-group', '--property=TimeoutStopSec=5',
                    '--property=RuntimeMaxSec=' + str(sum(t['timeout_seconds'] + 30 * len(t['verify']) + 10 for t in batch['tasks']) + 60),
                    '--setenv=PATH=' + os.environ['PATH'], sys.executable,
                    str(Path(__file__).resolve()), 'worker', str(root)], check=True)
    for _ in range(50):
        active = subprocess.run(['systemctl', '--user', 'is-active', '--quiet', unit]).returncode == 0
        if (root / 'pickup.json').exists() and active:
            print('Smoke test handoff confirmed.' if batch.get('smoke_test') else 'Ready, good night.')
            print(f'Server unit: {unit}\nEvidence: {root}', flush=True)
            return
        time.sleep(.1)
    raise ValueError(f'No active worker pickup confirmed; NOT ready. Inspect {root} and {unit}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    launch_cmd = sub.add_parser('start')
    launch_cmd.add_argument('manifest')
    launch_cmd.add_argument('--state-dir', default='~/.local/state/bamware/overnight')
    worker_cmd = sub.add_parser('worker')
    worker_cmd.add_argument('root', type=Path)
    status_cmd = sub.add_parser('status')
    status_cmd.add_argument('root', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    if args.action == 'start':
        launch(args.manifest, args.state_dir)
    elif args.action == 'worker':
        worker(args.root)
    else:
        print(json.dumps(read(args.root / 'status.json'), indent=2))
        launch_info = read(args.root / 'launch.json')
        subprocess.run(['systemctl', '--user', 'show', launch_info['unit'], '-p', 'ActiveState', '-p', 'Result'])


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f'Overnight Mode: {error}', file=sys.stderr)
        sys.exit(1)
