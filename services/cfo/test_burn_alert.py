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

    def feed(self, observations, now=None, error=None, verifier=None):
        now = now if now is not None else max(o['observed_at'] for o in observations)
        return ba.run(self.dir, {'test': lambda: (observations, error)}, self.sender, now, verifier=verifier)


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


    # --- self-verification ---------------------------------------------------

    def test_forecasts_are_graded_against_later_readings(self):
        h = Harness()
        for i in range(19):                     # steady 3 %/h for 3 h, 10-min samples
            h.feed([obs(T0 + i * 600, 10 + i * 0.5)])
        calibration = ba.load_state(h.dir)['calibration']['pool']
        self.assertGreaterEqual(len(calibration), 3)
        self.assertTrue(all(abs(c['error']) < 0.01 for c in calibration))   # linear burn, exact forecasts
        self.assertEqual(ba.rate_factor(calibration), 1.0)

    def test_under_prediction_learns_a_bounded_correction(self):
        calibration = [{'base': 10, 'predicted': 13, 'actual': 16, 'error': 3}] * 8   # burn ran 2x forecast
        self.assertAlmostEqual(ba.rate_factor(calibration), 2.0)
        worse = [{'base': 10, 'predicted': 11, 'actual': 20, 'error': 9}] * 8          # 9x: clamped
        self.assertEqual(ba.rate_factor(worse), 2.0)
        too_few = [{'base': 10, 'predicted': 13, 'actual': 16, 'error': 3}] * 3
        self.assertEqual(ba.rate_factor(too_few), 1.0)

    def test_over_prediction_never_delays_alerts(self):
        calibration = [{'base': 10, 'predicted': 16, 'actual': 12, 'error': -4}] * 8
        self.assertEqual(ba.rate_factor(calibration), 1.0)

    def test_learned_correction_makes_the_alert_earlier(self):
        reset = T0 + 30 * 3600
        window = {'samples': [[T0, 50.0], [T0 + 3600, 51.0]], 'reset_at': reset}   # 1 %/h
        plain = ba.assess(window, T0 + 3600)
        corrected = ba.assess(window, T0 + 3600, factor=2.0)
        self.assertEqual(plain['level'], 'ok')          # reserve in 34 h: beyond 24 h horizon
        self.assertEqual(corrected['level'], 'warn')    # 2 %/h: reserve in 17 h, before reset

    def test_alert_reports_its_own_accuracy_once_calibrated(self):
        h = Harness()
        state = ba.load_state(h.dir)
        state['calibration'] = {'pool': [{'made_at': 0, 'target_at': 0, 'base': 10, 'predicted': 12,
                                          'actual': 13, 'error': 1.0}] * 6}
        ba.save_state(h.dir, state)
        h.feed([obs(T0, 96)])
        self.assertIn('Self-check: last 6 one-hour forecasts', h.sent[0])

    def test_crosscheck_disagreement_raises_alert(self):
        h = Harness()
        key = 'openai-codex:acct:primary-10080min'
        reading = {'source': 'codex-session-log', 'window_min': WEEK, 'used_pct': 70.0, 'reset_at': RESET, 'observed_at': T0 + 120}
        h.feed([obs(T0, 40, key=key)], now=T0 + 120, verifier=lambda: reading)
        self.assertTrue(any('self-check failed' in s for s in h.sent))
        self.assertEqual(ba.load_state(h.dir)['crosschecks'][-1]['diff'], 30.0)

    def test_crosscheck_agreement_and_time_gaps_stay_quiet(self):
        h = Harness()
        key = 'openai-codex:acct:primary-10080min'
        agree = {'window_min': WEEK, 'used_pct': 41.0, 'reset_at': RESET, 'observed_at': T0 + 60}
        h.feed([obs(T0, 40, key=key)], now=T0 + 60, verifier=lambda: agree)
        far = {'window_min': WEEK, 'used_pct': 90.0, 'reset_at': RESET, 'observed_at': T0 + 3 * 3600}
        h.feed([obs(T0 + 600, 40, key=key)], now=T0 + 700, verifier=lambda: far)
        self.assertEqual(h.sent, [])

    def test_codex_log_verifier_reads_rate_limits(self):
        home = Path(tempfile.mkdtemp())
        log = home / '.codex/sessions/2026/10/03/rollout-x.jsonl'
        log.parent.mkdir(parents=True)
        log.write_text(json.dumps({'timestamp': '2026-10-03T04:00:00Z', 'type': 'event_msg', 'payload': {
            'type': 'token_count', 'rate_limits': {'primary': {'used_percent': 95.0, 'window_minutes': 10080,
                                                                'resets_at': 1791580666}}}}) + '\n')
        reading = ba.codex_log_verifier(home)
        self.assertEqual((reading['used_pct'], reading['window_min']), (95.0, 10080.0))


    # --- Claude Max ------------------------------------------------------------

    def _claude_file(self, samples):
        path = Path(tempfile.mkdtemp()) / 'ai-quota-samples.jsonl'
        path.write_text(''.join(json.dumps(x) + '\n' for x in samples))
        return path

    def test_claude_source_reads_all_three_meters(self):
        at = '2026-10-03T05:40:00Z'
        path = self._claude_file([{'at': at, 'meters': [
            {'kind': 'session', 'percent': 42, 'resetsAt': '2026-10-03T08:00:00Z', 'tokensInWindow': 1},
            {'kind': 'weekly', 'percent': 63, 'resetsAt': '2026-10-10T01:59:00Z', 'tokensInWindow': 1},
            {'kind': 'weekly-fable', 'percent': 30, 'resetsAt': '2026-10-10T01:59:00Z', 'tokensInWindow': 1},
            {'kind': 'unknown-meter', 'percent': 99}]}])
        observations, error = ba.claude_source(path, now=ba.epoch(at) + 60)
        self.assertIsNone(error)
        self.assertEqual({o['key']: (o['used_pct'], o['window_min']) for o in observations}, {
            'claude-max:session': (42.0, 300.0), 'claude-max:weekly': (63.0, 10080.0),
            'claude-max:weekly-fable': (30.0, 10080.0)})

    def test_claude_source_flags_a_stopped_sampler(self):
        at = '2026-10-03T05:00:00Z'
        path = self._claude_file([{'at': at, 'meters': [{'kind': 'weekly', 'percent': 50, 'resetsAt': None}]}])
        _, error = ba.claude_source(path, now=ba.epoch(at) + 3600)
        self.assertIn('stale', error)
        _, missing = ba.claude_source(Path(tempfile.mkdtemp()) / 'none.jsonl')
        self.assertIn('unreadable', missing)

    def test_stale_claude_data_raises_monitoring_alert(self):
        h = Harness()
        fresh = obs(T0, 50, key='claude-max:weekly')
        h.feed([fresh])                                            # fresh: no error
        h.feed([fresh], now=T0 + 45 * 60, error='claude samples stale')
        self.assertTrue(any('monitoring stale' in s for s in h.sent))

    def test_session_window_rollover_resets_the_trend(self):
        h = Harness()
        first_reset, next_reset = T0 + 3600, T0 + 6 * 3600
        h.feed([obs(T0, 97, key='claude-max:session', reset_at=first_reset, window_min=300)])
        h.feed([obs(T0 + 2 * 3600, 3, key='claude-max:session', reset_at=next_reset, window_min=300)])
        state = ba.load_state(h.dir)
        self.assertEqual(len(state['windows']['claude-max:session']['samples']), 1)
        self.assertNotIn('claude-max:session', state['alerts'])
        self.assertEqual(len(h.sent), 1)


    def test_capacity_is_published_for_every_pool_worst_first(self):
        h = Harness()
        h.feed([obs(T0, 30, key='calm'), obs(T0, 96, key='hot')])
        doc = json.loads((h.dir / 'capacity.json').read_text())
        self.assertEqual([p['key'] for p in doc['pools']], ['hot', 'calm'])
        self.assertEqual((doc['pools'][0]['level'], doc['pools'][0]['sent_level']), ('critical', 'critical'))
        self.assertEqual(doc['pools'][1]['level'], 'ok')
        self.assertEqual(doc['policy']['reserve_used_pct'], 85.0)
        self.assertIn('test', doc['sources'])


if __name__ == '__main__':
    unittest.main()
