// The first line of every seat reply, asked for by Bilal 2026-10-20:
//   Runner: Claude  Model: Fable 5.1  Agent: Chief of Staff | Scrum Master | NA
// Runner = which CLI answered. Model = what that CLI reported it used.
// Agent = the role the message named (roles are skills), or NA.

const RUNNER_NAMES = { claude: 'Claude', codex: 'Codex', opencode: 'opencode' };
const FAMILIES = { fable: 'Fable', opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', gpt: 'GPT', o: 'o', gemini: 'Gemini', grok: 'Grok', qwen: 'Qwen', kimi: 'Kimi' };

export function displayRunner(name) {
  if (!name) return 'Seat';
  return RUNNER_NAMES[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

/** "claude-fable-5-1[1m]" → "Fable 5.1"; "gpt-6-astra" → "GPT-6 Astra"; "claude-haiku-4-5-20251001" → "Haiku 4.5". */
export function displayModel(id) {
  if (!id) return 'unknown';
  let s = String(id).trim().replace(/\[.*?\]$/, '');
  if (s.includes('/')) s = s.slice(s.lastIndexOf('/') + 1);
  s = s.replace(/^claude-/, '');
  const words = s.split('-').filter((w) => w && !/^\d{8}$/.test(w));
  const out = [];
  for (const w of words) {
    if (/^\d+$/.test(w) && out.length && /\d$/.test(out[out.length - 1])) out[out.length - 1] += `.${w}`;
    else if (/^\d+$/.test(w) && out.length) out[out.length - 1] += `-${w}`; // "GPT" + "6" → "GPT-6"
    else out.push(FAMILIES[w.toLowerCase()] || w.charAt(0).toUpperCase() + w.slice(1));
  }
  // "Fable-5.1" reads better as "Fable 5.1"; keep the dash only for GPT-style names.
  return out.join(' ').replace(/^(Fable|Opus|Sonnet|Haiku|Gemini|Grok|Qwen|Kimi)-/, '$1 ');
}

export function header({ runner, model, agent }) {
  return `Runner: ${displayRunner(runner)}  Model: ${runner ? displayModel(model) : 'none'}  Agent: ${agent || 'NA'}`;
}
