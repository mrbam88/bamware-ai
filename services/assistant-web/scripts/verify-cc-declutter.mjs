// Browser smoke for CEO-scannable Decision cards (bamware-ai#141).
// All HTTP intercepted — no auth, live writes, Discord, or model calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_CANDIDATES } from '../lib/providers/decision-candidates.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assets = process.env.ASSET_ROOT || fileURLToPath(new URL('../public/', import.meta.url));
const output = process.env.SCREENSHOT_DIR
  || fileURLToPath(new URL('../tests/evidence/cc-declutter/', import.meta.url));
await fs.mkdir(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium',
  headless: true,
});
const errors = [];
let count = 0;

const candidates = [
  DECISION_CANDIDATES.find((d) => d.id === 'brewdesk-first-carousel-72'),
  DECISION_CANDIDATES.find((d) => d.id === 'backlog-triage-view-77'),
].filter(Boolean);
assert.equal(candidates.length, 2);

async function openDeck({ mobile = false } = {}) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 1000 },
  });
  page.on('pageerror', (e) => errors.push(e.message));
  const deck = {
    mode: 'live',
    generatedAt: '2026-10-08T16:00:00Z',
    decisions: structuredClone(candidates),
    coordinator: { status: 'checked', scrumMaster: { assignments: [] } },
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/me') return json({});
    if (url.pathname === '/api/decisions') return json(deck);
    if (route.request().method() === 'POST') {
      return json({ error: 'Fixture write blocked in declutter smoke' }, 503);
    }
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html', 'app.css', 'app.js'].includes(name)) return route.abort();
    return route.fulfill({
      body: await fs.readFile(path.join(assets, name)),
      contentType: name.endsWith('.js')
        ? 'text/javascript'
        : name.endsWith('.css')
          ? 'text/css'
          : 'text/html',
    });
  });
  await page.goto('http://assistant.test/');
  await page.locator(`#decision-${candidates[0].id}`).waitFor();
  return page;
}

/** Text nodes that are on the card face (not inside a closed <details>). */
function faceTextScript(id) {
  return ({ id }) => {
    const card = document.getElementById(`decision-${id}`);
    const walk = (node, inDetails) => {
      let out = '';
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (!inDetails) out += child.textContent;
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = child.tagName;
        if (tag === 'DETAILS') {
          // summary label is face chrome; body is collapsed.
          const sum = child.querySelector(':scope > summary');
          if (sum) out += ` ${sum.textContent} `;
          continue;
        }
        out += walk(child, inDetails);
      }
      return out;
    };
    return walk(card, false).replace(/\s+/g, ' ').trim();
  };
}

try {
  for (const mobile of [false, true]) {
    const page = await openDeck({ mobile });
    const card = page.locator(`#decision-${candidates[0].id}`);

    // Hierarchy markers.
    assert.equal(await card.locator('.dc-title').count(), 1);
    assert.equal(await card.locator('.dc-ask').count(), 1);
    assert.equal(await card.locator('.dc-suggested').count(), 1);
    assert.equal(await card.locator('.dc-option-chip').count(), candidates[0].options.length);
    assert.equal(await card.locator('.dc-actions .dc-selected').count(), 1);
    assert.match(await card.locator('.dc-badge').first().innerText(), /When you can|Needs your OK|Needs you now/);

    // No multi-paragraph context / owner label / owner_* codes on the face.
    const face = await page.evaluate(faceTextScript(candidates[0].id), { id: candidates[0].id });
    assert.doesNotMatch(face, /owner:\s/i);
    assert.doesNotMatch(face, /\bowner_[a-z0-9_]+\b/i);
    assert.doesNotMatch(face, /escalationReason/i);
    assert.doesNotMatch(face, /Server follow-through/i);
    assert.doesNotMatch(face, /LOW URGENCY|HIGH URGENCY|MEDIUM URGENCY/i);
    // Context paragraph lives under Details, not on the face.
    assert.doesNotMatch(face, /immutable asset revision/i);
    assert.ok(face.includes(candidates[0].title));
    assert.ok(face.includes(candidates[0].summary));
    for (const o of candidates[0].options) assert.ok(face.includes(o.label), `missing option ${o.label}`);

    // Screenshot the closed face first (CEO glance), then prove Details expands.
    const shot = path.join(output, `after-${mobile ? 'mobile' : 'desktop'}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    const details = card.locator('details.dc-more').filter({ hasText: 'Details' }).first();
    assert.equal(await details.getAttribute('open'), null);
    await details.locator('summary').click();
    assert.ok(await card.getByText('immutable asset revision', { exact: false }).isVisible());
    await page.screenshot({
      path: path.join(output, `after-${mobile ? 'mobile' : 'desktop'}-details-open.png`),
      fullPage: true,
    });

    // Confirm still posts through the selected option path.
    // (Write is fixture-blocked; we only assert control presence + no page errors.)
    assert.equal(await card.getByRole('button', { name: 'Confirm' }).isVisible(), true);
    assert.equal(await card.getByRole('button', { name: 'Reject' }).isVisible(), true);
    assert.equal(await card.getByRole('button', { name: 'Defer' }).isVisible(), true);

    console.log(`PASS ${++count}: ${mobile ? 'mobile' : 'desktop'} face hierarchy + screenshots → ${shot}`);
    await page.close();
  }

  // Second card: no ticket jargon on face.
  {
    const page = await openDeck();
    const card = page.locator(`#decision-${candidates[1].id}`);
    const face = await page.evaluate(faceTextScript(candidates[1].id), { id: candidates[1].id });
    assert.doesNotMatch(face, /#77|#75|#76|#78|mrbam88\//);
    assert.ok(face.includes('Build a backlog planning view now?'));
    assert.equal(await card.locator('.dc-option-chip').count(), 3);
    console.log(`PASS ${++count}: backlog card face has no ticket jargon`);
    await page.close();
  }

  assert.deepEqual(errors, []);
  console.log(`${count} declutter browser checks passed; no page errors. Screenshots: ${output}`);
} finally {
  await browser.close();
}
