import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import claims

NOW = 1_800_000_000.0
HOUR = 3600


class ClaimsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / '.scrum-master.json'
        self.write({'version': 1, 'mandate': {'status': 'enabled'}, 'assignments': [], 'runs': []})

    def write(self, state):
        self.path.write_text(json.dumps(state))

    def state(self):
        return json.loads(self.path.read_text())

    def test_second_claim_fails_naming_holder_and_expiry(self):
        claims.claim(self.path, 'o/r#1', 'lead', 'plan', now=NOW)
        with self.assertRaises(claims.Refusal) as ctx:
            claims.claim(self.path, 'o/r#1', 'other', 'plan', now=NOW + 60)
        self.assertIn('lead', str(ctx.exception))
        self.assertIn(claims.iso(NOW + 12 * HOUR), str(ctx.exception))

    def test_same_holder_renews_and_bumps_revision(self):
        claims.claim(self.path, 'o/r#1', 'lead', 'plan', now=NOW)
        record = claims.claim(self.path, 'o/r#1', 'lead', 'implement', now=NOW + 60)
        self.assertEqual(record['revision'], 2)

    def test_expired_claim_can_be_taken_and_takeover_is_receipted(self):
        claims.claim(self.path, 'o/r#1', 'lead', 'plan', ttl_hours=1, now=NOW)
        record = claims.claim(self.path, 'o/r#1', 'other', 'implement', now=NOW + 2 * HOUR)
        self.assertEqual(record['claimant'], 'other')
        receipts = self.state()['claimReceipts']
        self.assertEqual([r['kind'] for r in receipts], ['takeover'])
        self.assertEqual((receipts[0]['previousClaimant'], receipts[0]['newClaimant']), ('lead', 'other'))

    def test_other_expired_claims_are_released_with_receipt(self):
        claims.claim(self.path, 'o/r#1', 'lead', 'plan', ttl_hours=1, now=NOW)
        claims.claim(self.path, 'o/r#2', 'other', 'plan', now=NOW + 2 * HOUR)
        state = self.state()
        self.assertNotIn('o/r#1', state['claims'])
        self.assertEqual(state['claimReceipts'][0]['kind'], 'expired')

    def test_release_needs_holder_unless_forced(self):
        claims.claim(self.path, 'o/r#1', 'lead', 'plan', now=NOW)
        with self.assertRaises(claims.Refusal):
            claims.release(self.path, 'o/r#1', 'other', now=NOW)
        claims.release(self.path, 'o/r#1', 'other', force=True, now=NOW)
        self.assertEqual(self.state()['claims'], {})
        self.assertTrue(self.state()['claimReceipts'][-1]['forced'])

    def test_second_batch_begin_fails_naming_owner(self):
        claims.batch_begin(self.path, 'lead', ['o/r#1'], now=NOW)
        with self.assertRaises(claims.Refusal) as ctx:
            claims.batch_begin(self.path, 'cos', ['o/r#2'], now=NOW)
        self.assertIn('lead', str(ctx.exception))
        self.assertIn('planning', str(ctx.exception))

    def test_batch_blocks_through_approved_and_launched_then_frees_on_finish(self):
        bid = claims.batch_begin(self.path, 'lead', ['o/r#1'], now=NOW)['batchId']
        for action in ('approve', 'launch'):
            claims.batch_move(self.path, action, bid, 'lead', now=NOW)
            with self.assertRaises(claims.Refusal):
                claims.batch_begin(self.path, 'cos', ['o/r#2'], now=NOW)
        claims.batch_move(self.path, 'finish', bid, 'lead', now=NOW)
        self.assertEqual(self.state()['claims'], {})       # batch claims released
        claims.batch_begin(self.path, 'cos', ['o/r#2'], now=NOW)

    def test_batch_begin_is_all_or_nothing_on_held_ticket(self):
        claims.claim(self.path, 'o/r#2', 'lead', 'plan', now=NOW)
        with self.assertRaises(claims.Refusal):
            claims.batch_begin(self.path, 'cos', ['o/r#1', 'o/r#2'], now=NOW)
        self.assertNotIn('o/r#1', self.state().get('claims', {}))
        self.assertNotIn('batches', self.state())

    def test_batch_moves_must_follow_order(self):
        bid = claims.batch_begin(self.path, 'lead', ['o/r#1'], now=NOW)['batchId']
        with self.assertRaises(claims.Refusal):
            claims.batch_move(self.path, 'launch', bid, 'lead')

    def test_paused_and_revoked_mandate_block_new_claims_and_batches(self):
        for status in ('paused', 'revoked'):
            self.write({'version': 1, 'mandate': {'status': status}, 'assignments': []})
            with self.assertRaisesRegex(claims.Refusal, status):
                claims.claim(self.path, 'o/r#1', 'lead', 'plan', now=NOW)
            with self.assertRaisesRegex(claims.Refusal, status):
                claims.batch_begin(self.path, 'lead', ['o/r#1'], now=NOW)

    def test_other_ledger_keys_survive_writes(self):
        self.write({'version': 1, 'mandate': {'status': 'enabled'}, 'assignments': [{'id': 'a'}], 'runs': [1]})
        claims.claim(self.path, 'o/r#1', 'lead', 'plan', now=NOW)
        state = self.state()
        self.assertEqual((state['assignments'], state['runs']), ([{'id': 'a'}], [1]))

    def test_missing_ledger_is_refused_not_created(self):
        missing = Path(self.tmp.name) / 'nope.json'
        with self.assertRaises(claims.Refusal):
            claims.claim(missing, 'o/r#1', 'lead', 'plan')
        self.assertFalse(missing.exists())

    def test_gate(self):
        bid = claims.batch_begin(self.path, 'lead', ['o/r#1'], now=NOW)['batchId']
        keys = [['t1', 'o/r#1']]
        with self.assertRaisesRegex(claims.Refusal, 'not approved'):
            claims.gate(self.path, bid, keys, now=NOW)
        claims.batch_move(self.path, 'approve', bid, 'lead', now=NOW)
        claims.gate(self.path, bid, keys, now=NOW)
        with self.assertRaisesRegex(claims.Refusal, 'not claimed'):
            claims.gate(self.path, bid, keys + [['o/r#9']], now=NOW)
        with self.assertRaisesRegex(claims.Refusal, 'not claimed'):
            claims.gate(self.path, bid, keys, now=NOW + 13 * HOUR)   # claim expired
        with self.assertRaisesRegex(claims.Refusal, 'batch_id'):
            claims.gate(self.path, None, keys)

    def test_cli_exit_codes_and_status_is_stable(self):
        script = str(Path(__file__).with_name('claims.py'))

        def run(*a):
            return subprocess.run([sys.executable, script, '--ledger', str(self.path), *a],
                                  capture_output=True, text=True)
        self.assertEqual(run('claim', 'o/r#1', '--by', 'lead', '--purpose', 'plan').returncode, 0)
        refused = run('claim', 'o/r#1', '--by', 'other', '--purpose', 'plan')
        self.assertEqual(refused.returncode, 1)
        self.assertIn('lead', refused.stderr)
        self.assertEqual(run('status', '--json').stdout, run('status', '--json').stdout)
        self.assertEqual(json.loads(run('status', '--json').stdout)['claims'][0]['claimant'], 'lead')
        self.assertIn('claim: o/r#1 -> lead', run('status').stdout)


if __name__ == '__main__':
    unittest.main()
