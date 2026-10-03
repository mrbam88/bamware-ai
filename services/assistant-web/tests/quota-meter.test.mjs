import test from 'node:test';
import assert from 'node:assert/strict';
import { renderQuotaMeter } from '../public/quota-meter.js';

const doc = { createElement(tag) { return { tag, children: [], attributes: {}, style: {}, setAttribute(k, v) { this.attributes[k] = String(v); }, appendChild(child) { this.children.push(child); } }; } };
const findMeter = el => el.children.find(c => c.attributes.role === 'meter');

test('visual meter exposes its label, bounded value and used/remaining text', () => {
  const el = renderQuotaMeter({ provider: 'p', scope: 'weekly', utilizationPct: 84, state: 'fresh', warning: true }, doc);
  const meter = findMeter(el);
  assert.equal(meter.attributes['aria-valuenow'], '84');
  assert.equal(meter.attributes['aria-valuemin'], '0');
  assert.equal(meter.attributes['aria-valuemax'], '100');
  assert.match(meter.attributes['aria-label'], /p.*weekly/);
  assert.match(meter.attributes['aria-valuetext'], /84% used.*16% remaining.*Warning/);
  assert.equal(meter.children[0].style.width, '84%');
});

test('missing, invalid, unknown and unsupported readings never render a zero/full meter', () => {
  for (const w of [{ utilizationPct: null, state: 'unknown' }, { utilizationPct: 0, state: 'unsupported' }, { utilizationPct: NaN, state: 'fresh' }, { utilizationPct: null, state: 'stale' }]) {
    const el = renderQuotaMeter(w, doc);
    assert.equal(findMeter(el), undefined);
    assert.match(el.children[0].textContent, /unknown/i);
  }
});

test('stale readings are historical; exhausted bars clamp but retain actual percentages', () => {
  const stale = findMeter(renderQuotaMeter({ utilizationPct: 42, state: 'stale' }, doc));
  assert.match(stale.attributes['aria-valuetext'], /Last observed.*42%/);
  const exhausted = findMeter(renderQuotaMeter({ utilizationPct: 110, state: 'exhausted' }, doc));
  assert.equal(exhausted.attributes['aria-valuenow'], '100');
  assert.match(exhausted.attributes['aria-valuetext'], /110% used.*0% remaining.*Exhausted/);
});
