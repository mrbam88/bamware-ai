// Decision discussion ledger. Private state only; Discord remains the conversation owner.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { assertValidCandidate, StaleDecisionError } from './decisions.mjs';
const hash = v => createHash('sha256').update(v).digest('hex');
const fingerprint = c => hash(JSON.stringify(Object.fromEntries(["id", "version", "title", "project", "context", "source", "recommendation", "options", "urgency", "owner", "blockedWork", "escalationReason"].map(k => [k, c[k]]))));
const fail = (message, status = 409) => Object.assign(new Error(message), { status });
export function createDecisionDiscussions({ directory, transport, baseUrl = 'https://omarchy.tailb7fa1e.ts.net/', now = Date.now }) {
  const origin = new URL(baseUrl);
  if (origin.protocol !== 'https:' || origin.username || origin.password) throw Error('Discussion backlink requires HTTPS');
  const file = id => path.join(directory, `${hash(id)}.json`);
  function read(id) { try { return JSON.parse(fs.readFileSync(file(id), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw fail('Discussion ledger unreadable. Operator repair required.', 500); } }
  function save(s) {
    const tmp = `${file(s.decisionId)}.${randomUUID()}.tmp`;
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(s, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file(s.decisionId));
    const directoryFd = fs.openSync(directory, 'r');
    try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
  }
  async function locked(id, fn) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const lock = `${file(id)}.lock`;
    // Exclusive file creation avoids races. A crashed lock needs explicit operator
    // inspection/removal; elapsed time cannot prove that the owner stopped sending.
    let fd;
    try { fd = fs.openSync(lock, 'wx', 0o600); }
    catch (e) { if (e.code === 'EEXIST') throw fail('Discussion operation in progress or interrupted. Refresh; operator repair may be required.'); throw e; }
    try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date(now()).toISOString() })); return await fn(); }
    finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  function view(s, candidate) {
    if (!s) return null;
    return { status: s.status, detail: s.detail ?? null, url: s.url ?? null, threadId: s.threadId ?? null,
      candidateVersion: s.candidateVersion, stale: s.fingerprint !== fingerprint(candidate),
      pickup: s.pickup ?? null, summary: s.summary ?? null, summaries: s.summaries ?? [], updatedAt: s.updatedAt };
  }
  function seed(candidate) {
    const url = new URL(origin); url.hash = `decision=${encodeURIComponent(candidate.id)}`;
    return [`**CoS handoff** — CEO sent this from Command Center`,
      `Decision: ${candidate.title}`, `ID: ${candidate.id} · version: ${candidate.version}`,
      candidate.project ? `Project: ${candidate.project}` : null,
      candidate.urgency ? `Urgency: ${candidate.urgency}` : null,
      candidate.owner ? `Owner: ${candidate.owner}` : null,
      candidate.blockedWork ? `Blocked work: ${candidate.blockedWork}` : null,
      candidate.escalationReason ? `Escalation: ${candidate.escalationReason}` : null,
      '', 'Context:', candidate.context,
      '', `Options: ${candidate.options.map(o => `${o.id}: ${o.label}`).join('; ')}`,
      `Recommendation: ${candidate.recommendation?.optionId ?? 'none'} — ${candidate.recommendation?.rationale ?? ''}`,
      `Source: ${candidate.source.url ?? candidate.source.ref}`, `Decision card: ${url}`,
      '', 'Discuss here with CoS / agents in #command-center. This message is not execution approval — use the decision card to approve/reject/defer.',
      `Context fingerprint: ${fingerprint(candidate)}`].filter(x => x != null).join('\n');
  }
  async function deliver(s, key, channelId, content) {
    let op = s.operations[key];
    if (!op) { op = s.operations[key] = { marker: `[bamware-discussion:${hash(s.decisionId).slice(0,24)}:${key}]`, createdAt: new Date(now()).toISOString(), status: 'prepared' }; save(s); }
    if (op.messageId) return op.messageId;
    // Every recovery is scoped to the recorded channel and bot author by transport.
    if (op.status === 'sending' || op.status === 'ambiguous') {
      const found = await transport.findMessage(channelId, op);
      if (!found) throw fail('Discord delivery is uncertain. Reconcile the existing message before retrying; no duplicate was sent.');
      op.messageId = found.id; op.status = 'sent'; save(s); return op.messageId;
    }
    op.status = 'sending'; save(s);
    try {
      const message = await transport.sendMessage(channelId, `${content}\n${op.marker}`, hash(op.marker).slice(0,24));
      op.messageId = message.id; op.status = 'sent'; save(s); return message.id;
    } catch (e) { op.status = e.safeToRetry ? 'prepared' : 'ambiguous'; save(s); throw e; }
  }
  async function open(candidate, candidateVersion) {
    assertValidCandidate(candidate);
    if (candidate.version !== candidateVersion) throw new StaleDecisionError('Decision changed. Reload before opening discussion.');
    return locked(candidate.id, async () => {
      let s = read(candidate.id);
      const config = await transport.identity();
      if (s && (s.channelId !== config.channelId || s.guildId !== config.guildId || s.ownerId !== config.ownerId || s.botId !== config.botId)) throw fail('Discord identity or channel changed. Operator repair required.');
      if (!s) { s = { decisionId: candidate.id, candidateVersion: candidate.version, fingerprint: fingerprint(candidate), channelId: config.channelId, guildId: config.guildId, ownerId: config.ownerId, botId: config.botId, operations: {}, summaries: [], status: 'pending', updatedAt: new Date(now()).toISOString() }; save(s); }
      try {
        // Channel mode (CEO 2026-10-04): post full context to CoS #bamware-bot.
        // No Discord threads — discussion lives in the same CoS channel chat.
        s.conversationMode = 'channel';
        if (!s.rootMessageId) {
          s.rootMessageId = await deliver(s, 'root', s.channelId, `**Send to CoS:** ${candidate.title}\nDecision \`${candidate.id}\` · context follows in this channel.`);
          save(s);
        }
        // threadId = anchor message for stable deep-link; delivery target is always channelId.
        s.threadId = s.rootMessageId;
        s.url = `https://discord.com/channels/${s.guildId}/${s.channelId}/${s.rootMessageId}`;
        if (typeof transport.checkChannel === 'function') await transport.checkChannel(s.channelId);
        else if (typeof transport.checkThread === 'function') {
          // Tests/fixtures: channel-mode uses root as conversation id; tolerate missing thread map.
          try { await transport.checkThread(s.threadId, s.channelId); }
          catch (e) { if (s.conversationMode !== 'channel') throw e; }
        }
        save(s);
        const revisionKey = `v-${fingerprint(candidate).slice(0,24)}`;
        const context = seed(candidate);
        s.proposal = candidate; save(s);
        for (let offset = 0, part = 0; offset < context.length; offset += 1700, part++) {
          s.seedMessageId = await deliver(s, `${revisionKey}-${part}`, s.channelId, context.slice(offset, offset + 1700));
        }
        if (s.fingerprint !== fingerprint(candidate)) {
          s.cursor = s.seedMessageId; s.lastOwnerMessageId = null; s.pickup = null; s.summary = null;
        }
        s.candidateVersion = candidate.version; s.fingerprint = fingerprint(candidate);
        s.status = 'ready'; s.detail = 'Sent to #command-center. Reply there with CoS — not execution approval.';
      } catch (e) { s.status = 'repair_required'; s.detail = e.safeMessage ?? e.message; }
      s.updatedAt = new Date(now()).toISOString(); save(s); return view(s, candidate);
    });
  }
  async function sync(candidate, candidateVersion) {
    if (candidate.version !== candidateVersion) throw new StaleDecisionError('Decision changed. Reload before syncing.');
    return locked(candidate.id, async () => {
      const s = read(candidate.id);
      if (!s?.threadId || s.status !== 'ready') throw fail('Open or repair this decision discussion first.');
      if (s.fingerprint !== fingerprint(candidate)) throw new StaleDecisionError('Open discussion to send the current proposal version first.');
      const readChannel = s.conversationMode === 'channel' ? s.channelId : s.threadId;
      if (s.conversationMode === 'channel') {
        if (typeof transport.checkChannel === 'function') await transport.checkChannel(s.channelId);
      } else await transport.checkThread(s.threadId, s.channelId);
      const messages = await transport.messages(readChannel, s.cursor ?? s.seedMessageId);
      // Transport returns an ascending bounded page. Advance only after durable processing.
      let ownerMessageId = s.lastOwnerMessageId ?? null;
      for (const m of messages) {
        if (m.author?.id === s.ownerId && !m.author.bot) ownerMessageId = m.id;
        if (m.author?.id === s.botId && ownerMessageId && BigInt(m.id) > BigInt(ownerMessageId) && !m.content.includes('[bamware-discussion:')) {
          s.pickup = { status: 'reply_observed', ownerMessageId, replyMessageId: m.id, url: `${s.url}/${m.id}` };
          const block = m.content.match(/```bamware-decision\s*([\s\S]*?)```/);
          if (block) {
            let p; try { p = JSON.parse(block[1]); } catch { continue; }
            if (p.decisionId !== candidate.id || p.candidateVersion !== candidate.version || p.fingerprint !== s.fingerprint || p.ownerMessageId !== ownerMessageId || typeof p.summary !== 'string' || !p.summary.trim() || p.summary.length > 4000 || (p.proposedRevision != null && (typeof p.proposedRevision !== 'string' || p.proposedRevision.length > 4000))) continue;
            if (!s.summaries.some(x => x.messageId === m.id)) {
              s.summary = { summary: p.summary, proposedRevision: p.proposedRevision ?? null, candidateVersion: candidate.version, fingerprint: s.fingerprint, ownerMessageId, messageId: m.id, url: `${s.url}/${m.id}`, recordedAt: new Date(now()).toISOString(), authority: 'proposal_only' };
              s.summaries.push(s.summary);
            }
          }
        }
      }
      if (messages.length) s.cursor = messages.at(-1).id;
      s.lastOwnerMessageId = ownerMessageId; s.updatedAt = new Date(now()).toISOString(); save(s); return view(s, candidate);
    });
  }
  return { open, sync, snapshot: candidate => {
    try { return view(read(candidate.id), candidate); }
    catch { return { status: 'repair_required', detail: 'Discussion ledger unreadable. Operator repair required.', url: null }; }
  } };
}
