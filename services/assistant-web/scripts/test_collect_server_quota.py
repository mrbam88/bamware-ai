import importlib.util
import unittest
import json
import tempfile
import urllib.error
from email.message import Message
from pathlib import Path
spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collect-server-quota.py'))
assert spec and spec.loader
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

class QuotaTests(unittest.TestCase):
    def home(self, path, second_account='account-a'):
        (path / '.hermes').mkdir()
        (path / '.local/share/opencode').mkdir(parents=True)
        (path / '.hermes/auth.json').write_text(json.dumps({'providers': {'openai-codex': {'tokens': {'access_token': 'fake-secret', 'account_id': 'account-a'}}}, 'credential_pool': {'openai-codex': [{'access_token': 'fake-secret'}]}}))
        (path / '.local/share/opencode/auth.json').write_text(json.dumps({'openai': {'type': 'oauth', 'access': 'fake-secret-two', 'accountId': second_account}}))

    def test_shared_account_fetches_once_and_credentials_are_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            self.home(home)
            before = {p: p.read_bytes() for p in home.rglob('auth.json')}
            calls = []
            def fetch(token, account):
                calls.append(1)
                return {'rate_limit': {'primary_window': {'used_percent': 40}}}
            result = c.collect(home, fetch)
            self.assertEqual(len(calls), 1)
            self.assertEqual([r['status'] for r in result['coverage']], ['observed', 'observed'])
            self.assertNotIn('fake-secret', json.dumps(result))
            self.assertNotIn('account-a', json.dumps(result))
            for path, content in before.items(): self.assertEqual(path.read_bytes(), content)

    def test_different_accounts_do_not_share_requests(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            self.home(home, 'account-b')
            calls = []
            c.collect(home, lambda *args: calls.append(1) or {})
            self.assertEqual(len(calls), 2)

    def test_failure_exports_only_status_not_exception_body_and_does_not_retry(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            self.home(home)
            calls = []
            def fail(*args):
                calls.append(1)
                raise urllib.error.HTTPError('https://example.invalid', 401, 'secret-body', Message(), None)
            result = c.collect(home, fail)
            self.assertEqual(len(calls), 1)
            self.assertEqual(result['windows'], [])
            self.assertEqual(result['coverage'][0]['reason'], 'usage-http-401')
            self.assertNotIn('secret-body', json.dumps(result))

    def test_missing_credentials_and_ambiguous_pool_remain_unknown(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            missing = c.collect(home, lambda *args: self.fail('must not fetch'))
            self.assertEqual(missing['windows'], [])
            self.home(home)
            path = home / '.hermes/auth.json'
            auth = json.loads(path.read_text())
            auth['credential_pool']['openai-codex'].append({'access_token': 'different'})
            path.write_text(json.dumps(auth))
            result = c.collect(home, lambda *args: {})
            self.assertEqual(result['coverage'][0]['reason'], 'ambiguous-credential-pool')
            self.assertIsNone(result['coverage'][0]['account'])

    def test_atomic_snapshot_is_private(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'snapshot.json'
            c.write_snapshot(path, {'windows': []})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(path.read_text()), {'windows': []})

    def test_allowlist_and_missing_values(self):
        payload = {'rate_limit': {'primary_window': {'used_percent': 34, 'limit_window_seconds': 300*60, 'reset_at': 1790969400}, 'secondary_window': {'used_percent': None}}, 'credits': {'has_credits': False}, 'email': 'never-export', 'access_token': 'never-export'}
        result = c.parse_usage(payload, '2026-10-02T19:00:00Z')
        self.assertEqual(result['windows'][0]['scope'], 'primary-300min')
        self.assertEqual(result['windows'][0]['utilizationPct'], 34)
        self.assertIsNone(result['windows'][1]['utilizationPct'])
        self.assertIsNone(result['controls']['balance'])
        self.assertFalse(result['controls']['hasCredits'])
        self.assertNotIn('never-export', str(result))

    def test_invalid_percentage_never_becomes_zero(self):
        for value in (None, True, '40', -1, float('nan')):
            result = c.parse_usage({'rate_limit': {'primary_window': {'used_percent': value}}}, '2026-10-02T19:00:00Z')
            self.assertIsNone(result['windows'][0]['utilizationPct'])

    def test_identity_alias_is_scoped_and_missing_stays_unknown(self):
        self.assertIsNone(c.account_alias(None))
        self.assertEqual(c.account_alias('account-a'), c.account_alias('account-a'))
        self.assertNotEqual(c.account_alias('account-a'), c.account_alias('account-b'))
        self.assertNotIn('account-a', c.account_alias('account-a'))

if __name__ == '__main__': unittest.main()
