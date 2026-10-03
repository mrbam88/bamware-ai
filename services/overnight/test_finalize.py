import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('overnight_finalize', Path(__file__).with_name('finalize.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class FinalizeTests(unittest.TestCase):
    def exercise(self, approval, fail=None, qa_exit=1):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'qa.evidence.json').write_text(json.dumps({'status': 'partial', 'approved_for_publish': approval}))
            for task in ('75', '76', '78'):
                (root / f'{task}.evidence.json').write_text(json.dumps({'status': 'implemented', 'limitations': ['Browser check unavailable']}))
            calls = []
            def command(argv, **kwargs):
                calls.append(argv)
                rc = 1 if fail and argv[:len(fail)] == fail else 0
                return subprocess.CompletedProcess(argv, rc, 'https://example.test/receipt', '')
            with patch.object(m, 'ARTIFACTS', root), patch.object(m, 'run', command), patch('builtins.print'):
                result = m.finalize(qa_exit)
            report = (root / 'report.md').read_text()
            return result, calls, report

    def test_permission_denial_exit_does_not_hide_publish_approved_code(self):
        result, calls, report = self.exercise(True, qa_exit=1)
        self.assertTrue(result['code_published'])
        self.assertTrue(result['report_published'])
        self.assertIn('tool process exit: 1', report)
        self.assertIn('Browser check unavailable', report)
        self.assertTrue(any(c[:2] == ['git', 'push'] for c in calls))

    def test_no_approval_still_publishes_failure_report(self):
        result, calls, report = self.exercise(False)
        self.assertFalse(result['code_published'])
        self.assertTrue(result['report_published'])
        self.assertFalse(any(c[:2] == ['git', 'push'] for c in calls))
        self.assertIn('No explicit publish approval', report)

    def test_push_failure_still_reports(self):
        result, calls, report = self.exercise(True, ['git', 'push'])
        self.assertFalse(result['code_published'])
        self.assertTrue(result['report_published'])
        self.assertIn('git push failed', report)

    def test_qa_crash_without_verdict_still_reports(self):
        result, calls, report = self.exercise(None, qa_exit=124)
        self.assertTrue(result['report_published'])
        self.assertFalse(result['code_published'])
        self.assertIn('124', report)

    def test_report_failure_is_not_claimed_published(self):
        result, calls, report = self.exercise(True, ['gh', 'pr', 'edit'])
        self.assertTrue(result['code_published'])
        self.assertFalse(result['report_published'])
        self.assertIsNone(result['pr_url'])
        self.assertTrue(any(c[:3] == ['gh', 'issue', 'comment'] for c in calls))

    def test_diff_failure_still_reports(self):
        result, calls, report = self.exercise(True, ['git', 'diff'])
        self.assertFalse(result['code_published'])
        self.assertTrue(result['report_published'])
        self.assertIn('diff-check failed', report)
