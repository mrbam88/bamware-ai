import json
from pathlib import Path
import tempfile
import unittest

import burn_alert as ba

T0 = 1790990400
WEEK = 10080
RESET = T0 + int(6.7 * 86400)


def obs(t, used, key='pool', reset_at=RESET, window_min=WEEK):
    return {'key': key, 'label': 'Test pool', 'used_pct': used, 'window_min': window_min,
            'reset_at': reset_at, 'observed_at': t}


class Harness:
    def __init__(self, fail_sends=0):
        self.dir = Path(tempfile.mkdtemp())
        self.sent, self.fail_sends = [], fail_sends

    def sender(self, text):
        if self.fail_sends:
            self.fail_sends -= 1
            raise RuntimeError('discord down')
        self.sent.append(text)
        return True

    def feed(self, observations, now=None, error=None):
        now = now if now is not None else max(o['observed_at'] for o in observations)
        return ba.run(self.dir, {'test': lambda: (observations, error)}, self.sender, now)


class BurnAlertTests(unittest.TestCase):
    def test_stable_consumption_does_not_alert(self):
        h = Harness()
        for i in range(12):  # 0.5 %/h, plenty of week left
            h.feed([obs(T0 + i * 600, 30 + i * 0.08)])
        self.assertEqual(h.sent, [])

    def test_incident_spike_alerts_during_rise_before_low_stage(self):
        h = Harness()
        fixture = json.loads((Path(__file__).parent / 'fixtures/incident-101.json').read_text())
        first = None
        for s in fixture['samples']:
            h.feed([obs(s['t'], s['used_pct'], reset_at=fixture['reset_at'])])
            if h.sent and first is None:
                first = s
        self.assertIsNotNone(first)
        self.assertLess(first['used_pct'], 70)          # well before the 92% stage
        self.assertGreater(fixture['samples'][-1]['t'] - first['t'], 60 * 60)  # >1h lead time
        self.assertEqual(len(h.sent), 1)                # critical once, no flood

    def test_sparse_single_sample_uses_thresholds_only(self):
        h = Harness()
        h.feed([obs(T0, 60)])
        self.assertEqual(h.sent, [])                    # no rate yet, under thresholds
        h2 = Harness()
        h2.feed([obs(T0, 96)])
        self.assertIn('critical', h2.sent[0])

    def test_steady_pace_that_hits_reserve_before_reset_warns(self):
        h = Harness()
        reset = T0 + 30 * 3600
        for i in range(7):                              # 1.5 %/h from 55%: reserve in ~19h, reset in ~30h
            h.feed([obs(T0 + i * 600, 55 + i * 0.25, reset_at=reset)])
        self.assertEqual(len(h.sent), 1)
        self.assertIn('(warn)', h.sent[0])

    def test_stale_source_raises_monitoring_alert(self):
        h = Harness()
        h.feed([obs(T0, 40)])
        h.feed([], now=T0 + 45 * 60, error='snapshot unreadable')
        self.assertTrue(any('monitoring stale' in s for s in h.sent))

    def test_reset_rollover_starts_new_trend(self):
        h = Harness()
        h.feed([obs(T0, 96)])
        self.assertEqual(len(h.sent), 1)
        new_reset = RESET + 7 * 86400
        h.feed([obs(T0 + 600, 2, reset_at=new_reset)])
        window = ba.load_state(h.dir)['windows']['pool']
        self.assertEqual(len(window['samples']), 1)
        self.assertNotIn('pool', ba.load_state(h.dir)['alerts'])
        h.feed([obs(T0 + 1200, 97, reset_at=new_reset)])
        self.assertEqual(len(h.sent), 2)                # new window, new alert

    def test_shared_account_duplicate_samples_ignored(self):
        h = Harness()
        same = obs(T0, 40)
        h.feed([same, dict(same)])
        self.assertEqual(len(ba.load_state(h.dir)['windows']['pool']['samples']), 1)

    def test_out_of_order_observations_are_sorted(self):
        h = Harness()
        h.feed([obs(T0 + 1200, 50), obs(T0, 40), obs(T0 + 600, 45)], now=T0 + 1200)
        samples = ba.load_state(h.dir)['windows']['pool']['samples']
        self.assertEqual([s[1] for s in samples], [40, 45, 50])

    def test_restart_does_not_resend(self):
        h = Harness()
        h.feed([obs(T0, 96)])
        restarted = Harness()
        restarted.dir = h.dir                           # same persisted state, new process
        restarted.feed([obs(T0 + 600, 96.5)])
        self.assertEqual(len(h.sent) + len(restarted.sent), 1)

    def test_discord_failure_retries_then_delivers_once(self):
        h = Harness(fail_sends=2)
        h.feed([obs(T0, 96)])
        h.feed([obs(T0 + 600, 96)])
        self.assertEqual(h.sent, [])
        h.feed([obs(T0 + 1200, 96)])
        self.assertEqual(len(h.sent), 1)
        log = [json.loads(l) for l in (h.dir / 'alerts.jsonl').read_text().splitlines()]
        self.assertEqual([e['delivered'] for e in log], [False, False, True])

    def test_delivery_retries_are_bounded(self):
        h = Harness(fail_sends=99)
        outcomes = [h.feed([obs(T0 + i * 600, 96)])[0][1] for i in range(7)]
        self.assertEqual(outcomes[:5], ['failed'] * 4 + ['exhausted'])
        self.assertEqual(outcomes[5:], ['exhausted', 'exhausted'])

    def test_escalation_warn_then_critical_without_duplicates(self):
        h = Harness()
        h.feed([obs(T0, 81)])
        h.feed([obs(T0 + 600, 82)])
        h.feed([obs(T0 + 1200, 96)])
        h.feed([obs(T0 + 1800, 97)])
        self.assertEqual(len(h.sent), 2)
        self.assertIn('(warn)', h.sent[0])
        self.assertIn('(critical)', h.sent[1])

    def test_openai_snapshot_parsing_and_account_dedupe(self):
        tmp = Path(tempfile.mkdtemp()) / 'server-quota.json'
        window = {'provider': 'openai-codex', 'scope': 'primary-10080min', 'utilizationPct': 95.0,
                  'resetAt': '2026-10-09T21:17:46+00:00', 'source': {'fetchedAt': '2026-10-03T04:00:00+00:00'},
                  'account': 'acct-abc'}
        tmp.write_text(json.dumps({'collectedAt': '2026-10-03T04:00:00+00:00',
                                   'windows': [{**window, 'harness': 'hermes'}, {**window, 'harness': 'codex'}]}))
        observations, error = ba.openai_source(tmp)
        self.assertIsNone(error)
        self.assertEqual({o['key'] for o in observations}, {'openai-codex:acct-abc:primary-10080min'})
        self.assertEqual(observations[0]['window_min'], 10080)

    def test_copilot_source_reads_premium_quota(self):
        class Out:
            returncode = 0
            stdout = json.dumps({'quota_reset_date_utc': '2026-11-01T00:00:00.000Z', 'quota_snapshots': {
                'premium_interactions': {'percent_remaining': 88.0, 'unlimited': False}}})
        observations, error = ba.copilot_source(run=lambda *a, **k: Out(), now=T0)
        self.assertIsNone(error)
        self.assertEqual(observations[0]['used_pct'], 12.0)


if __name__ == '__main__':
    unittest.main()
