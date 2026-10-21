// Headroom per runner from the CFO's capacity.json. Pure: takes the parsed doc.
//
// capacity.json (services/cfo/burn_alert.py publish_capacity):
//   { generated_at, pools: [{ key, label, used_pct, stale, reset_at, window_min, ... }], sources }
// A runner's pools are prefixes matched against pool.key or pool.label (case-insensitive).
// Headroom is the tightest window: min(100 - used_pct) over fresh matching pools.

export function poolsFor(runner, doc) {
  const pools = (doc && doc.pools) || [];
  const prefixes = (runner.pools || []).map((p) => p.toLowerCase());
  return pools.filter((p) => {
    const key = String(p.key || '').toLowerCase();
    const label = String(p.label || '').toLowerCase();
    return prefixes.some((x) => key.startsWith(x) || label.includes(x));
  });
}

/** @returns {{pct: number|null, unknown: boolean, stale: boolean, reset_at: number|null}} */
export function headroom(runner, doc) {
  const matched = poolsFor(runner, doc);
  if (!matched.length) return { pct: null, unknown: true, stale: false, reset_at: null };
  const fresh = matched.filter((p) => !p.stale && typeof p.used_pct === 'number');
  if (!fresh.length) return { pct: null, unknown: true, stale: true, reset_at: null };
  let pct = Infinity;
  let reset = null;
  for (const p of fresh) {
    const h = Math.max(0, 100 - p.used_pct);
    if (h < pct) {
      pct = h;
      reset = p.reset_at ?? null;
    }
  }
  return { pct: Math.round(pct * 10) / 10, unknown: false, stale: false, reset_at: reset };
}

/** One-line footer: "Budget left this cycle: Claude 4% left · Codex 68% left · Copilot (via opencode) ?%" (share of each plan's allowance still unused; bold = who answered). */
const BUDGET_NAMES = { claude: 'Claude', codex: 'Codex', opencode: 'Copilot (via opencode)' };

export function footer(runners, doc, chosen) {
  return 'Budget left this cycle: ' + runners.order
    .map((r) => {
      const h = headroom(r, doc);
      const v = h.unknown ? '?%' : `${Math.round(h.pct)}% left`;
      const label = BUDGET_NAMES[r.name] || r.name;
      return r.name === chosen ? `**${label}** ${v}` : `${label} ${v}`;
    })
    .join(' · ');
}
