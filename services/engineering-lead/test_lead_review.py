import json
from pathlib import Path
import tempfile
import unittest

import lead_review as lr

REPO = 'mrbam88/bamware-ai'


def pr(number=7, head='a' * 40, draft=False, mergeable='MERGEABLE', state='CLEAN',
       checks=(('CodeRabbit', 'SUCCESS'),), labels=(), files=('services/x.py',)):
    return {'number': number, 'title': f'PR {number}', 'headRefOid': head, 'isDraft': draft,
            'mergeable': mergeable, 'mergeStateStatus': state,
            'statusCheckRollup': [{'name': n, 'conclusion': c} for n, c in checks],
            'labels': [{'name': l} for l in labels], 'files': [{'path': f} for f in files]}


class SelectionTest(unittest.TestCase):
    def test_green_pr_is_a_candidate(self):
        self.assertEqual([p['number'] for p in lr.candidates(REPO, [pr()], {})], [7])

    def test_not_green_is_skipped(self):
        for bad in (pr(draft=True), pr(mergeable='CONFLICTING'), pr(state='DIRTY'),
                    pr(checks=(('ci', 'FAILURE'),)), pr(checks=(('ci', None),)),
                    pr(labels=('lead:hold',))):
            self.assertEqual(lr.candidates(REPO, [bad], {}), [], bad)

    def test_no_checks_is_green(self):
        self.assertEqual(len(lr.candidates(REPO, [pr(checks=())], {})), 1)

    def test_same_head_with_a_verdict_is_not_reviewed_again(self):
        reviewed = {f'{REPO}#7': {'head': 'a' * 40, 'verdict': 'FAIL', 'attempts': 1}}
        self.assertEqual(lr.candidates(REPO, [pr()], reviewed), [])
        self.assertEqual(len(lr.candidates(REPO, [pr(head='b' * 40)], reviewed)), 1)

    def test_errors_retry_once_per_head(self):
        once = {f'{REPO}#7': {'head': 'a' * 40, 'verdict': 'ERROR', 'attempts': 1}}
        twice = {f'{REPO}#7': {'head': 'a' * 40, 'verdict': 'ERROR', 'attempts': 2}}
        self.assertEqual(len(lr.candidates(REPO, [pr()], once)), 1)
        self.assertEqual(lr.candidates(REPO, [pr()], twice), [])


class GuardTest(unittest.TestCase):
    def test_human_gate_paths(self):
        files = ['.github/workflows/ci.yml', 'apps/web/vercel.json', 'ios/fastlane/Fastfile',
                 'certs/dist.p12', 'services/x.py', 'docs/vercel.md']
        self.assertEqual(lr.human_gate_paths(files), files[:4])

    def test_emergency_stop_pauses(self):
        d = Path(tempfile.mkdtemp())
        self.assertIsNone(lr.paused(d))
        (d / 'emergency-stop.json').write_text(json.dumps({'reason': 'quota incident'}))
        self.assertEqual(lr.paused(d), 'quota incident')

    def test_allowlist_scopes_writes_to_this_pr(self):
        allowed = lr.allowlist(REPO, 7)
        writes = [a for a in allowed if 'merge' in a or 'comment' in a or 'review' in a]
        self.assertTrue(writes)
        self.assertTrue(all(f'gh pr {v} 7 -R {REPO}' in a for a in writes
                            for v in ('merge', 'comment', 'review') if f'pr {v}' in a))
        self.assertFalse(any(a.startswith('Bash(git push') or a == 'Bash(git *)' for a in allowed))

    def test_argv_runs_on_subscription_without_prompts(self):
        argv = lr.claude_argv('do it', REPO, 7, 'opus', claude='/bin/claude')
        self.assertEqual(argv[:4], ['/bin/claude', '-p', '--model', 'opus'])
        self.assertIn('dontAsk', argv)
        env = lr.subscription_env({'ANTHROPIC_API_KEY': 'x', 'HOME': '/h'})
        self.assertEqual(env, {'HOME': '/h'})


class Harness:
    """Fake gh, git, claude and systemctl for one review cycle."""

    def __init__(self, prs, merged=True, verdict='PASS', overnight=False, dirty=False):
        self.prs, self.merged, self.verdict = prs, merged, verdict
        self.overnight, self.dirty = overnight, dirty
        self.calls = []
        self.state = Path(tempfile.mkdtemp())

    def gh(self, args):
        self.calls.append(('gh', *args))
        if args[:2] == ['pr', 'list']:
            return self.prs
        if args[:2] == ['pr', 'view']:
            return {'state': 'MERGED' if self.merged else 'OPEN',
                    'mergeCommit': {'oid': 'm' * 40} if self.merged else None}
        raise AssertionError(args)

    def run(self, argv, **kw):
        self.calls.append(tuple(argv))

        class R:
            returncode, stdout, stderr = 0, '', ''
        r = R()
        if argv[0] == '/bin/claude':
            out_dir = Path(kw['env']['BAMWARE_LEAD_RECEIPT_DIR'])
            (out_dir / 'verdict.json').write_text(json.dumps({'verdict': self.verdict}))
            r.stdout = json.dumps({'is_error': False, 'num_turns': 3})
        elif argv[:3] == ['systemctl', '--user', 'list-units']:
            r.stdout = 'bamware-overnight-1.service loaded active running x\n' if self.overnight else ''
        elif 'status' in argv and '--porcelain' in argv:
            r.stdout = ' M x\n' if self.dirty else ''
        elif 'log' in argv:
            r.stdout = 'abc123 merged\n'
        return r

    def cycle(self):
        return lr.cycle(REPOS, self.state, gh=self.gh, run=self.run, claude='/bin/claude',
                        model='opus', max_reviews=2, now=lambda: 1791000000.0)


REPOS = {REPO: {'checkout': '/c/bamware-ai', 'deploy_worktree': '/c/main'}}


class CycleTest(unittest.TestCase):
    def test_pass_merges_then_deploys(self):
        h = Harness([pr()])
        receipts = h.cycle()
        self.assertEqual(receipts[0]['verdict'], 'PASS')
        self.assertTrue(receipts[0]['merged'])
        self.assertEqual(receipts[0]['deployed'], 'abc123 merged')
        self.assertIn(('git', '-C', '/c/main', 'checkout', '-q', '--detach', 'origin/main'), h.calls)
        reviewed = json.loads((h.state / 'engineering-lead' / 'reviewed.json').read_text())
        self.assertEqual(reviewed[f'{REPO}#7']['verdict'], 'PASS')

    def test_no_deploy_while_a_batch_runs_or_worktree_dirty(self):
        for h in (Harness([pr()], overnight=True), Harness([pr()], dirty=True)):
            receipt = h.cycle()[0]
            self.assertIsNone(receipt['deployed'])
            self.assertTrue(receipt['deploy_skipped'])
            self.assertNotIn(('git', '-C', '/c/main', 'checkout', '-q', '--detach', 'origin/main'), h.calls)

    def test_human_gate_pr_is_not_sent_to_the_lead(self):
        h = Harness([pr(files=('.github/workflows/ci.yml',))])
        receipt = h.cycle()[0]
        self.assertEqual(receipt['verdict'], 'HUMAN_GATE')
        self.assertFalse(any(c[0] == '/bin/claude' for c in h.calls))

    def test_emergency_stop_launches_nothing(self):
        h = Harness([pr()])
        (h.state / 'emergency-stop.json').write_text('{"reason": "stop"}')
        self.assertEqual(h.cycle(), [])
        self.assertEqual(h.calls, [])

    def test_fail_records_verdict_without_deploy(self):
        h = Harness([pr()], merged=False, verdict='FAIL')
        receipt = h.cycle()[0]
        self.assertEqual((receipt['verdict'], receipt['merged'], receipt['deployed']), ('FAIL', False, None))

    def test_review_worktree_is_always_removed(self):
        h = Harness([pr()])
        h.cycle()
        self.assertTrue(any(c[:4] == ('git', '-C', '/c/bamware-ai', 'worktree') and 'remove' in c
                            for c in h.calls))


if __name__ == '__main__':
    unittest.main()
