// Discord wiring for the seat. Only Bilal's user ID, only the home channel and its threads.
import { Client, GatewayIntentBits, Partials, AttachmentBuilder, ChannelType } from 'discord.js';
import { paths, loadDiscordEnv } from './config.mjs';
import { Seat } from './seat.mjs';
import { run } from './spawn.mjs';
import { deliver as deliverChunks } from './reply.mjs';

const env = loadDiscordEnv();
const P = paths(env);
const USER = env.DISCORD_USER_ID;
const HOME = env.DISCORD_HOME_CHANNEL || env.DISCORD_ASSISTANT_CHANNEL;
const CRON = env.DISCORD_CRON_CHANNEL;

for (const [k, v] of Object.entries({ DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN, DISCORD_USER_ID: USER, DISCORD_HOME_CHANNEL: HOME })) {
  if (!v) { console.error(`discord-router: ${k} missing (set it in ~/.config/bamware/discord.env)`); process.exit(2); }
}

const seat = new Seat({ paths: P, env });
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

function inScope(message) {
  const ch = message.channel;
  if (ch.id === HOME) return { channelId: HOME, threadId: null };
  if (ch.isThread && ch.isThread() && ch.parentId === HOME) return { channelId: HOME, threadId: ch.id };
  return null;
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.author.id !== USER) { console.error(`[seat] ignored message from ${message.author.id}`); return; }
  const scope = inScope(message);
  if (!scope) return;
  const typing = setInterval(() => message.channel.sendTyping().catch(() => {}), 8000);
  message.channel.sendTyping().catch(() => {});
  try {
    const res = await seat.handle({ text: message.content, authorId: message.author.id, epochMs: message.createdTimestamp, ...scope });
    await deliverChunks(message.channel, res.text, res.footer, (body) => new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: 'reply.md' }), res.header);
  } catch (err) {
    console.error('[seat] error', err);
    await message.channel.send({ content: `Seat error: ${String(err.message || err).slice(0, 500)}` }).catch(() => {});
  } finally {
    clearInterval(typing);
  }
});

async function loginSweep() {
  try {
    const { dead, changed } = await seat.checkLogins();
    if (changed && CRON) {
      const ch = await client.channels.fetch(CRON).catch(() => null);
      const names = Object.entries(dead).map(([k, v]) => `${k} (${v})`).join(', ') || 'none';
      if (ch && ch.type === ChannelType.GuildText) await ch.send({ content: `discord-router login check: dead runners: ${names}` });
    }
  } catch (err) { console.error('[seat] login sweep failed', err); }
}

client.once('ready', async () => {
  console.error(`[seat] ready as ${client.user.tag}; home ${HOME}; repo ${P.repo}`);
  await loginSweep();
  setInterval(loginSweep, 30 * 60 * 1000);
});

if (process.argv[1] && process.argv[1].endsWith('bot.mjs')) {
  client.login(env.DISCORD_BOT_TOKEN).catch((err) => { console.error('discord-router: login failed', err.message); process.exit(1); });
}

export { run };
