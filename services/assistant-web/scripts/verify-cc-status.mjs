// Read-only browser fixtures: intercept EVERY request, never contact production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_CANDIDATES } from '../lib/providers/decision-candidates.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assets = process.env.ASSET_ROOT || fileURLToPath(new URL('../public/', import.meta.url));
const output = process.env.SCREENSHOT_DIR || '/tmp/cc-status-141-evidence';
await fs.mkdir(output, { recursive: true });
const base = DECISION_CANDIDATES.find(d => d.id === 'brewdesk-first-carousel-72');
const response = { action: 'approve', selectedOptionId: base.options[0].id, note: 'Fixture recorded note', decidedAt: '2026-10-08T16:00:00Z' };
const card = (id, title, extra = {}) => ({ ...structuredClone(base), id, title, ...extra });
const approved = { response, handoff: { status: 'handoff_pending' }, handoffCheck: { status: 'completed', summary: 'Coordination check only. No worker dispatched.' } };
const mixed = {
  mode: 'live', generatedAt: '2026-10-08T16:00:00Z',
  decisions: [
    card('awaiting', 'Review the first carousel'),
    card('approved', 'Carousel follow-through', approved),
    card('working', 'Backlog implementation', { response, handoff: { status: 'pickup_confirmed', receiptId: 'fixture' } }),
    card('completed', 'Worker handoff finished', { response, handoff: { status: 'completed' } }),
    card('error', 'Delivery needs attention', { ...approved, handoffCheck: { status: 'failed', error: 'Fixture source check failed. Review details before retrying.' } }),
    card('deferred', 'Deferred planning decision', { response: { ...response, action: 'defer' }, handoff: { status: 'not_applicable' } }),
    card('rejected', 'Rejected proposal', { response: { ...response, action: 'reject' }, handoff: { status: 'not_applicable' } }),
  ],
  history: [card('resolved', 'Permission blocker resolved', { response, handoff: { status: 'handoff_pending' }, resolution: { status: 'resolved', reason: 'This specific blocker is resolved; downstream rollout is separate.', evidence: { ref: 'https://example.com/fixture-evidence' } } })],
  coordinator: { status: 'checked', scrumMaster: { assignments: [] } },
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium', headless: true });
const errors = [];
async function open(deck, width = 1280, hash = '') {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    assert.notEqual(route.request().method(), 'POST', 'no fixture mutation expected');
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/me') return json({});
    if (url.pathname === '/api/decisions') return json(deck);
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html', 'app.css', 'app.js'].includes(name)) return route.abort();
    return route.fulfill({ body: await fs.readFile(path.join(assets, name)), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' });
  });
  await page.goto(`http://assistant.test/${hash}`);
  await page.locator('#decisionList > li').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('.dc-loading'));
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
try {
  for (const width of [1280, 390, 320]) {
    const size = width === 1280 ? 'desktop' : `mobile-${width}`;
    const page = await open(mixed, width);
    if (process.env.BASELINE_ONLY) { await shot(page, `mixed-before-${size}`); await page.close(); continue; }
    for (const [id, state, label] of [
      ['awaiting', 'awaiting', /When you can/], ['approved', 'working', /awaiting worker/],
      ['working', 'working', /Worker picked/], ['error', 'error', /needs attention/], ['deferred', 'paused', /still open/],
    ]) {
      const c = page.locator(`#decision-${id}`);
      assert.equal(await c.isVisible(), true);
      assert.equal(await c.getAttribute('data-state'), state);
      assert.match(await c.locator('.dc-state-badge').innerText(), label);
    }
    assert.equal(await page.locator('#decisionList > li').first().getAttribute('id'), 'decision-error');
    assert.equal(await page.locator('#decision-approved .dc-ask').isVisible(), false);
    assert.equal(await page.locator('#decision-error .dc-status-detail').isVisible(), true);
    assert.equal(await page.locator('#decision-completed').isVisible(), false);
    assert.equal(await page.locator('#decision-resolved').isVisible(), false);
    assert.equal(await page.locator('#decision-rejected').isVisible(), false);
    const surfaces = await page.locator('#decision-awaiting, #decision-approved, #decision-error, #decision-deferred').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).backgroundColor));
    assert.equal(new Set(surfaces).size, 4, 'full card surfaces must differ, not just borders');
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(await overflow(), false);
    await shot(page, `mixed-after-${size}`);
    if (width === 1280) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: 'deuteranopia' });
      await shot(page, 'mixed-after-deuteranopia');
      await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: 'none' });
      await cdp.detach();
    }
    const summary = page.locator('.dc-history-disclosure > summary');
    assert.match(await summary.innerText(), /History \(3\)/);
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#decision-resolved').isVisible(), true);
    assert.equal(await page.locator('#decision-resolved').getAttribute('data-state'), 'resolved');
    const contrast = await page.locator('.dc-state-badge').evaluateAll(nodes => {
      const luminance = color => {
        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
          const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
        });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      return nodes.map(node => {
        const style = getComputedStyle(node);
        const fg = luminance(style.color), bg = luminance(style.backgroundColor);
        return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
      });
    });
    assert.ok(contrast.every(ratio => ratio >= 4.5), `status label contrast: ${contrast}`);
    assert.equal(await page.locator('.dc-history button, .dc-history textarea').count(), 0, 'history is read-only');
    assert.match(await page.locator('#decision-rejected .dc-state-badge').innerText(), /Rejected/);
    const details = page.locator('#decision-resolved .dc-more > summary');
    await details.focus();
    await page.keyboard.press('Space');
    assert.equal(await page.getByRole('link', { name: 'Resolution source' }).isVisible(), true);
    assert.equal(await page.locator('#decision-resolved').getByText('Note: Fixture recorded note', { exact: true }).isVisible(), true);
    assert.equal(await overflow(), false);
    await shot(page, `history-after-${size}`);
    await summary.focus(); await page.keyboard.press('Space');
    assert.equal(await page.locator('#decision-resolved').isVisible(), false);
    // Real keyboard option selection + visible focus (pending is covered by the
    // separate 16-scenario action suite, including synthetic duplicate events).
    const chip = page.locator('#decision-awaiting .dc-option-chip').nth(1);
    await chip.focus(); await page.keyboard.press('Space');
    assert.equal(await chip.getAttribute('aria-pressed'), 'true');
    assert.notEqual(await chip.evaluate(n => getComputedStyle(n).outlineStyle), 'none');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#decision-awaiting .dc-option-chip').nth(2).evaluate(n => n === document.activeElement), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.dot').evaluate(n => getComputedStyle(n).animationName), 'none');
    console.log(`PASS mixed states / history / keyboard / overflow: ${size}`);
    await page.close();
  }
  if (!process.env.BASELINE_ONLY) {
    const page = await open({ mode: 'live', decisions: [], history: mixed.history });
    assert.match(await page.locator('.dc-empty').innerText(), /Board clear/);
    assert.equal(await page.locator('#decisionList > [id^="decision-"]').count(), 0);
    await shot(page, 'empty-after-desktop'); await page.close();
    const empty = await open({ mode: 'live', decisions: [] }, 390);
    assert.equal(await empty.locator('.dc-empty').isVisible(), true);
    await shot(empty, 'empty-after-mobile'); await empty.close();
    const deep = await open(mixed, 390, '#decision=resolved');
    assert.equal(await deep.locator('#decision-resolved').isVisible(), true);
    await deep.close();
    const runtime = await open({ mode: 'live', decisions: [], coordinator: { currentRuntimeFailure: { detail: 'Fixture runtime failure' } } });
    assert.equal(await runtime.getByRole('alert').isVisible(), true);
    await runtime.close();
    const partial = await open({ mode: 'live', decisions: [], coordinator: { status: 'partial', failures: ['fixture'] } });
    assert.equal(await partial.getByRole('alert').isVisible(), true);
    await partial.close();
    assert.deepEqual(errors, []);
    console.log('PASS empty, history-only, deep-link, runtime failure; no page errors.');
  }
} finally { await browser.close(); }
