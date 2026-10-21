import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import run_engineer as re_


class RunEngineerTests(unittest.TestCase):
    def work(self, result):
        work = Path(tempfile.mkdtemp())
        (work / 't.prompt').write_text('do the ticket')
        calls = []

        def fake_run(argv, stdout, env, **kwargs):
            calls.append((argv, env))
            stdout.write(result if isinstance(result, str) else json.dumps(result))
            return subprocess.CompletedProcess(argv, 0)
        return work, calls, fake_run

    def test_runs_the_routed_model_with_the_prompt(self):
        work, calls, fake = self.work({'is_error': False, 'num_turns': 3, 'usage': {'output_tokens': 10}})
        rc, summary = re_.run_task('t', work, 'claude-sonnet-5', run=fake)
        argv, env = calls[0]
        self.assertEqual(rc, 0)
        self.assertEqual(argv[argv.index('--model') + 1], 'claude-sonnet-5')
        self.assertEqual(argv[-1], 'do the ticket')
        self.assertEqual(summary['usage'], {'output_tokens': 10})

    def test_paid_api_variables_are_stripped(self):
        env = re_.subscription_env({'ANTHROPIC_API_KEY': 'x', 'CLAUDE_CODE_USE_BEDROCK': '1', 'PATH': '/bin'})
        self.assertEqual(env, {'PATH': '/bin'})

    def test_worker_errors_fail_the_task(self):
        work, _, fake = self.work({'is_error': True})
        self.assertEqual(re_.run_task('t', work, run=fake)[0], 1)

    def test_denied_commands_are_counted_not_fatal(self):
        work, _, fake = self.work({'is_error': False, 'subtype': 'success', 'permission_denials': [{'tool_name': 'Bash'}] * 13})
        rc, summary = re_.run_task('t', work, run=fake)
        self.assertEqual(rc, 0)
        self.assertEqual(summary['denied_commands'], 13)

    def test_unparseable_result_fails_the_task(self):
        work, _, fake = self.work('not json')
        self.assertEqual(re_.run_task('t', work, run=fake)[0], 1)


if __name__ == '__main__':
    unittest.main()
