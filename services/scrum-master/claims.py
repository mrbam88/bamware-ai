#!/usr/bin/env python3
"""Ticket claims and the one-per-night batch lock (#117). Standard library only.

State lives in the existing Scrum Master ledger, `.scrum-master.json`, beside
the blocker ledgers (default ~/.local/state/bamware/, the assistant-web state
dir). This adds three top-level keys and touches nothing else: `claims`
(ticket -> record), `batches` (newest last) and `claimReceipts`. assistant-web
rewrites the whole file but preserves unknown keys. This CLI never creates the
ledger or the mandate; assistant-web does that.

Usage (any session, locally or over SSH to the server):
  claims.py status [--json]
  claims.py claim TICKET --by WHO --purpose plan|implement|review [--ttl-hours N]
  claims.py release TICKET --by WHO [--force]
  claims.py batch begin --owner WHO --tickets A,B [--ttl-hours N]
  claims.py batch approve|launch|finish BATCH_ID --by WHO
  claims.py batch show [BATCH_ID]
Exit status is non-zero on any refusal.
"""
import argparse
import contextlib
import datetime
import fcntl
import json
import os
from pathlib import Path
import sys
import time
import uuid

PURPOSES = ('plan', 'implement', 'review')
OPEN_STATES = ('planning', 'approved', 'launched')   # approved-not-launched still holds the night
DEFAULT_TTL_HOURS = 12.0
MAX_RECEIPTS = 200
MAX_BATCHES = 30


class Refusal(Exception):
    pass


def ledger_path(override=None):
    if override:
        return Path(override).expanduser()
    env = os.environ.get('BAMWARE_LEDGER')
    if env:
        return Path(env).expanduser()
    state = os.environ.get('ASSISTANT_WEB_STATE_DIR') or '~/.local/state/bamware'
    return Path(state).expanduser() / '.scrum-master.json'


def iso(ts):
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def parse(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


@contextlib.contextmanager
def locked(path):
    """Exclusive lock on a sidecar file, then read-modify-write atomically."""
    path = Path(path)
    if not path.exists():
        raise Refusal(f'ledger not found at {path}; assistant-web creates it (set BAMWARE_LEDGER or --ledger)')
    with open(str(path) + '.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = json.loads(path.read_text())
        before = json.dumps(state, sort_keys=True)
        yield state
        if json.dumps(state, sort_keys=True) != before:
            tmp = path.with_name(f'{path.name}.{os.getpid()}.claims.tmp')
            tmp.write_text(json.dumps(state, indent=2))
            tmp.chmod(0o600)
            tmp.replace(path)


def snapshot(path):
    path = Path(path)
    if not path.exists():
        raise Refusal(f'ledger not found at {path}')
    return json.loads(path.read_text())


def require_enabled(state):
    status = state.get('mandate', {}).get('status')
    if status != 'enabled':
        raise Refusal(f'Scrum Master mandate is {status!r}; new claims and batches are blocked')


def receipt(state, kind, now, **fields):
    entry = {'id': str(uuid.uuid4()), 'kind': kind, 'at': iso(now), **fields}
    receipts = state.setdefault('claimReceipts', [])
    receipts.append(entry)
    del receipts[:-MAX_RECEIPTS]
    return entry


def expire(state, now, keep=()):
    """Release expired claims with a receipt. Never silently drops one."""
    claims = state.setdefault('claims', {})
    for ticket, held in list(claims.items()):
        if ticket not in keep and parse(held['expiresAt']) <= now:
            receipt(state, 'expired', now, ticket=ticket, claimant=held['claimant'],
                    purpose=held['purpose'], expiredAt=held['expiresAt'])
            del claims[ticket]


def describe(held):
    return f"{held['claimant']} ({held['purpose']}) until {held['expiresAt']}"


def take(state, ticket, claimant, purpose, now, ttl_hours):
    """Claim one ticket in an already-locked state; refuse if someone else holds it.

    An expired claim is taken over with a receipt; the same holder renews.
    """
    if purpose not in PURPOSES:
        raise Refusal(f'purpose must be one of {", ".join(PURPOSES)}')
    claims = state.setdefault('claims', {})
    held = claims.get(ticket)
    revision = 1
    if held:
        live = parse(held['expiresAt']) > now
        if live and held['claimant'] != claimant:
            raise Refusal(f'{ticket} is claimed by {describe(held)}')
        if not live and held['claimant'] != claimant:
            receipt(state, 'takeover', now, ticket=ticket, previousClaimant=held['claimant'],
                    previousExpiredAt=held['expiresAt'], newClaimant=claimant, purpose=purpose)
        revision = held['revision'] + 1
    record = {'ticket': ticket, 'claimant': claimant, 'purpose': purpose, 'claimedAt': iso(now),
              'expiresAt': iso(now + ttl_hours * 3600), 'revision': revision}
    claims[ticket] = record
    return record


def claim(path, ticket, claimant, purpose, ttl_hours=DEFAULT_TTL_HOURS, now=None):
    now = time.time() if now is None else now
    with locked(path) as state:
        require_enabled(state)
        record = take(state, ticket, claimant, purpose, now, ttl_hours)
        expire(state, now, keep=(ticket,))
        return record


def release(path, ticket, claimant, force=False, now=None):
    now = time.time() if now is None else now
    with locked(path) as state:
        claims = state.setdefault('claims', {})
        held = claims.get(ticket)
        if not held:
            raise Refusal(f'{ticket} is not claimed')
        if held['claimant'] != claimant and not force:
            raise Refusal(f'{ticket} is claimed by {describe(held)}; only the holder (or --force) releases it')
        receipt(state, 'release', now, ticket=ticket, claimant=held['claimant'], releasedBy=claimant,
                forced=held['claimant'] != claimant)
        del claims[ticket]
        expire(state, now)


def active_batch(state):
    for batch in state.get('batches', []):
        if batch['state'] in OPEN_STATES:
            return batch
    return None


def batch_begin(path, owner, tickets, ttl_hours=DEFAULT_TTL_HOURS, now=None):
    now = time.time() if now is None else now
    tickets = list(dict.fromkeys(t for t in tickets if t))
    if not tickets:
        raise Refusal('a batch needs at least one ticket')
    with locked(path) as state:
        require_enabled(state)
        open_batch = active_batch(state)
        if open_batch:
            raise Refusal(f"batch {open_batch['batchId']} is {open_batch['state']}, owned by {open_batch['owner']}")
        batch_id = iso(now)[:10].replace('-', '') + '-' + uuid.uuid4().hex[:6]
        claims = state.setdefault('claims', {})
        for ticket in tickets:               # check all first: all-or-nothing
            held = claims.get(ticket)
            if held and parse(held['expiresAt']) > now:
                raise Refusal(f'{ticket} is claimed by {describe(held)}')
        for ticket in tickets:
            take(state, ticket, f'batch:{batch_id}', 'implement', now, ttl_hours)
        expire(state, now, keep=tickets)
        record = {'batchId': batch_id, 'owner': owner, 'state': 'planning', 'tickets': tickets,
                  'createdAt': iso(now), 'history': [{'state': 'planning', 'at': iso(now), 'by': owner}]}
        state.setdefault('batches', []).append(record)
        del state['batches'][:-MAX_BATCHES]
        return record


MOVES = {'approve': ('planning', 'approved'), 'launch': ('approved', 'launched'),
         'finish': ('launched', 'finished')}


def batch_move(path, action, batch_id, by, now=None):
    now = time.time() if now is None else now
    needed, target = MOVES[action]
    with locked(path) as state:
        batch = next((b for b in state.get('batches', []) if b['batchId'] == batch_id), None)
        if not batch:
            raise Refusal(f'no batch {batch_id}')
        if batch['state'] != needed:
            raise Refusal(f"batch {batch_id} is {batch['state']}; {action} needs {needed}")
        batch['state'] = target
        batch['history'].append({'state': target, 'at': iso(now), 'by': by})
        if target == 'finished':
            for ticket in batch['tickets']:
                held = state.get('claims', {}).get(ticket)
                if held and held['claimant'] == f'batch:{batch_id}':
                    receipt(state, 'release', now, ticket=ticket, claimant=held['claimant'],
                            releasedBy=by, forced=False)
                    del state['claims'][ticket]
        return batch


def gate(path, batch_id, task_keys, now=None):
    """Executor gate. Raises Refusal unless the batch is approved and every task is claimed by it.

    task_keys: one list of acceptable claim keys (task id, ticket) per task.
    """
    now = time.time() if now is None else now
    if not batch_id:
        raise Refusal("manifest has no batch_id; run 'claims.py batch begin' and 'batch approve' first")
    state = snapshot(path)
    batch = next((b for b in state.get('batches', []) if b['batchId'] == batch_id), None)
    if not batch:
        raise Refusal(f'batch {batch_id} is not in the ledger')
    if batch['state'] != 'approved':
        raise Refusal(f"batch {batch_id} is {batch['state']}, not approved")
    claims = state.get('claims', {})
    for keys in task_keys:
        hit = next((claims[k] for k in keys if k in claims), None)
        if not hit or parse(hit['expiresAt']) <= now or hit['claimant'] != f'batch:{batch_id}':
            raise Refusal(f"task {keys[0]} is not claimed by batch {batch_id}")
    return batch


def status(path, now=None):
    now = time.time() if now is None else now
    state = snapshot(path)
    claims = [dict(c, expired=parse(c['expiresAt']) <= now) for c in state.get('claims', {}).values()]
    return {'mandate': state.get('mandate', {}).get('status'), 'claims': claims,
            'batch': active_batch(state), 'recentReceipts': state.get('claimReceipts', [])[-10:]}


def render(report):
    lines = [f"mandate: {report['mandate']}"]
    batch = report['batch']
    lines.append(f"batch: {batch['batchId']} {batch['state']} owner={batch['owner']} tickets={','.join(batch['tickets'])}"
                 if batch else 'batch: none open')
    if not report['claims']:
        lines.append('claims: none')
    for c in report['claims']:
        lines.append(f"claim: {c['ticket']} -> {c['claimant']} ({c['purpose']}) until {c['expiresAt']}"
                     + (' [EXPIRED]' if c['expired'] else ''))
    return '\n'.join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--ledger')
    sub = parser.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('status')
    s.add_argument('--json', action='store_true')
    c = sub.add_parser('claim')
    c.add_argument('ticket')
    c.add_argument('--by', required=True)
    c.add_argument('--purpose', required=True, choices=PURPOSES)
    c.add_argument('--ttl-hours', type=float, default=DEFAULT_TTL_HOURS)
    r = sub.add_parser('release')
    r.add_argument('ticket')
    r.add_argument('--by', required=True)
    r.add_argument('--force', action='store_true')
    b = sub.add_parser('batch')
    bs = b.add_subparsers(dest='bcmd', required=True)
    bb = bs.add_parser('begin')
    bb.add_argument('--owner', required=True)
    bb.add_argument('--tickets', required=True)
    bb.add_argument('--ttl-hours', type=float, default=DEFAULT_TTL_HOURS)
    for name in MOVES:
        m = bs.add_parser(name)
        m.add_argument('batch_id')
        m.add_argument('--by', required=True)
    sh = bs.add_parser('show')
    sh.add_argument('batch_id', nargs='?')
    args = parser.parse_args(argv)
    path = ledger_path(args.ledger)
    try:
        if args.cmd == 'status':
            report = status(path)
            print(json.dumps(report, indent=2) if args.json else render(report))
        elif args.cmd == 'claim':
            print(json.dumps(claim(path, args.ticket, args.by, args.purpose, args.ttl_hours), indent=2))
        elif args.cmd == 'release':
            release(path, args.ticket, args.by, args.force)
            print(f'released {args.ticket}')
        elif args.bcmd == 'begin':
            print(json.dumps(batch_begin(path, args.owner, args.tickets.split(','), args.ttl_hours), indent=2))
        elif args.bcmd == 'show':
            state = snapshot(path)
            batch = next((x for x in state.get('batches', []) if x['batchId'] == args.batch_id), None) \
                if args.batch_id else active_batch(state)
            print(json.dumps(batch, indent=2))
        else:
            print(json.dumps(batch_move(path, args.bcmd, args.batch_id, args.by), indent=2))
    except Refusal as error:
        print(f'claims: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
