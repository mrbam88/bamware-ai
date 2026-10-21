// Runner registry. Adding a vendor = one file here that exports
// { name, command({prompt, meta, cwd, env}), sessionFrom(output), answerFrom?(output), modelFrom?(output, {env}), authCheck? }.
import * as claude from './claude.mjs';
import * as codex from './codex.mjs';
import * as opencode from './opencode.mjs';

const ALL = [claude, codex, opencode];

export function adapter(name) {
  const a = ALL.find((x) => x.name === name);
  if (!a) throw new Error(`no runner adapter named ${name}; add services/discord-router/src/runners/${name}.mjs`);
  return a;
}

export function adapterNames() { return ALL.map((a) => a.name); }
