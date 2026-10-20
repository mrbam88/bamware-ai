// Config for the seat. Everything that decides *which* runner lives in the
// CFO's config/model-routing.yaml (runners: section); the seat only reads it.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const HOME = homedir();
const STATE = path.join(HOME, '.local', 'state', 'bamware');

export const DEFAULTS = {
  floor_pct: 10,
  cooldown_min: 60,
  order: [
    { name: 'claude', pools: ['claude'] },
    { name: 'codex', pools: ['openai-codex'] },
    { name: 'opencode', pools: ['copilot'] },
  ],
};

export function paths(env = process.env) {
  const repo = env.BAMWARE_REPO || path.join(HOME, 'code', 'worktrees', 'bamware-ai-main');
  return {
    repo,
    routing: env.BAMWARE_ROUTING || path.join(repo, 'config', 'model-routing.yaml'),
    capacity: env.BAMWARE_CFO_CAPACITY || path.join(STATE, 'cfo', 'capacity.json'),
    halt: env.BAMWARE_CFO_HALT || path.join(STATE, 'cfo', 'halt.json'),
    state: env.BAMWARE_ROUTER_STATE || path.join(STATE, 'discord-router'),
    board: env.BAMWARE_BOARD_CACHE || path.join(STATE, 'board', 'latest.json'),
    overnight: env.BAMWARE_OVERNIGHT_STATE || path.join(STATE, 'overnight'),
  };
}

/** The runners: section of model-routing.yaml, with defaults filled in. */
export function loadRunners(routingPath) {
  let doc = {};
  try {
    doc = parseYaml(readFileSync(routingPath, 'utf8')) || {};
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const r = doc.runners || {};
  return {
    floor_pct: Number(r.floor_pct ?? DEFAULTS.floor_pct),
    cooldown_min: Number(r.cooldown_min ?? DEFAULTS.cooldown_min),
    order: (r.order && r.order.length ? r.order : DEFAULTS.order).map((x) => ({
      name: String(x.name),
      pools: (x.pools || []).map(String),
    })),
  };
}

/** Discord env from ~/.config/bamware/discord.env (KEY=value lines) merged under process.env. */
export function loadDiscordEnv(env = process.env) {
  const file = env.BAMWARE_DISCORD_ENV || path.join(HOME, '.config', 'bamware', 'discord.env');
  const out = { ...env };
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)=(.*)$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in out)) out[m[1]] = v;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return out;
}
