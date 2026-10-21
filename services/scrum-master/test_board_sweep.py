import json
from pathlib import Path
import tempfile
import unittest

import board_sweep as bs

NOW = 1791000000.0  # 2026-10-03T03:20:00Z
FRESH = '2026-10-03T00:00:00Z'
OLD = '2026-09-20T00:00:00Z'
REPO = 'mrbam88/bamware-ai'


def item(number=1, status='Todo', worker=None, prs=None, kind='Issue', priority=None):
    return {'id': f'PVTI_{number}', 'title': f'Ticket {number}', 'status': status,
            'worker': worker, 'priority': priority, 'linked pull requests': prs or [],
            'content': {'type': kind, 'number': number, 'repository': REPO,
                        'url': f'https://github.com/{REPO}/issues/{number}', 'title': f'Ticket {number}'}}


def issue(updated=FRESH, state='OPEN', assignees=('bilal',)):
    return {'updatedAt': updated, 'state': state, 'assignees': [{'login': a} for a in assignees],
            'closedByPullRequestsReferences': []}


def pr(state='OPEN', merged=None, updated=FRESH, checks=('pass',)):
    return {'state': state, 'mergedAt': merged, 'updatedAt': updated, 'isDraft': False,
            'checks': [{'bucket': b} for b in checks]}


def flags(findings, number=1):
    return sorted(f['flag'] for f in findings if f['number'] == number)


class AssessTest(unittest.TestCase):
    def test_healthy_item_has_no_findings(self):
        self.assertEqual(bs.assess(item(worker='Claude'), issue(), [], NOW), [])

    def test_no_owner_needs_both_assignee_and_worker_missing(self):
        self.assertEqual(flags(bs.assess(item(), issue(assignees=()), [], NOW)), ['no-owner'])
        self.assertEqual(bs.assess(item(worker='Claude'), issue(assignees=()), [], NOW), [])

    def test_stale_after_72_hours(self):
        self.assertEqual(flags(bs.assess(item(worker='x'), issue(updated=OLD), [], NOW)), ['stale-72h'])

    def test_in_progress_without_worker(self):
        got = bs.assess(item(status='In Progress'), issue(), [], NOW)
        self.assertEqual(flags(got), ['in-progress-no-worker'])

    def test_closed_issue_still_active(self):
        got = bs.assess(item(worker='x'), issue(state='CLOSED'), [], NOW)
        self.assertEqual(flags(got), ['closed-but-active'])

    def test_merged_pr_while_active(self):
        got = bs.assess(item(worker='x'), issue(), [pr(state='MERGED', merged=FRESH)], NOW)
        self.assertEqual(flags(got), ['merged-but-active'])

    def test_failing_checks_on_open_pr(self):
        got = bs.assess(item(worker='x'), issue(), [pr(checks=('pass', 'fail'))], NOW)
        self.assertEqual(flags(got), ['failing-checks'])

    def test_pending_checks_are_not_failing(self):
        self.assertEqual(bs.assess(item(worker='x'), issue(), [pr(checks=('pending',))], NOW), [])

    def test_ready_for_qa_without_pr(self):
        got = bs.assess(item(status='Ready for QA', worker='x'), issue(), [], NOW)
        self.assertEqual(flags(got), ['qa-without-pr'])

    def test_draft_issue_only_gets_owner_checks(self):
        got = bs.assess(item(kind='DraftIssue', number=None), None, [], NOW)
        self.assertEqual([f['flag'] for f in got], ['no-owner'])

    def test_findings_rank_by_severity_then_priority(self):
        findings = [
            {'flag': 'stale-72h', 'priority': 'P0'},
            {'flag': 'failing-checks', 'priority': None},
            {'flag': 'stale-72h', 'priority': 'P1 — next'},
        ]
        ranked = bs.rank(findings)
        self.assertEqual([(f['flag'], f['priority']) for f in ranked],
                         [('failing-checks', None), ('stale-72h', 'P0'), ('stale-72h', 'P1 — next')])


class FakeGh:
    """Answers gh argv with canned JSON; records every call."""

    def __init__(self, board, issues=None, prs=None, fail=()):
        self.board, self.issues, self.prs, self.fail = board, issues or {}, prs or {}, set(fail)
        self.calls = []

    def __call__(self, args):
        self.calls.append(args)
        kind = args[0] + ' ' + args[1]
        if kind in self.fail or ' '.join(args[:3]) in self.fail:
            raise bs.SourceError(f'{kind} failed')
        if kind == 'project item-list':
            return {'items': self.board}
        if kind == 'issue view':
            return self.issues[int(args[2])]
        if kind == 'pr view':
            p = dict(self.prs[int(args[2])])
            p.pop('checks', None)
            return p
        if kind == 'pr checks':
            return self.prs[int(args[2])]['checks']
        raise AssertionError(f'unexpected gh call: {args}')


class SweepTest(unittest.TestCase):
    def run_sweep(self, gh):
        state = Path(tempfile.mkdtemp())
        summary = bs.sweep(gh, project='2', owner='mrbam88', state_dir=state, now=lambda: NOW)
        receipt = json.loads((state / 'latest.json').read_text())
        return summary, receipt, state

    def test_only_reads_and_writes_dated_receipt_and_latest(self):
        board = [item(1, worker='x', prs=[f'https://github.com/{REPO}/pull/9']),
                 item(2, status='Done'), item(3, status=None)]
        gh = FakeGh(board, issues={1: issue()}, prs={9: pr(checks=('fail',))})
        summary, receipt, state = self.run_sweep(gh)
        self.assertEqual(receipt['actions_taken'], [])
        self.assertEqual(receipt['coverage']['items_total'], 3)
        self.assertEqual(receipt['coverage']['items_active'], 1)
        self.assertEqual(receipt['coverage']['prs_checked'], 1)
        self.assertEqual(sorted(f['flag'] for f in receipt['findings']), ['failing-checks', 'no-status'])
        self.assertEqual(len(list((state / 'sweeps').glob('*.json'))), 1)
        verbs = {c[0] + ' ' + c[1] for c in gh.calls}
        self.assertEqual(verbs, {'project item-list', 'issue view', 'pr view', 'pr checks'})
        self.assertEqual(summary['receipt'], receipt['receipt'])

    def test_board_failure_is_recorded_not_raised(self):
        _, receipt, _ = self.run_sweep(FakeGh([], fail={'project item-list'}))
        self.assertEqual(receipt['coverage']['items_total'], 0)
        self.assertEqual(receipt['source_failures'][0]['stage'], 'project item-list')

    def test_one_issue_failure_keeps_the_rest(self):
        board = [item(1, worker='x'), item(2, worker='x')]
        gh = FakeGh(board, issues={2: issue(updated=OLD)}, fail={'issue view 1'})
        _, receipt, _ = self.run_sweep(gh)
        self.assertEqual([f['number'] for f in receipt['findings']], [2])
        self.assertEqual(receipt['source_failures'][0]['ref'], f'{REPO}#1')
        self.assertEqual(receipt['unknowns'], [f'{REPO}#1'])


if __name__ == '__main__':
    unittest.main()
