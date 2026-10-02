// Shared DOM renderer: no numerical meter exists for an unknown allowance.
export function renderQuotaMeter(window, doc = document) {
  const wrap = doc.createElement('div');
  wrap.className = `quota-meter quota-${window.state}${window.warning ? ' quota-warning' : ''}`;
  const text = doc.createElement('div');
  text.className = 'rl-detail';
  const used = window.utilizationPct;
  const known = typeof used === 'number' && Number.isFinite(used) && used >= 0 &&
    !['unknown', 'unsupported'].includes(window.state);
  if (!known) {
    text.textContent = window.state === 'stale' ? 'Current usage unknown · awaiting a post-reset reading' : 'Usage unknown · no measured allowance';
    wrap.appendChild(text);
    const placeholder = doc.createElement('div');
    placeholder.className = 'quota-track quota-unknown';
    placeholder.setAttribute('aria-hidden', 'true');
    wrap.appendChild(placeholder);
    return wrap;
  }
  const format = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  const status = window.state === 'exhausted' ? ' · Exhausted' : window.warning ? ' · Warning' : '';
  const label = `${window.state === 'stale' ? 'Last observed: ' : ''}${format(used)}% used · ${format(Math.max(0, 100 - used))}% remaining${status}`;
  text.textContent = label;
  wrap.appendChild(text);
  const meter = doc.createElement('div');
  meter.className = 'quota-track';
  meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-label', `${window.provider || 'Provider'} · ${window.scope || 'quota'} allowance used${window.state === 'stale' ? ' (stale observation)' : ''}`);
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '100');
  meter.setAttribute('aria-valuenow', String(Math.min(100, used)));
  meter.setAttribute('aria-valuetext', label);
  const fill = doc.createElement('span');
  fill.className = 'quota-fill';
  fill.style.width = `${Math.min(100, used)}%`;
  fill.setAttribute('aria-hidden', 'true');
  meter.appendChild(fill);
  wrap.appendChild(meter);
  return wrap;
}
