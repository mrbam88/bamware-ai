import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnvFile } from '../lib.mjs';
const snowflake = x => typeof x === 'string' && /^\d{16,22}$/.test(x);
export function createDecisionDiscordTransport({ fetchImpl = fetch, config } = {}) {
  let identity;
  function settings() {
    if (config) return config;
    try {
      const c = parseEnvFile(fs.readFileSync(path.join(os.homedir(), '.config/bamware/discord.env'), 'utf8'));
      const h = parseEnvFile(fs.readFileSync(path.join(os.homedir(), '.hermes/.env'), 'utf8'));
      // Command Center card discussions → #command-center; fall back to CoS home.
      const channelId = c.DISCORD_DISCUSSION_CHANNEL || c.DISCORD_COMMAND_CENTER_CHANNEL || h.DISCORD_COMMAND_CENTER_CHANNEL
        || c.DISCORD_ASSISTANT_CHANNEL || h.DISCORD_HOME_CHANNEL;
      return { channelId, ownerId: c.DISCORD_USER_ID || h.DISCORD_ALLOWED_USERS?.split(',')[0], token: h.DISCORD_BOT_TOKEN };
    } catch { throw Object.assign(Error('Discord capability unavailable.'), { safeToRetry: true }); }
  }
  async function api(route, method = 'GET', body) {
    const c = settings();
    if (!snowflake(c.channelId) || !snowflake(c.ownerId) || !c.token) throw Object.assign(Error('Discord capability unavailable.'), { safeToRetry: true });
    let response;
    try { response = await fetchImpl(`https://discord.com/api/v10${route}`, { method, headers: { Authorization: `Bot ${c.token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) }); }
    catch { throw Error('Discord request outcome unknown. Reconcile before resending.'); }
    if (!response.ok) throw Object.assign(Error(response.status === 404 ? 'Discussion resource missing. Operator repair required.' : response.status === 403 ? 'Discord permission unavailable. Operator repair required.' : 'Discord request failed.'), { httpStatus: response.status, safeToRetry: response.status >= 400 && response.status < 500 });
    if (response.status === 204) return null;
    try { return await response.json(); } catch { throw Error('Discord response unreadable. Reconcile before resending.'); }
  }
  async function getIdentity() {
    if (identity) return identity;
    const c = settings();
    const [bot, channel] = await Promise.all([api('/users/@me'), api(`/channels/${c.channelId}`)]);
    if (channel.type !== 0 || !snowflake(channel.guild_id) || !snowflake(bot.id) || !bot.bot) throw Error('Discussion requires the existing guild text channel and bot.');
    identity = { channelId: c.channelId, ownerId: c.ownerId, guildId: channel.guild_id, botId: bot.id }; return identity;
  }
  async function checkThread(id, parent) {
    const c = await getIdentity(), thread = await api(`/channels/${id}`);
    if (thread.id !== id || thread.parent_id !== parent || thread.guild_id !== c.guildId || thread.type !== 11) throw Error('Discussion mapping mismatch. Operator repair required.');
    if (thread.thread_metadata?.locked) throw Error('Discussion is locked. Unlock the existing thread in Discord before retrying.');
    if (thread.thread_metadata?.archived) await api(`/channels/${id}`, 'PATCH', { archived: false });
    return thread;
  }
  return {
    identity: getIdentity, checkThread,
    /** Channel-mode CoS handoff: confirm the home text channel still exists. */
    async checkChannel(id) {
      const c = await getIdentity();
      if (id !== c.channelId) throw Error('Discussion mapping mismatch. Operator repair required.');
      const channel = await api(`/channels/${id}`);
      if (channel.id !== id || channel.type !== 0 || channel.guild_id !== c.guildId) throw Error('Discussion mapping mismatch. Operator repair required.');
      return channel;
    },
    async ensureThread(parent, message, title) {
      try { return await checkThread(message, parent); }
      catch (e) { if (e.httpStatus !== 404) throw e; }
      // Discord uses source message ID as thread ID: retry cannot create a second thread.
      await api(`/channels/${parent}/messages/${message}/threads`, 'POST', { name: title.slice(0,100), auto_archive_duration: 1440 });
      return checkThread(message, parent);
    },
    async sendMessage(channel, content, nonce) {
      if (content.length > 2000) throw Object.assign(Error('Discussion context exceeds message limit.'), { safeToRetry: true });
      const m = await api(`/channels/${channel}/messages`, 'POST', { content, nonce, enforce_nonce: true, allowed_mentions: { parse: [] }, flags: 4 });
      if (!snowflake(m.id)) throw Error('Discord message receipt missing. Reconcile before resending.');
      return m;
    },
    async findMessage(channel, op) {
      const c = await getIdentity(); let before;
      // Bounded recovery only. Failure to find is not permission to replay.
      for (let page=0; page<20; page++) {
        const rows = await api(`/channels/${channel}/messages?limit=100${before ? `&before=${before}` : ''}`);
        const found = rows.find(m => m.author?.id === c.botId && m.content?.endsWith(`\n${op.marker}`));
        if (found) return found;
        if (!rows.length || rows.length < 100 || Date.parse(rows.at(-1).timestamp) < Date.parse(op.createdAt)-60000) return null;
        before = rows.at(-1).id;
      }
      return null;
    },
    async messages(thread, after) {
      if (!snowflake(thread) || !snowflake(after)) throw Error('Invalid discussion cursor.');
      const rows = await api(`/channels/${thread}/messages?limit=100&after=${after}`);
      if (rows.length === 100) throw Error('Discussion backlog exceeds safe sync window. Operator reconciliation required; cursor was not advanced.');
      return rows.filter(m=>snowflake(m.id) && BigInt(m.id)>BigInt(after)).sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
    },
  };
}
