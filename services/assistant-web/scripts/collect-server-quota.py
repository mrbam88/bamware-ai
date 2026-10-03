#!/usr/bin/env python3
"""Read-only server quota sampling. No model calls, refreshes or credential writes.

Credentials stay in memory and go only to their existing provider's usage GET.
Output is a strict metadata allowlist; errors never include response bodies.
The web process reads only the sanitized output, never these auth stores.
"""
import argparse
import hashlib
import json
import math
import os
import sqlite3
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage'


def number(value):
    return value if type(value) in (int, float) and math.isfinite(value) and value >= 0 else None


def account_alias(account_id):
    if not isinstance(account_id, str) or not account_id.strip():
        return None
    return 'acct-' + hashlib.sha256(('openai-account-v1:' + account_id).encode()).hexdigest()[:24]


def parse_usage(payload, observed_at):
    limits = payload.get('rate_limit') or {}
    windows = []
    for key in ('primary', 'secondary'):
        bucket = limits.get(key + '_window') or {}
        seconds = number(bucket.get('limit_window_seconds'))
        reset = number(bucket.get('reset_at'))
        try:
            reset_at = datetime.fromtimestamp(reset, timezone.utc).isoformat() if reset is not None else None
        except (ValueError, OverflowError, OSError):
            reset_at = None
        windows.append({
            'provider': 'openai-codex',
            'scope': f'{key}-{seconds / 60:g}min' if seconds else key + '-unknown-window',
            'utilizationPct': number(bucket.get('used_percent')),
            'resetAt': reset_at, 'resetTimezone': 'UTC',
            'source': {'kind': 'live', 'label': 'OpenAI usage endpoint · server collector', 'fetchedAt': observed_at},
            'notes': 'Provider-reported allowance, not a token cap. Shared account windows are not additive.',
        })
    credits = payload.get('credits') or {}
    resets = payload.get('rate_limit_reset_credits') or {}
    return {'windows': windows, 'controls': {
        'hasCredits': credits.get('has_credits') if type(credits.get('has_credits')) is bool else None,
        'unlimited': credits.get('unlimited') if type(credits.get('unlimited')) is bool else None,
        'balance': number(credits.get('balance')),
        'resetCredits': number(resets.get('available_count')),
        'spendLimit': None,  # Not provided by this endpoint. Never infer billing caps.
    }}


def read_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def credentials(home):
    auth = read_json(home / '.hermes/auth.json')
    tokens = auth.get('providers', {}).get('openai-codex', {}).get('tokens', {})
    # Do not select/switch pool accounts. A different pool credential makes the
    # singleton insufficient evidence for the active Hermes account.
    pool = auth.get('credential_pool', {}).get('openai-codex', [])
    ambiguous = any(e.get('access_token') != tokens.get('access_token') for e in pool if isinstance(e, dict))
    yield 'hermes', None if ambiguous else tokens.get('access_token'), None if ambiguous else tokens.get('account_id'), 'ambiguous-credential-pool' if ambiguous else None
    opencode = read_json(home / '.local/share/opencode/auth.json').get('openai', {})
    oauth = opencode.get('type') == 'oauth'
    yield 'opencode', opencode.get('access') if oauth else None, opencode.get('accountId') if oauth else None, None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward Authorization to a redirected host.


def fetch_usage(token, account_id):
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'User-Agent': 'codex-cli'}
    if account_id:
        headers['ChatGPT-Account-Id'] = account_id
    request = urllib.request.Request(USAGE_URL, headers=headers, method='GET')
    with urllib.request.build_opener(NoRedirect).open(request, timeout=12) as response:
        return json.loads(response.read(262144))


def collect(home, fetch=fetch_usage):
    now = datetime.now(timezone.utc).isoformat()
    result = {'version': 1, 'collectedAt': now, 'windows': [], 'coverage': []}
    cache = {}
    for harness, token, account_id, credential_error in credentials(home):
        alias = account_alias(account_id)
        identity = {'harness': harness, 'machine': 'server', 'provider': 'openai-codex', 'account': alias,
                    'identityEvidence': 'provider-account-id-sha256' if alias else None}
        coverage = {**identity, 'checkedAt': now, 'status': 'unavailable', 'reason': credential_error or 'missing-existing-oauth', 'controls': None}
        if token:
            # Query known shared accounts once. Unknown identities never coalesce.
            key = alias or harness
            if key not in cache:
                try:
                    cache[key] = (parse_usage(fetch(token, account_id), now), None)
                except urllib.error.HTTPError as error:
                    cache[key] = (None, f'usage-http-{error.code}')
                    error.close()
                except Exception:
                    cache[key] = (None, 'usage-unavailable-or-schema-changed')
            parsed, error = cache[key]
            if parsed:
                coverage.update(status='observed' if any(w['utilizationPct'] is not None for w in parsed['windows']) else 'unknown', reason=None, controls=parsed['controls'])
                result['windows'].extend({**w, **identity} for w in parsed['windows'])
            else:
                coverage['reason'] = error
        result['coverage'].append(coverage)
    # Discover provider metadata only. Never select message data or transcript text.
    db = home / '.local/share/opencode/opencode.db'
    if db.exists():
        try:
            with sqlite3.connect(db.as_uri() + '?mode=ro', uri=True, timeout=2) as connection:
                rows = connection.execute("SELECT DISTINCT json_extract(data, '$.providerID') FROM message WHERE json_extract(data, '$.role') = 'assistant'")
                providers = {r[0] for r in rows}
            for provider in sorted(providers & {'opencode', 'anthropic', 'google', 'openrouter'}):
                result['coverage'].append({'harness': 'opencode', 'machine': 'server', 'provider': provider,
                    'account': None, 'identityEvidence': None, 'checkedAt': now, 'status': 'unsupported',
                    'reason': 'Observed in local provider metadata; no authoritative quota source wired.', 'controls': None})
        except (sqlite3.Error, ValueError):
            result['coverage'].append({'harness': 'opencode', 'machine': 'server', 'provider': 'unknown',
                'account': None, 'checkedAt': now, 'status': 'unknown', 'reason': 'Provider metadata inventory unavailable.', 'controls': None})
    return result


def write_snapshot(destination, result):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=destination.parent, prefix='.quota-', delete=False) as stream:
        tmp = Path(stream.name)
        try:
            json.dump(result, stream, allow_nan=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
            os.replace(tmp, destination)
        finally:
            tmp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path.home() / '.local/state/bamware/server-quota.json')
    args = parser.parse_args()
    result = collect(Path.home())
    write_snapshot(args.output, result)
    # No tokens, provider responses, identifiers or exception strings in logs.
    print(json.dumps({'collector': 'server-quota', 'windows': len(result['windows']),
                      'coverage': [{k: c.get(k) for k in ('harness', 'provider', 'status', 'reason')} for c in result['coverage']]}))


if __name__ == '__main__':
    main()
