import json
from pathlib import Path
import sys
import tempfile
import unittest
import runner


class RunnerTests(unittest.TestCase):
    def setUp(self):
        import os
        self._meter = os.environ.get('BAMWARE_METER')
        os.environ['BAMWARE_METER'] = 'off'   # unit tests never touch real quota sources

    def tearDown(self):
        import os
        if self._meter is None:
            os.environ.pop('BAMWARE_METER', None)
        else:
            os.environ['BAMWARE_METER'] = self._meter

    def test_each_task_gets_a_cost_record_from_the_meter(self):
        import os
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'run'
            root.mkdir()
            fake = Path(tmp) / 'meter.py'
            fake.write_text(
                "import json, sys\n"
                "if sys.argv[1] == 'snapshot':\n"
                "    print(json.dumps({'at': 1, 'pools': {'p': {'used_pct': 10, 'reset_at': 9}}}))\n"
                "else:\n"
                "    entry = json.load(sys.stdin)\n"
                "    print(json.dumps({'ticket': entry['ticket'], 'state': entry['state'], 'pools': {'p': {'delta_pct': 0.0}}}))\n")
            os.environ['BAMWARE_METER'] = str(fake)
            task = self.task(root, 'one', 'pass')
            task['ticket'] = 'mrbam88/bamware-ai#107'
            batch = {'schema': 1, 'unresolved_decisions': [], 'tasks': [task]}
            runner.preflight(batch, root)
            runner.write(root / 'batch.json', batch)
            runner.worker(root)
            cost = runner.read(root / 'status.json')['tasks'][0]['cost']
            self.assertEqual((cost['ticket'], cost['state']), ('mrbam88/bamware-ai#107', 'verified'))

    def test_broken_meter_never_blocks_a_task(self):
        import os
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'run'
            root.mkdir()
            broken = Path(tmp) / 'meter.py'
            broken.write_text('raise SystemExit(3)\n')
            os.environ['BAMWARE_METER'] = str(broken)
            batch = {'schema': 1, 'unresolved_decisions': [], 'tasks': [self.task(root, 'one', 'pass')]}
            runner.preflight(batch, root)
            runner.write(root / 'batch.json', batch)
            runner.worker(root)
            task = runner.read(root / 'status.json')['tasks'][0]
            self.assertEqual(task['state'], 'verified')
            self.assertEqual(task['cost']['attribution'], 'unmetered')

    def task(self, root, name, code, dependencies=None):
        return {'id': name, 'approved': True, 'cwd': str(root),
                'argv': [sys.executable, '-c', code], 'timeout_seconds': 1,
                'preflight': [[sys.executable, '-c', 'pass']],
                'verify': [[sys.executable, '-c', 'pass']],
                'depends_on': dependencies or []}

    def test_stall_and_failure_do_not_stop_independent_tasks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'run'
            root.mkdir()
            tasks = [self.task(root, 'stuck', 'import time; time.sleep(10)'),
                     self.task(root, 'failure', 'raise SystemExit(2)'),
                     self.task(root, 'dependent', 'pass', ['stuck']),
                     self.task(root, 'healthy', "from pathlib import Path; Path('proof').write_text('ok')")]
            tasks[-1]['verify'] = [[sys.executable, '-c', "from pathlib import Path; assert Path('proof').read_text() == 'ok'"]]
            batch = {'schema': 1, 'unresolved_decisions': [], 'tasks': tasks}
            runner.preflight(batch, root)
            runner.write(root / 'batch.json', batch)
            runner.worker(root)
            state = runner.read(root / 'status.json')
            self.assertEqual([t['state'] for t in state['tasks']],
                             ['timed_out', 'failed', 'blocked_dependency', 'verified'])
            self.assertTrue((root / 'pickup.json').exists())
            self.assertEqual(state['phase'], 'finished')

    def test_failed_preflight_blocks_entire_launch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            task = self.task(root, 'one', 'pass')
            task['preflight'] = [[sys.executable, '-c', 'raise SystemExit(1)']]
            with self.assertRaisesRegex(ValueError, 'preflight failed'):
                runner.preflight({'schema': 1, 'unresolved_decisions': [], 'tasks': [task]}, root)
            self.assertFalse((root / 'pickup.json').exists())

    def test_unresolved_permissions_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            task = self.task(Path(tmp), 'one', 'pass')
            task['approved'] = False
            with self.assertRaisesRegex(ValueError, 'not approved'):
                runner.validate({'schema': 1, 'unresolved_decisions': [], 'tasks': [task]})

    def test_zero_exit_is_not_completion_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'run'
            root.mkdir()
            task = self.task(root, 'one', 'pass')
            task['verify'] = [[sys.executable, '-c', 'raise SystemExit(1)']]
            runner.write(root / 'batch.json', {'schema': 1, 'unresolved_decisions': [], 'tasks': [task]})
            runner.worker(root)
            self.assertEqual(runner.read(root / 'status.json')['tasks'][0]['state'], 'verification_failed')


if __name__ == '__main__':
    unittest.main()
