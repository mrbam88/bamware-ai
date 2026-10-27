// The seat's one job, as a function: message in → { header, text, runner, footer }.
// No Discord here, so it is testable; bot.mjs wires it to discord.js.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadRunners } from './config.mjs';
import { footer } from './headroom.mjs';
import { pick, parseForce, looksRateLimited, coolDown } from './router.mjs';
import { Notes, sessionKey, buildPrompt, roleIn, isStandup, STANDUP_ROLES } from './handoff.mjs';
import { header } from './header.mjs';
import { adapter } from './runners/index.mjs';
import { run } from './spawn.mjs';
import { parseDispatch, manifestFor, writeManifest, boardItemFor, claimCommands, executorCommand, BOARD } from './dispatch.mjs';

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

/** The Agent slot of the header: the role the message named, the standup roster, or NA. */
export function agentFor(text) {
  if (isStandup(text)) return `Standup: ${STANDUP_ROLES.map((r) => r.role).join(' | ')}`;
  return roleIn(text) || 'NA';
}

export class Seat {
  constructor({ paths, env = process.env, runFn = run, now = () => Math.floor(Date.now() / 1000), log = console.error }) {
    this.paths = paths;
    this.env = env;
    this.run = runFn;
    this.now = now;
    this.log = log;
    this.notes = new Notes(paths.state);
    this.stateFile = path.join(paths.state, 'router-state.json');
    this.state = readJson(this.stateFile) || { cooldowns: {}, dead: {} };
    this.state.models = this.state.models || {};
  }

  saveState() {
    mkdirSync(this.paths.state, { recursive: true, mode: 0o700 });
    writeFileSync(this.stateFile, JSON.stringify(this.state, null, 1) + '\n', { mode: 0o600 });
  }

  runners() { return loadRunners(this.paths.routing); }
  capacity() { return readJson(this.paths.capacity); }
  halt() { return readJson(this.paths.halt); }

  /** @param {{text:string, channelId:string, threadId?:string|null, kind?:'home'|'interviews', authorId:string, epochMs?:number}} msg */
  async handle(msg, { onProgress } = {}) {
    const runners = this.runners();
    const capacity = this.capacity();
    const halt = this.halt();
    const { forced, text } = parseForce(msg.text, runners);
    const key = sessionKey({ channelId: msg.channelId, threadId: msg.threadId, epochMs: msg.epochMs });

    const dispatch = parseDispatch(text);
    if (dispatch) return this.dispatch(dispatch, { msg, halt, runners, capacity, key });

    const choice = pick({ runners, capacity, halt, forced, state: this.state, now: this.now() });
    const seatHeader = header({ runner: null, agent: agentFor(text) });
    if (choice.kind === 'halt') return { header: seatHeader, text: `CFO halt: ${choice.reason}. Nothing runs until the CFO lifts it.`, runner: null, footer: footer(runners, capacity) };
    if (choice.kind === 'dead') return { header: seatHeader, text: `${choice.runner} is logged out on the server (${choice.reason}). Pick another with !codex / !claude / !opencode, or log it in.`, runner: null, footer: footer(runners, capacity) };
    if (choice.kind === 'queued') {
      const when = choice.reset_at ? `earliest reset ${new Date(choice.reset_at * 1000).toISOString()}` : 'no reset time known';
      return { header: seatHeader, text: `Every pool is under the floor (${runners.floor_pct}%). Queued; ${when}.`, runner: null, footer: footer(runners, capacity) };
    }

    const a = adapter(choice.runner);
    const meta = this.notes.meta(key)[a.name] || {};
    const standup = isStandup(text);
    const prompt = buildPrompt({ note: this.notes.read(key), ask: text, role: roleIn(text), standup, kind: msg.kind || 'home' });
    const { argv, meta: nextMeta } = a.command({ prompt, meta, cwd: this.paths.repo, env: this.env });
    this.log(`[seat] ${key} → ${a.name} (${choice.reason})`);
    if (onProgress) onProgress(`${a.name === 'claude' ? 'Claude' : a.name === 'codex' ? 'Codex' : a.name} is working on it`);

    const res = await this.run(argv, { cwd: this.paths.repo, env: this.env });
    if (looksRateLimited(res.output, res.code)) {
      this.state = coolDown(this.state, a.name, runners, this.now());
      this.saveState();
      this.log(`[seat] ${a.name} rate-limited; cooling down ${runners.cooldown_min} min`);
      if (!forced) return this.handle({ ...msg, text: `${text}` }, { onProgress });
      return { header: header({ runner: a.name, model: this.state.models[a.name], agent: agentFor(text) }), text: `${a.name} is rate-limited; cooled down for ${runners.cooldown_min} min.`, runner: a.name, footer: footer(runners, capacity, a.name) };
    }
    const hung = res.timedOut && !(a.answerFrom ? a.answerFrom(res.output) : res.output).trim();
    if (hung) {
      // A runner that hangs until the hard timeout with nothing to show is benched like a
      // rate-limited one (2026-10-27: opencode hung on every message for a day).
      this.state = coolDown(this.state, a.name, runners, this.now());
      this.saveState();
      this.log(`[seat] ${a.name} timed out with no output; cooling down ${runners.cooldown_min} min`);
      if (!forced) return this.handle(msg, { onProgress });
      return { header: header({ runner: a.name, model: this.state.models[a.name], agent: agentFor(text) }), text: `${a.name} timed out with no output; cooled down for ${runners.cooldown_min} min.`, runner: a.name, footer: footer(runners, capacity, a.name) };
    }
    const sid = a.sessionFrom(res.output);
    this.notes.setMeta(key, { [a.name]: { ...nextMeta, ...(sid ? { sessionId: sid } : {}) } });
    const answer = (a.answerFrom ? a.answerFrom(res.output) : res.output).trim() || (res.timedOut ? '(timed out with no output)' : '(no output)');
    this.notes.append(key, { runner: a.name, ask: text, answer });
    const model = (a.modelFrom ? a.modelFrom(res.output, { env: this.env }) : null) || this.state.models[a.name] || null;
    if (model && model !== this.state.models[a.name]) { this.state.models[a.name] = model; this.saveState(); }
    const status = res.code === 0 ? '' : ` · exit ${res.code}${res.timedOut ? ' (timeout)' : ''}`;
    return { header: header({ runner: a.name, model, agent: agentFor(text) }), text: answer, runner: a.name, footer: `${footer(runners, capacity, a.name)}${status}` };
  }

  async dispatch(d, { msg, halt, runners, capacity, key }) {
    const h = header({ runner: null, agent: 'Dispatcher' });
    if (halt && halt.halted) return { header: h, text: `CFO halt: ${halt.reason || 'on'}. Not dispatching ${d.ticket}.`, runner: null, footer: footer(runners, capacity) };
    const manifest = manifestFor({ ticket: d.ticket, requestedBy: msg.authorId });
    const file = writeManifest(this.paths.state, manifest);
    const itemId = boardItemFor(this.paths.board, d.repo, d.number);
    const lines = [];
    for (const argv of claimCommands({ repo: d.repo, number: d.number, itemId, project: BOARD })) {
      const r = await this.run(argv, { cwd: this.paths.repo, env: this.env, timeoutMs: 60_000 });
      lines.push(`${argv.slice(0, 3).join(' ')}: ${r.code === 0 ? 'ok' : `exit ${r.code}`}`);
    }
    const r = await this.run(executorCommand({ repo: this.paths.repo, manifestFile: file, overnightState: this.paths.overnight }), { cwd: this.paths.repo, env: this.env, timeoutMs: 120_000 });
    lines.push(`executor start: ${r.code === 0 ? 'ok' : `exit ${r.code}`}${r.output ? `\n${r.output.trim().slice(-600)}` : ''}`);
    const text = `Dispatched ${d.ticket} to the Overnight executor.\n${lines.join('\n')}\nProgress lands in #cron; I post the finish line here.`;
    this.notes.append(key, { runner: 'executor', ask: msg.text, answer: text });
    return { header: h, text, runner: 'executor', footer: footer(runners, capacity) };
  }

  /** Login health: mark a runner dead when its auth check matches its dead pattern. */
  async checkLogins() {
    const runners = this.runners();
    const dead = {};
    for (const r of runners.order) {
      let a;
      try { a = adapter(r.name); } catch { dead[r.name] = 'no adapter'; continue; }
      if (!a.authCheck) continue;
      const res = await this.run(a.authCheck.argv, { cwd: this.paths.repo, env: this.env, timeoutMs: 30_000 });
      if (res.code === 127) dead[r.name] = 'not installed';
      else if (a.authCheck.deadPattern.test(res.output)) dead[r.name] = 'logged out';
    }
    const changed = JSON.stringify(dead) !== JSON.stringify(this.state.dead || {});
    this.state.dead = dead;
    this.saveState();
    return { dead, changed };
  }
}
