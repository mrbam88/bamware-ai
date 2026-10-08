// Regression: option chips must lock while a decision action POST is pending
// (bamware-ai#154). Without the lock, a mid-flight chip click can flip the
// displayed selection away from the in-flight choice.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(root, "../public/app.js"), "utf8");
const appCss = fs.readFileSync(path.join(root, "../public/app.css"), "utf8");

test("option chips are native buttons so decisionAction disables them while pending", () => {
  // decisionAction freezes button/select/textarea/input; chips must be buttons.
  assert.match(
    appJs,
    /querySelectorAll\("button, select, textarea, input"\)/,
    "decisionAction must disable native controls while pending",
  );
  assert.match(
    appJs,
    /createElement\("button"\)[\s\S]{0,120}dc-option-chip/,
    "option chips must be <button> elements, not non-disableable list items",
  );
  assert.doesNotMatch(
    appJs,
    /dc-option-chip[\s\S]{0,200}createElement\("li"\)|createElement\("li"\)[\s\S]{0,200}dc-option-chip/,
    "option chips must not be <li role=option> (those stay clickable mid-POST)",
  );
});

test("pick() refuses selection changes while pending/disabled/aria-busy", () => {
  // The #154 repro: submit publish_one, then activate another chip while
  // aria-busy=true — display must stay locked on the in-flight option.
  assert.match(appJs, /selectionLocked\s*=\s*\(\)\s*=>/, "selectionLocked helper required");
  assert.match(
    appJs,
    /decisionActionPending\s*\|\|\s*select\.disabled\s*\|\|\s*li\.getAttribute\("aria-busy"\)\s*===\s*"true"/,
    "lock must cover pending flag, disabled select, and aria-busy card",
  );
  assert.match(appJs, /const pick\s*=\s*\(optionId\)\s*=>\s*\{[\s\S]*?if\s*\(selectionLocked\(\)\)\s*return/, "pick must no-op when locked");
  assert.match(
    appJs,
    /select\.addEventListener\("change",\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(selectionLocked\(\)\)\s*\{[\s\S]*?select\.value\s*=\s*committedOptionId/,
    "select change while locked must restore committed option",
  );
  assert.match(appJs, /committedOptionId/, "in-flight selection must be committed/locked");
});

test("pending chip lock styles keep selected choice readable", () => {
  assert.match(appCss, /\.dc-option-chip\.is-selected:disabled/, "selected locked chip stays visually distinct");
  assert.match(appCss, /\.dc-option-chip:disabled/, "disabled chips show wait cursor");
});

test("decisionAction still sets pending labels and aria-busy (preserves #152 feedback)", () => {
  assert.match(appJs, /button\.textContent\s*=\s*pending/);
  assert.match(appJs, /card\.setAttribute\("aria-busy",\s*"true"\)/);
  assert.match(appJs, /decisionFeedback\("pending"/);
  assert.match(appJs, /decisionFeedback\(outcome\.state\s*\|\|\s*"success"/);
  assert.match(appJs, /decisionFeedback\("error"/);
});
