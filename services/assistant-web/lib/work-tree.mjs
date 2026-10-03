import { summarizeWorkCost } from './work-cost.mjs';
import { describeWorkTask, workProjectName } from './providers/work-task-metadata.mjs';
// Projection of observed membership, not an inferred delegation/command graph.
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const key = parts => JSON.stringify(parts);
function recordedState(event) {
  const outcome = event.outcome;
  if (outcome.state === 'verified-pass' && outcome.verified) return 'Verified pass recorded';
  if (outcome.state === 'qa-fail') return 'QA failure recorded';
  if (outcome.state === 'retry-pending') return 'Retry pending recorded';
  if (event.timing.waitReason && event.timing.waitReason !== 'none') return `Waiting recorded: ${event.timing.waitReason}`;
  if (event.timing.endedAt) return 'Finished; outcome unverified';
  return 'Activity unknown';
}
export function buildWorkTree(events, { now = Date.now() } = {}) {
  const projects = new Map();
  for (const [index, event] of events.entries()) {
    const projectId = key([event.project, event.repo]);
    if (!projects.has(projectId)) projects.set(projectId, { id: projectId, project: event.project, name: workProjectName(event.project, event.repo), repositoryUrl: ['bamware-ai', 'mrbam88/bamware-ai'].includes(event.repo) ? 'https://github.com/mrbam88/bamware-ai' : null, tasks: new Map(), metadata: [] });
    const project = projects.get(projectId);
    if (!event.task && !event.attempt.id && !event.agent.sessionId) {
      project.metadata.push({ source: event.source.label ?? 'Source unspecified', fetchedAt: event.source.fetchedAt, machine: event.agent.machine.id, commit: event.trace?.commit ?? null });
      continue;
    }
    const taskId = key([projectId, event.task?.id ?? null]);
    if (!project.tasks.has(taskId)) project.tasks.set(taskId, { id: taskId, ...describeWorkTask(event), taskKnown: Boolean(event.task), costEvents: [], runs: new Map() });
    const task = project.tasks.get(taskId);
    task.costEvents.push(event);
    const runKnown = Boolean(event.attempt.id || event.agent.sessionId);
    const runId = key([taskId, event.attempt.id ?? event.agent.sessionId ?? event.id ?? index]);
    const observedAt = event.timing.endedAt ?? event.timing.startedAt ?? null;
    const observedMs = timestamp(observedAt);
    const previous = task.runs.get(runId);
    // Multiple token/model buckets can refer to one attempt. Keep one run.
    if (previous && (timestamp(previous.observedAt) ?? -Infinity) > (observedMs ?? -Infinity)) continue;
    task.runs.set(runId, {
      id: runId, runKnown, kind: event.attempt.kind,
      sessionId: event.agent.sessionId, provider: event.agent.provider,
      model: event.agent.model, machine: event.agent.machine.id,
      state: recordedState(event), observedAt,
      freshness: observedMs == null ? 'Unknown observation time' : now - observedMs > 15 * 60_000 ? 'Historical observation' : 'Recent observation; activity unverified',
      source: event.source.label ?? 'Source unspecified', sourceKind: event.source.kind,
      fetchedAt: event.source.fetchedAt,
      attention: ['qa-fail', 'retry-pending'].includes(event.outcome.state) || (event.outcome.state !== 'verified-pass' && Boolean(event.timing.waitReason && event.timing.waitReason !== 'none')),
    });
  }
  return {
    version: '1', relationship: 'observed-membership',
    coverage: 'Projects, tasks and recorded attempts only. Delegation, current ownership and founder decisions are not yet linked. Observation recency is not a live heartbeat.',
    projects: [...projects.values()].map(project => {
      const tasks = [...project.tasks.values()].map(task => {
        const runs = [...task.runs.values()].sort((a,b) => (timestamp(b.observedAt) ?? -Infinity) - (timestamp(a.observedAt) ?? -Infinity) || a.id.localeCompare(b.id));
        const latestTime = timestamp(runs[0]?.observedAt);
        const latest = runs.filter(run => timestamp(run.observedAt) === latestTime);
        const uncertain = runs.some(run => timestamp(run.observedAt) == null) || new Set(latest.map(run => run.state)).size > 1;
        const {costEvents, ...description} = task;
        return { ...description, cost: summarizeWorkCost(costEvents), runs, state: uncertain ? 'Latest state uncertain' : runs[0]?.state ?? 'Activity unknown', attention: uncertain ? false : latest.some(run => run.attention), uncertain };
      });
      return { ...project, tasks, taskCount: tasks.filter(t => t.taskKnown).length, attentionCount: tasks.filter(t => t.attention).length, uncertainCount: tasks.filter(t => t.uncertain).length, runCount: tasks.reduce((n,t) => n + t.runs.filter(r => r.runKnown).length, 0) };
    }).sort((a,b) => b.attentionCount - a.attentionCount || a.name.localeCompare(b.name)),
  };
}
