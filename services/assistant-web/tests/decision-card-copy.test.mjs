// CEO-facing Decision card copy contract (bamware-ai#141).
// Face fields must stay scannable; escalationReason/owner_* stay off the face.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DECISION_CANDIDATES } from "../lib/providers/decision-candidates.mjs";
import { DEMO_DECISION_CANDIDATES } from "../lib/providers/decision-candidates-demo-fixtures.mjs";
import { assertValidCandidate } from "../lib/decisions.mjs";

const JARGON = /\bowner_[a-z0-9_]+\b|escalationReason|handoff_pending|candidateVersion/i;
const TICKETISH = /#\d{2,}|mrbam88\//i;
const WORDY = (s, max) => String(s || "").trim().split(/\s+/).filter(Boolean).length <= max;

function faceFields(c) {
  return {
    title: c.title,
    summary: c.summary || "",
    labels: (c.options || []).map((o) => o.label),
  };
}

test("every curated candidate has a CEO-scannable face (title/summary/options)", () => {
  assert.ok(DECISION_CANDIDATES.length >= 1);
  for (const c of DECISION_CANDIDATES) {
    assertValidCandidate(c);
    assert.ok(c.summary, `${c.id} needs a summary for the card ask`);
    assert.ok(WORDY(c.title, 14), `${c.id} title too long for a scan: ${c.title}`);
    assert.ok(WORDY(c.summary, 24), `${c.id} summary too long: ${c.summary}`);
    assert.ok(c.options.length >= 2 && c.options.length <= 4, `${c.id} wants 2–3 options`);
    for (const o of c.options) {
      assert.ok(WORDY(o.label, 10), `${c.id} option label too long: ${o.label}`);
      assert.doesNotMatch(o.label, JARGON);
      assert.doesNotMatch(o.label, TICKETISH);
    }
    const face = faceFields(c);
    assert.doesNotMatch(face.title, JARGON);
    assert.doesNotMatch(face.summary, JARGON);
    assert.doesNotMatch(face.title, TICKETISH);
    assert.doesNotMatch(face.summary, TICKETISH);
    // escalationReason may exist internally but must never be a face field.
    assert.ok(!Object.prototype.hasOwnProperty.call(face, "escalationReason"));
    if (c.escalationReason) assert.match(c.escalationReason, /^[a-z0-9_]+$/);
  }
});

test("demo fixture face is also plain-language (no ticket jargon)", () => {
  for (const c of DEMO_DECISION_CANDIDATES) {
    assertValidCandidate(c);
    assert.ok(c.summary);
    assert.doesNotMatch(c.title + c.summary, JARGON);
    for (const o of c.options) assert.doesNotMatch(o.label, TICKETISH);
  }
});

test("card-face copy contract: active sample cards stay under a 10s glance budget", () => {
  // Rough word budget for what the UI shows before opening Details:
  // title + status chip + summary + suggested label + option labels.
  const active = DECISION_CANDIDATES.filter((c) =>
    ["brewdesk-first-carousel-72", "backlog-triage-view-77", "auth-atomic-docker-access-85"].includes(c.id),
  );
  assert.equal(active.length, 3);
  for (const c of active) {
    const suggested = c.options.find((o) => o.id === c.recommendation?.optionId)?.label || "";
    const faceWords = [c.title, c.summary, suggested, ...c.options.map((o) => o.label)]
      .join(" ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    assert.ok(faceWords <= 55, `${c.id} face word count ${faceWords} exceeds scan budget`);
    assert.ok(!String(c.context).split(/\n/).some((line) => false)); // context stays off face by contract
    assert.notEqual(c.summary, c.context);
  }
});
