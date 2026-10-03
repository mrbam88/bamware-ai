"""Export allowlisted local run metrics; never copy prompts/results/tool arguments."""
import json
import os
from pathlib import Path
from datetime import datetime, timezone

root = Path.home() / 'srv/overnight-mode/batch-work'
out = Path.home() / '.local/state/bamware/overnight/usage.json'
events = []
for task in ('75', '76', '78', 'qa'):
    file = root / (task + '.result.json')
    if not file.exists():
        continue
    d = json.loads(file.read_text())
    models = d.get('modelUsage', {})
    if not models:
        continue
    def total(key):
        values = [m.get(key) for m in models.values()]
        return sum(values) if all(isinstance(v, (int, float)) for v in values) else None
    cache = d.get('usage', {}).get('cache_creation', {})
    five, hour = cache.get('ephemeral_5m_input_tokens'), cache.get('ephemeral_1h_input_tokens')
    if five is None or hour is None or five + hour != total('cacheCreationInputTokens'):
        five = hour = None
    ended = datetime.fromtimestamp(file.stat().st_mtime, timezone.utc).isoformat()
    session = d.get('session_id')
    events.append({'id': 'overnight:' + str(session), 'project': 'Bamware Assistant', 'repo': 'mrbam88/bamware-ai',
      'ticket': None if task == 'qa' else 'mrbam88/bamware-ai#' + task,
      'batch': '2026-10-02', 'task': {'id': task, 'title': 'Batch QA' if task == 'qa' else 'Overnight #' + task},
      'attempt': {'id': session, 'kind': 'qa' if task == 'qa' else 'implementation', 'number': 1},
      'agent': {'provider': 'anthropic', 'model': ' + '.join(models), 'sessionId': session,
                'machine': {'id': 'intel-server-MacBookPro16,4', 'hostname': 'omarchy', 'source': 'configured'}},
      'trace': {'pr': 'https://github.com/mrbam88/bamware-ai/pull/80'},
      'usage': {'input': total('inputTokens'), 'output': total('outputTokens'), 'cacheRead': total('cacheReadInputTokens'),
                'cacheWrite5m': five, 'cacheWrite1h': hour},
      'timing': {'activeMs': None, 'waitMs': None, 'endedAt': ended},
      'outcome': {'state': 'unverified', 'verified': False,
                  'notes': 'Runtime elapsed (including waits): ' + str(d.get('duration_ms')) + ' ms. Independent QA was partial; elapsed time is not active-work time.'},
      'cost': {'kind': 'estimated', 'amountUsd': total('costUSD'), 'pricingSource': 'Claude CLI modelUsage list-price estimate; not a subscription charge', 'pricingVersion': ended},
      'source': {'kind': 'live', 'label': 'Recorded overnight run metadata (includes helper models)', 'fetchedAt': ended}})
out.parent.mkdir(parents=True, exist_ok=True)
tmp = out.with_suffix('.tmp')
tmp.write_text(json.dumps({'version': 1, 'events': events}))
tmp.chmod(0o600)
tmp.replace(out)
print('Exported metadata for', len(events), 'recorded runs; no conversation content exported.')
