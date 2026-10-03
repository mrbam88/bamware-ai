// Founder-approved CoS handoffs. Imported evidence is not a live worker heartbeat.
export const SCRUM_MASTER_ASSIGNMENTS = [
  {
    id: 'auth-85', revision: '2026-10-03-v1', title: 'Shared authentication release supervision',
    project: 'bamware-auth', source: 'https://github.com/mrbam88/bamware-ai/issues/85',
    nextCheckpoint: 'Reconcile draft PR readiness and three owner blockers; release remains gated on target access, integration proof and independent review.',
    worker: { kind: 'external-session-workers', status: 'historical-handoff-only', liveExecutionObserved: false },
    importedEvidence: { reportedDate: '2026-10-03', source: 'Chief of Staff authorized handoff, bamware-ai#79', detail: 'Auth foundation20:185 tests; service21 ae0bcdb:211 tests/review; dating21 b7c58c3:429 tests/package; push1 fb9f931:77 tests/package/review, CI test passed but gitleaks403; web47 9cf1acc:29 tests/typecheck/build/review. These are reported checkpoints, not this supervisor rerunning QA. No live email proof or owner resolution.' },
    blockers: ['auth-email-aws-access-85','auth-atomic-docker-access-85','auth-push-ci-permission-85'],
    sources: [
      {repo:'mrbam88/bamware-ai',kind:'issue',number:85},
      {repo:'mrbam88/bamware-auth-service',kind:'pull',number:20},
      {repo:'mrbam88/bamware-auth-service',kind:'pull',number:21,reviewedRevision:'ae0bcdb'},
      {repo:'mrbam88/bamware-dating-service',kind:'pull',number:21,reviewedRevision:'b7c58c3'},
      {repo:'mrbam88/bamware-push-service',kind:'pull',number:1,reviewedRevision:'fb9f931'},
      {repo:'mrbam88/bamware-web',kind:'pull',number:47,reviewedRevision:'9cf1acc'},
    ],
  },
  {
    id:'discuss-92',revision:'2026-10-03-v1',title:'Shared CoS decision discussion flow',project:'bamware-assistant',source:'https://github.com/mrbam88/bamware-ai/issues/92',
    nextCheckpoint:'Session worker returns ledger/UI/gateway-skill implementation and fixture QA, then real owner conversation proof. Do not dispatch duplicate work.',
    worker:{kind:'session-only',label:'auth_security_review implementation session',status:'accepted-by-session-worker',liveExecutionObserved:false},
    importedEvidence:{reportedDate:'2026-10-03',source:'Chief of Staff authorized handoff, bamware-ai#79',detail:'Implementation worker reported separate decision-discussion-92 worktree; no PR at handoff. Session pickup is imported evidence, not a server-controlled heartbeat.'},
    blockers:[],sources:[{repo:'mrbam88/bamware-ai',kind:'issue',number:92}],
  },
  {
    id:'voice-62',revision:'2026-10-03-v1',title:'Voice interface to shared Chief of Staff',project:'bamware-assistant',source:'https://github.com/mrbam88/bamware-ai/issues/62',
    nextCheckpoint:'Define shared authenticated CoS conversation/delegation bridge; verify model account access and bounded test budget before voice calls.',
    worker:{kind:'unassigned',status:'no-implementation-pickup',liveExecutionObserved:false},
    importedEvidence:{reportedDate:'2026-10-03',source:'https://github.com/mrbam88/bamware-ai/issues/62#issuecomment-5965016888',detail:'Official-doc voice readiness audit complete. No model calls, voice quality measurements, paid test budget or streaming listener on8642 established.'},
    blockers:[],sources:[{repo:'mrbam88/bamware-ai',kind:'issue',number:62}],
  },
];
