import json
from pathlib import Path
import sys
import tempfile
import unittest
import runner


class RunnerTests(unittest.TestCase):
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
