// Browser UI regression smoke. All HTTP is intercepted: no auth, live writes,
// Discord or model calls. Requires an externally installed playwright-core.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_CANDIDATES } from '../lib/providers/decision-candidates.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assets = process.env.ASSET_ROOT || fileURLToPath(new URL('../public/', import.meta.url));
const output = process.env.SCREENSHOT_DIR || '/tmp/assistant-action-feedback';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium', headless: true });
const errors = [];
let count = 0;
const candidates = [DECISION_CANDIDATES.find(d => d.id === 'brewdesk-first-carousel-72'), DECISION_CANDIDATES.at(-1)];
async function scenario({ action = 'approve', failure = false, errorStatus = 503, repair = false, refreshFailure = false, mode = 'live', mobile = false, discuss = false } = {}) {
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  let posts = [], release;
  const gate = new Promise(resolve => { release = resolve; });
  const deck = { mode, generatedAt: '2026-10-08T16:00:00Z', decisions: structuredClone(candidates), coordinator: { status: 'checked', scrumMaster: { assignments: [] } } };
  if (discuss) deck.decisions[0].options[0].action = 'discuss';
  let changed = false;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/me') return json({});
    if (url.pathname === '/api/decisions') {
      if (changed && refreshFailure) return json({ error: 'Fixture refresh unavailable' }, 503);
      return json(deck);
    }
    if (route.request().method() === 'POST') {
      posts.push({ path: url.pathname, query: url.search, body: route.request().postDataJSON() });
      await gate;
      if (failure) return json({ error: 'Fixture request failed' }, errorStatus);
      changed = true;
      if (url.pathname.endsWith('/discussion')) {
        const discussion = { status: repair ? 'repair_required' : 'ready', detail: repair ? 'Fixture delivery uncertain' : '', threadId: '123' };
        deck.decisions[0].discussion = discussion;
        return json({ discussion, mode });
      }
      const body = posts.at(-1).body;
      deck.decisions[0].response = { ...body, decidedAt: '2026-10-08T16:01:00Z' };
      deck.decisions[0].handoff = { status: body.action === 'approve' ? 'handoff_pending' : 'not_applicable' };
      return json({ decision: deck.decisions[0], mode });
    }
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html', 'app.css', 'app.js'].includes(name)) return route.abort();
    return route.fulfill({ body: await fs.readFile(path.join(assets, name)), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' });
  });
  await page.goto('http://assistant.test/');
  const card = page.locator(`#decision-${candidates[0].id}`);
  await card.waitFor();
  if (process.env.BASELINE_ONLY) {
    await page.screenshot({ path: path.join(output, `before-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
    await page.close(); return;
  }
  assert.equal(await page.locator('#decisionList > li').first().getAttribute('id'), `decision-${candidates[0].id}`);
  if (!mobile) assert.equal(await page.getByText('Last sweep:', { exact: false }).isVisible(), false);
  const note = card.getByRole('textbox', { name: 'Optional note' });
  await note.fill('Keep this note');
  const button = action === 'send' ? card.locator('.dc-discussion button').first() : card.locator(`.dc-${action === 'approve' ? 'selected' : action}`);
  if (!failure && !repair && !refreshFailure && action === 'approve' && !discuss && mode === 'live') await page.screenshot({ path: path.join(output, `after-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
  await button.click();
  await page.locator('.dc-feedback[data-state="pending"]').waitFor();
  assert.equal(await card.getAttribute('aria-busy'), 'true');
  assert.equal(await page.locator('#decisionsView button:enabled, #decisionsView select:enabled, #decisionsView textarea:enabled, #decisionsView input:enabled').count(), 0);
  // Option chips are native buttons: disabled while pending, selection locked
  // against mouse / keyboard / programmatic activation (bamware-ai#154).
  const lockCheck = await page.evaluate((cardId) => {
    const card = document.getElementById(cardId);
    const locked = card.querySelector('.dc-option-chip.is-selected');
    const lockedId = locked?.dataset.optionId || null;
    const other = [...card.querySelectorAll('.dc-option-chip')].find((c) => c.dataset.optionId !== lockedId) || null;
    const select = card.querySelector('.dc-select-sr');
    if (other) {
      other.click();
      other.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      other.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      other.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    }
    if (select && other) {
      select.value = other.dataset.optionId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return {
      lockedId,
      selectedAfter: card.querySelector('.dc-option-chip.is-selected')?.dataset.optionId || null,
      selectAfter: select?.value || null,
      otherDisabled: other ? other.disabled === true : false,
      selectedDisabled: locked ? locked.disabled === true : false,
      chipCount: card.querySelectorAll('.dc-option-chip').length,
    };
  }, `decision-${candidates[0].id}`);
  assert.ok(lockCheck.chipCount >= 2, 'card needs option chips for lock regression');
  assert.ok(lockCheck.lockedId);
  assert.equal(lockCheck.otherDisabled, true);
  assert.equal(lockCheck.selectedDisabled, true);
  assert.equal(lockCheck.selectedAfter, lockCheck.lockedId);
  assert.equal(lockCheck.selectAfter, lockCheck.lockedId);
  // Programmatic duplicate events exercise the guard in addition to disabled UI.
  await button.dispatchEvent('click');
  await page.locator('#decisionsRefresh').dispatchEvent('click');
  assert.equal(posts.length, 1);
  assert.match(await button.innerText(), /…$/);
  if (action === 'approve' && !failure && !discuss && !mobile && mode === 'live') await page.screenshot({ path: path.join(output, 'pending.png'), fullPage: true });
  release();
  const state = failure || (repair && !discuss) ? 'error' : refreshFailure || (repair && discuss) ? 'warning' : 'success';
  await page.locator(`.dc-feedback[data-state="${state}"]`).waitFor();
  await page.waitForFunction(() => !document.getElementById('decisionsRefresh').disabled);
  const text = await page.locator('.dc-feedback').innerText();
  if (failure || (repair && !discuss)) {
    assert.equal(await note.inputValue(), 'Keep this note');
    assert.equal(await button.isEnabled(), true);
    assert.match(text, /Refresh/);
  } else if (refreshFailure) {
    assert.match(text, /could not refresh/i);
  } else if (action === 'send') {
    assert.match(text, /Sent to #command-center. Not execution approval/);
    assert.equal(await card.getByRole('button', { name: 'Resend / repair' }).isVisible(), true);
  } else {
    assert.equal(await card.locator('.dc-answer').count(), 1);
    assert.equal(await card.locator('.dc-actions').count(), 0);
    assert.equal(posts[0].body.action, discuss ? 'discuss' : action);
    assert.equal(posts[0].body.note, 'Keep this note');
    assert.equal(posts[0].body.candidateVersion, candidates[0].version);
    if (discuss) assert.equal(posts.length, 2);
  }
  if (mode === 'demo') assert.equal(posts[0].query, '?mode=demo');
  if (mobile) assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(output, `${action}-${state}${mobile ? '-mobile' : ''}${discuss ? '-discuss' : ''}.png`), fullPage: true });
  console.log(`PASS ${++count}: ${action} ${state} ${mode}${mobile ? ' mobile' : ''}${discuss ? ' selected-discuss' : ''}`);
  await page.close();
}
try {
  if (process.env.BASELINE_ONLY) { await scenario(); await scenario({ mobile: true }); }
  else {
    for (const action of ['approve', 'reject', 'defer', 'send']) {
      await scenario({ action });
      await scenario({ action, failure: true });
    }
    await scenario({ action: 'send', repair: true });
    await scenario({ failure: true, errorStatus: 409 });
    await scenario({ failure: true, errorStatus: 401 });
    await scenario({ refreshFailure: true });
    await scenario({ mode: 'demo' });
    await scenario({ mobile: true });
    await scenario({ discuss: true });
    await scenario({ discuss: true, repair: true });
    assert.deepEqual(errors, []);
    console.log(`${count} browser scenarios passed; no page errors. Screenshots: ${output}`);
  }
} finally { await browser.close(); }
