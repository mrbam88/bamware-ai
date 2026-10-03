import json
from pathlib import Path
import tempfile
import unittest

import meter

RESET = 1791580666


def reading(used, reset_at=RESET, sessions=0, key='claude-max:weekly'):
    return {'at': 1, 'pools': {key: {'label': 'Claude Max weekly', 'used_pct': used, 'reset_at': reset_at,
                                     'observed_at': 1}}, 'errors': {}, 'other_claude_sessions': sessions}


class MeterTests(unittest.TestCase):
    def test_clean_delta_is_the_task_cost(self):
        result = meter.cost(reading(40.0), reading(43.5))
        self.assertEqual(result['pools']['claude-max:weekly']['delta_pct'], 3.5)
        self.assertEqual(result['attribution'], 'exclusive')

    def test_rollover_makes_cost_unknown_not_negative(self):
        result = meter.cost(reading(97.0), reading(2.0, reset_at=RESET + 7 * 86400))
        self.assertIsNone(result['pools']['claude-max:weekly']['delta_pct'])
        dropped = meter.cost(reading(50.0), reading(10.0))
        self.assertIsNone(dropped['pools']['claude-max:weekly']['delta_pct'])

    def test_tiny_rounding_dip_counts_as_zero(self):
        result = meter.cost(reading(50.0), reading(49.8))
        self.assertEqual(result['pools']['claude-max:weekly']['delta_pct'], 0.0)

    def test_missing_after_reading_is_reported(self):
        after = {'at': 2, 'pools': {}, 'errors': {'claude-max': 'stale'}, 'other_claude_sessions': 0}
        result = meter.cost(reading(40.0), after)
        self.assertIsNone(result['pools']['claude-max:weekly']['delta_pct'])

    def test_other_claude_sessions_mark_attribution_shared(self):
        self.assertEqual(meter.cost(reading(40, sessions=1), reading(42))['attribution'], 'shared')
        self.assertEqual(meter.cost(reading(40, sessions=None), reading(42))['attribution'], 'unknown')

    def test_snapshot_keeps_the_newest_reading_per_pool(self):
        old = {'key': 'k', 'label': 'L', 'used_pct': 10, 'reset_at': RESET, 'observed_at': 100}
        new = {**old, 'used_pct': 12, 'observed_at': 200}
        snap = meter.snapshot(sources={'s': lambda: ([new, old], None)}, refresher=lambda: {},
                              sessions=lambda: 0)
        self.assertEqual(snap['pools']['k']['used_pct'], 12)

    def test_snapshot_reports_source_and_refresh_errors(self):
        snap = meter.snapshot(sources={'s': lambda: ([], 'unreadable')},
                              refresher=lambda: {'claude-max': 'refresh exit 2'}, sessions=lambda: 0)
        self.assertEqual(snap['errors'], {'claude-max': 'refresh exit 2', 's': 'unreadable'})

    def test_record_and_summary(self):
        ledger = Path(tempfile.mkdtemp()) / 'costs.jsonl'
        for ticket, before, after in [('a#1', 40, 43), ('a#2', 43, 44.5)]:
            b, a = reading(before), reading(after)
            b['at'], a['at'] = 1790990000, 1790990600
            meter.record({'batch': 'b', 'task': ticket, 'ticket': ticket, 'state': 'verified',
                          'before': b, 'after': a}, ledger)
        report = meter.summary(ledger, days=7, now=1790990600 + 60)
        self.assertEqual([r['ticket'] for r in report['tasks']], ['a#1', 'a#2'])
        (day, pools), = report['per_day'].items()
        self.assertAlmostEqual(pools['claude-max:weekly'], 4.5)
        self.assertEqual(json.loads(ledger.read_text().splitlines()[0])['attribution'], 'exclusive')


if __name__ == '__main__':
    unittest.main()
