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
        return {'id': name, 'title': f'Test task {name}', 'approved': True, 'cwd': str(root),
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


    def test_tasks_must_say_what_they_are(self):
        with tempfile.TemporaryDirectory() as tmp:
            task = self.task(Path(tmp), 't115', 'pass')
            del task['title']
            with self.assertRaisesRegex(ValueError, 'ticket .* or a plain-words title'):
                runner.validate({'schema': 1, 'unresolved_decisions': [], 'tasks': [task]})
            task['ticket'] = 'mrbam88/bamware-ai#115'
            runner.validate({'schema': 1, 'unresolved_decisions': [], 'tasks': [task]})

    def ledger_with_task(self, tmp):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scrum-master'))
        import claims
        ledger = Path(tmp) / '.scrum-master.json'
        ledger.write_text(json.dumps({'version': 1, 'mandate': {'status': 'enabled'}}))
        task = self.task(Path(tmp), 't1', 'pass')
        task['ticket'] = 'o/r#1'
        return claims, ledger, task

    def assert_start_refused(self, tmp, ledger, batch):
        from unittest import mock
        manifest = Path(tmp) / 'batch.json'
        manifest.write_text(json.dumps(batch))
        with mock.patch('subprocess.Popen') as popen, mock.patch('subprocess.run') as run, \
                mock.patch('subprocess.check_output') as out, mock.patch.object(runner, 'preflight') as pre:
            with self.assertRaisesRegex(ValueError, 'claims gate'):
                runner.launch(str(manifest), str(Path(tmp) / 'state'), str(ledger))
            for fake in (popen, run, out, pre):
                fake.assert_not_called()   # no child process and no preflight

    def test_start_refuses_unapproved_batch_before_any_child_process(self):
        with tempfile.TemporaryDirectory() as tmp:
            claims, ledger, task = self.ledger_with_task(tmp)
            bid = claims.batch_begin(ledger, 'lead', ['o/r#1'])['batchId']
            self.assert_start_refused(tmp, ledger, {'schema': 1, 'unresolved_decisions': [], 'batch_id': bid, 'tasks': [task]})

    def test_start_refuses_missing_batch_id_and_unclaimed_task(self):
        with tempfile.TemporaryDirectory() as tmp:
            claims, ledger, task = self.ledger_with_task(tmp)
            self.assert_start_refused(tmp, ledger, {'schema': 1, 'unresolved_decisions': [], 'tasks': [task]})
            bid = claims.batch_begin(ledger, 'lead', ['o/r#1'])['batchId']
            claims.batch_move(ledger, 'approve', bid, 'lead')
            other = dict(task, id='t2', ticket='o/r#2')
            self.assert_start_refused(tmp, ledger, {'schema': 1, 'unresolved_decisions': [], 'batch_id': bid, 'tasks': [task, other]})

    def test_gate_passes_when_approved_and_claimed(self):
        with tempfile.TemporaryDirectory() as tmp:
            claims, ledger, task = self.ledger_with_task(tmp)
            bid = claims.batch_begin(ledger, 'lead', ['o/r#1'])['batchId']
            claims.batch_move(ledger, 'approve', bid, 'lead')
            runner.check_claims({'batch_id': bid, 'tasks': [task]}, str(ledger))   # no raise

    def test_worker_finishes_the_ledger_batch(self):
        import os
        with tempfile.TemporaryDirectory() as tmp:
            claims, ledger, task = self.ledger_with_task(tmp)
            os.environ['BAMWARE_LEDGER'] = str(ledger)
            self.addCleanup(os.environ.pop, 'BAMWARE_LEDGER', None)
            bid = claims.batch_begin(ledger, 'lead', ['o/r#1'])['batchId']
            for action in ('approve', 'launch'):
                claims.batch_move(ledger, action, bid, 'lead')
            root = Path(tmp) / 'run'
            root.mkdir()
            runner.write(root / 'batch.json', {'schema': 1, 'unresolved_decisions': [], 'batch_id': bid,
                                               'tasks': [dict(task, cwd=str(root))]})
            runner.worker(root)
            self.assertIsNone(claims.status(ledger)['batch'])


if __name__ == '__main__':
    unittest.main()
