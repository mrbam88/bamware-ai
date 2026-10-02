import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RATE_LIMIT_CONTRACT_VERSION,
  RATE_LIMIT_STATES,
  buildWindow,
  buildSnapshot,
  deriveUtilizationPct,
  unsupportedWindow,
  wrapSyntheticAdapter,
  formatResetLabel,
} from "../lib/rate-limits.mjs";
import { claudeMaxAdapter, CLAUDE_MAX_UNSUPPORTED_REASON } from "../lib/providers/claude-max-adapter.mjs";
import {
  demoAdapter,
  freshWindowFixture,
  staleWindowFixture,
  exhaustedWindowFixture,
  unknownWindowFixture,
  resetTransitionWindowFixture,
  postResetFreshWindowFixture,
} from "../lib/providers/demo-adapter.mjs";

const NOW = Date.parse("2026-10-02T12:00:00Z");

test("deriveUtilizationPct handles missing/zero inputs without throwing", () => {
  assert.equal(deriveUtilizationPct(500, 1000), 50);
  assert.equal(deriveUtilizationPct(null, 1000), null);
  assert.equal(deriveUtilizationPct(500, null), null);
  assert.equal(deriveUtilizationPct(500, 0), null);
  assert.equal(deriveUtilizationPct(undefined, undefined), null);
});

test("fresh usage: recent reading, comfortably under limit", () => {
  const raw = { ...freshWindowFixture(NOW), source: { ...freshWindowFixture(NOW).source, kind: "live" } };
  const w = buildWindow(raw, { now: NOW });
  assert.equal(w.state, "fresh");
  assert.equal(w.warning, false);
  assert.equal(w.usedTokens, 1_200_000);
  assert.equal(w.utilizationPct, 24);
  assert.equal(w.source.kind, "live");
});

test("a reading with an unrecognized/missing source.kind is treated as unsupported, never silently trusted", () => {
  const w = buildWindow(freshWindowFixture(NOW), { now: NOW });
  assert.equal(w.state, "unsupported");
  assert.equal(w.usedTokens, null);
});

test("stale data: reading older than the staleness threshold", () => {
  const raw = { ...staleWindowFixture(NOW), source: { ...staleWindowFixture(NOW).source, kind: "live" } };
  const w = buildWindow(raw, { now: NOW, staleAfterSec: 15 * 60 });
  assert.equal(w.state, "stale");
  assert.ok(w.freshnessSec > 15 * 60);
});

test("near-exhausted: utilization crosses the warning threshold but window is still fresh", () => {
  const raw = {
    provider: "demo", scope: "5h-window", usedTokens: 4_200_000, limitTokens: 5_000_000,
    resetAt: new Date(NOW + 60 * 60_000).toISOString(), resetTimezone: "UTC",
    source: { kind: "live", label: "x", fetchedAt: new Date(NOW - 60_000).toISOString() },
  };
  const w = buildWindow(raw, { now: NOW });
  assert.equal(w.state, "fresh");
  assert.equal(w.warning, true, "84% utilization should warn");
});

test("exhausted: usage at or over the limit", () => {
  const raw = { ...exhaustedWindowFixture(NOW), source: { ...exhaustedWindowFixture(NOW).source, kind: "live" } };
  const w = buildWindow(raw, { now: NOW });
  assert.equal(w.state, "exhausted");
  assert.equal(w.warning, true);
  assert.equal(w.utilizationPct, 100);
});

test("unknown: provider reported but no numeric reading ever collected", () => {
  const raw = { ...unknownWindowFixture(NOW), source: { ...unknownWindowFixture(NOW).source, kind: "live" } };
  const w = buildWindow(raw, { now: NOW });
  assert.equal(w.state, "unknown");
  assert.equal(w.usedTokens, null);
  assert.equal(w.limitTokens, null);
  assert.equal(w.utilizationPct, null);
});

test("unsupported: no read-only source wired for the provider at all", () => {
  const raw = unsupportedWindow({ provider: "claude-max", scope: "5h-window", reason: "no endpoint" });
  const w = buildWindow(raw, { now: NOW });
  assert.equal(w.state, "unsupported");
  assert.equal(w.usedTokens, null);
  assert.equal(w.limitTokens, null);
  assert.equal(w.notes, "no endpoint");
});

test("reset transition: a reading taken before reset is not trusted as current after the reset passes", () => {
  const raw = { ...resetTransitionWindowFixture(NOW), source: { ...resetTransitionWindowFixture(NOW).source, kind: "live" } };
  const w = buildWindow(raw, { now: NOW });
  assert.equal(w.state, "stale");
  assert.equal(w.usedTokens, null, "a pre-reset number must not be shown as the post-reset figure");
  assert.match(w.notes, /predates the window's reset/);
});

test("reset transition: a fresh reading after reset is trusted again", () => {
  const raw = { ...postResetFreshWindowFixture(NOW), source: { ...postResetFreshWindowFixture(NOW).source, kind: "live" } };
  const w = buildWindow(raw, { now: NOW });
  assert.equal(w.state, "fresh");
  assert.equal(w.usedTokens, 40_000);
});

test("wrapSyntheticAdapter forces source.kind=synthetic even if the adapter tries to claim live", async () => {
  const lying = wrapSyntheticAdapter(async () => [{ ...freshWindowFixture(NOW), source: { ...freshWindowFixture(NOW).source, kind: "live" } }]);
  const [raw] = await lying();
  assert.equal(raw.source.kind, "synthetic");
});

test("demo adapter output always normalizes to source.kind=synthetic across every fixture state", async () => {
  const raw = await demoAdapter({ now: NOW });
  assert.ok(raw.length >= 5);
  for (const r of raw) assert.equal(r.source.kind, "synthetic");
  const windows = raw.map((r) => buildWindow(r, { now: NOW }));
  const states = new Set(windows.map((w) => w.state));
  for (const required of ["fresh", "stale", "exhausted", "unknown"]) {
    assert.ok(states.has(required), `demo fixtures must cover state "${required}"`);
  }
});

test("buildSnapshot: claude-max adapter is honestly unsupported, never a guessed cap", async () => {
  const snapshot = await buildSnapshot([{ name: "claude-max", run: claudeMaxAdapter }], {}, { now: NOW });
  assert.equal(snapshot.version, RATE_LIMIT_CONTRACT_VERSION);
  assert.equal(snapshot.windows.length, 1);
  const [w] = snapshot.windows;
  assert.equal(w.state, "unsupported");
  assert.equal(w.usedTokens, null);
  assert.equal(w.limitTokens, null);
  assert.ok(w.notes.includes("No authoritative read-only quota source"));
  assert.equal(w.notes, CLAUDE_MAX_UNSUPPORTED_REASON);
  // The old unverified 1.5M default must never resurface as a presented fact.
  assert.ok(!JSON.stringify(snapshot).includes("1500000"));
});

test("buildSnapshot: a throwing adapter degrades to an honest unsupported window, not a crash", async () => {
  const boom = { name: "boom-provider", run: async () => { throw new Error("network unreachable"); } };
  const snapshot = await buildSnapshot([boom], {}, { now: NOW });
  assert.equal(snapshot.windows.length, 1);
  assert.equal(snapshot.windows[0].state, "unsupported");
  assert.match(snapshot.windows[0].notes, /network unreachable/);
});

test("buildSnapshot: demo adapter windows are all tagged synthetic end to end", async () => {
  const snapshot = await buildSnapshot([{ name: "demo", run: demoAdapter }], {}, { now: NOW });
  assert.ok(snapshot.windows.length >= 5);
  for (const w of snapshot.windows) assert.equal(w.source.kind, "synthetic");
});

test("every declared state is reachable and the state list is closed", () => {
  assert.deepEqual(RATE_LIMIT_STATES, ["fresh", "stale", "exhausted", "unknown", "unsupported"]);
});

test("formatResetLabel is explicit about timezone and null-safe", () => {
  const w = buildWindow({ ...freshWindowFixture(NOW), source: { ...freshWindowFixture(NOW).source, kind: "live" } }, { now: NOW });
  assert.match(formatResetLabel(w), /Resets .* \(America\/New_York\)/);
  const unknown = buildWindow(unsupportedWindow({ provider: "p", scope: "s", reason: "r" }), { now: NOW });
  assert.equal(formatResetLabel(unknown), "Reset time unknown");
});
