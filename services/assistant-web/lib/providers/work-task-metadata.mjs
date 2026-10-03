// Bounded GitHub issue snapshot, reviewed 2026-10-02. No render-time network calls.
// Refresh from the linked issue when its title/scope changes. Purpose summarizes scope,
// not live worker status.
const issues = {
  '75': {
    title: 'Overnight batch: trustworthy AI rate-limit and reset visibility in Bamware Assistant',
    purpose: 'Show provider limits and known reset times so planned work avoids surprise interruptions.',
  },
  '76': {
    title: 'Overnight batch: Agents dashboard — work analytics and model-routing evidence',
    purpose: 'Show agent usage, work, waiting and outcomes by project and ticket.',
  },
  '78': {
    title: 'Overnight batch: Command Center Decisions card MVP in Bamware Assistant',
    purpose: 'Present founder decisions with context, recommendations and recorded responses.',
  },
};
export function describeWorkTask(event) {
  const knownRepo = ['mrbam88/bamware-ai', 'bamware-ai'].includes(event.repo);
  const issue = knownRepo && Object.hasOwn(issues, event.task?.id) ? issues[event.task.id] : null;
  return {
    title: issue ? issue.title.replace(/^Overnight batch: /, '').replace(/ in Bamware Assistant$/, '') : event.task?.title || event.ticket || 'Task unknown',
    purpose: issue?.purpose ?? null,
    ticket: event.ticket ?? null,
    batch: event.batch ?? null,
    batchLabel: issue ? "Overnight batch" : "Batch",
    repositoryUrl: knownRepo ? "https://github.com/mrbam88/bamware-ai" : null,
    sourceUrl: issue ? `https://github.com/mrbam88/bamware-ai/issues/${event.task.id}` : null,
    sourceTitle: issue?.title ?? null,
    metadataAsOf: issue ? '2026-10-02' : null,
  };
}

export function workProjectName(project, repo) {
  return project === 'Bamware Assistant' && ['bamware-ai', 'mrbam88/bamware-ai'].includes(repo) ? 'Assistant development' : project ?? 'Unallocated work';
}
