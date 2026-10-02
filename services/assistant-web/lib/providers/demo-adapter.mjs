// Synthetic provider adapter for the Agents rate-limit widget.
//
// Every window this module produces is clearly fictional (provider names
// start with "demo-") and is force-tagged `source.kind: "synthetic"` by
// wrapSyntheticAdapter, so it can never be mistaken for a real reading even
// if a future caller forgets to check the mode. Used by the demo API path
// (`GET /api/rate-limits?mode=demo`) and by the test suite to exercise every
// contract state without touching a real account.
import { wrapSyntheticAdapter } from "../rate-limits.mjs";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** A recently-read, comfortably-under-limit window. */
export function freshWindowFixture(now = Date.now()) {
  return {
    provider: "demo-provider-a",
    account: "demo-account",
    scope: "5h-window",
    usedTokens: 1_200_000,
    limitTokens: 5_000_000,
    resetAt: new Date(now + 3 * HOUR).toISOString(),
    resetTimezone: "America/New_York",
    source: { label: "Synthetic fixture: fresh", fetchedAt: new Date(now - 2 * MIN).toISOString() },
    notes: null,
  };
}

/** A reading old enough to no longer be trusted, though not necessarily exhausted. */
export function staleWindowFixture(now = Date.now()) {
  return {
    provider: "demo-provider-a",
    account: "demo-account",
    scope: "7d-window",
    usedTokens: 8_000_000,
    limitTokens: 40_000_000,
    resetAt: new Date(now + 4 * 24 * HOUR).toISOString(),
    resetTimezone: "America/New_York",
    source: { label: "Synthetic fixture: stale", fetchedAt: new Date(now - 45 * MIN).toISOString() },
    notes: null,
  };
}

/** Usage at/over the limit, reading still current (before reset). */
export function exhaustedWindowFixture(now = Date.now()) {
  return {
    provider: "demo-provider-b",
    account: "demo-account",
    scope: "5h-window",
    usedTokens: 5_000_000,
    limitTokens: 5_000_000,
    resetAt: new Date(now + 40 * MIN).toISOString(),
    resetTimezone: "America/New_York",
    source: { label: "Synthetic fixture: exhausted", fetchedAt: new Date(now - 1 * MIN).toISOString() },
    notes: null,
  };
}

/** No usable numbers at all (e.g. a provider that never reported). */
export function unknownWindowFixture(now = Date.now()) {
  return {
    provider: "demo-provider-c",
    account: "demo-account",
    scope: "5h-window",
    usedTokens: null,
    limitTokens: null,
    resetAt: null,
    resetTimezone: null,
    source: { label: "Synthetic fixture: unknown (no reading available)", fetchedAt: new Date(now - 1 * MIN).toISOString() },
    notes: "No usage reading has ever been collected for this demo provider.",
  };
}

/** A reading taken just before the window reset, viewed just after it: the number can no longer be trusted as "current". */
export function resetTransitionWindowFixture(now = Date.now()) {
  return {
    provider: "demo-provider-d",
    account: "demo-account",
    scope: "5h-window",
    usedTokens: 4_950_000,
    limitTokens: 5_000_000,
    resetAt: new Date(now - 2 * MIN).toISOString(),
    resetTimezone: "America/New_York",
    source: { label: "Synthetic fixture: reset transition", fetchedAt: new Date(now - 12 * MIN).toISOString() },
    notes: null,
  };
}

/** The same window shortly after a fresh post-reset reading arrived. */
export function postResetFreshWindowFixture(now = Date.now()) {
  return {
    provider: "demo-provider-d",
    account: "demo-account",
    scope: "5h-window",
    usedTokens: 40_000,
    limitTokens: 5_000_000,
    resetAt: new Date(now + (5 * HOUR - 2 * MIN)).toISOString(),
    resetTimezone: "America/New_York",
    source: { label: "Synthetic fixture: fresh after reset", fetchedAt: new Date(now - 1 * MIN).toISOString() },
    notes: null,
  };
}

/** All distinct-state fixtures in one array, for the demo widget / fixture-coverage tests. */
export function allDemoFixtures(now = Date.now()) {
  return [freshWindowFixture(now), staleWindowFixture(now), exhaustedWindowFixture(now), unknownWindowFixture(now), resetTransitionWindowFixture(now)];
}

/** Adapter used by `GET /api/rate-limits?mode=demo`. */
export const demoAdapter = wrapSyntheticAdapter(async (ctx) => allDemoFixtures(ctx?.now ?? Date.now()));
