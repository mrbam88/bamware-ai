import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnvFile } from '../lib.mjs';

export async function notifyOwnerBlocker({ blocker, candidate, transition }) {
  let cfg, auth;
  try {
    cfg = parseEnvFile(fs.readFileSync(path.join(os.homedir(), '.config/bamware/discord.env'), 'utf8'));
    auth = parseEnvFile(fs.readFileSync(path.join(os.homedir(), '.hermes/.env'), 'utf8'));
    if (!/^\d+$/.test(cfg.DISCORD_ASSISTANT_CHANNEL ?? '') || !/^\d+$/.test(cfg.DISCORD_USER_ID ?? '') || !auth.DISCORD_BOT_TOKEN) throw Error();
  } catch { throw Object.assign(new Error('Discord capability unavailable'), { safeToRetry: true }); }
  const marker = `[blocker:${blocker.id}:${transition}:v${candidate.version}]`;
  const detail = transition === 'resolved'
    ? `Resolution verified: ${blocker.resolutionEvidence.ref}. Work: ${blocker.resume?.status ?? 'resume_pending'}.`
    : `Action: ${blocker.ownerAction}\nAffected work: ${candidate.blockedWork.join('; ')}\nResolution check: ${blocker.completion}`;
  const content = `<@${cfg.DISCORD_USER_ID}> **${transition === 'resolved' ? 'Blocker resolved' : 'Action needed'}: ${candidate.title}**\n${detail}\nObserver: ${blocker.observer ?? 'recorded source; machine unspecified'}. Last evidence: ${blocker.checkedAt ?? 'unknown'}.\nCommand Center → Decisions\nhttps://omarchy.tailb7fa1e.ts.net/\n${marker}`.slice(0, 1950);
  const endpoint = `https://discord.com/api/v10/channels/${cfg.DISCORD_ASSISTANT_CHANNEL}/messages`;
  const headers = { Authorization: `Bot ${auth.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' };
  const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ content, flags: 4, allowed_mentions: { parse: [], users: [cfg.DISCORD_USER_ID] } }), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Object.assign(new Error('Discord request rejected'), { safeToRetry: r.status >= 400 && r.status < 500 });
  const message = await r.json();
  try {
    const check = await fetch(`${endpoint}/${message.id}`, { headers, signal: AbortSignal.timeout(15000) });
    if (!check.ok || (await check.json()).id !== message.id) throw Error();
  } catch { throw Object.assign(new Error('Discord readback unavailable'), { messageId: message.id }); }
  return { messageId: message.id, verifiedAt: new Date().toISOString() };
}
