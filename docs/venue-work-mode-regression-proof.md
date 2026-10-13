# Work-mode evidence regression proof

Use when scoring rejects a claim but a recommendation filter still accepts it.
This is recommendation eligibility, not proof of improved venue truth or rank accuracy.

1. Inspect current scoring and filter paths. Reuse the existing observation/date/
   recency policy; do not invent new decay weights or silently tighten primitive
   filters while repairing named work-mode presets.
2. Freeze the evaluation clock. Reproduce through GET and POST listing routes,
   full and compact responses. Include future, invalid, stale, unknown, estimate,
   restricted and valid controls. Keep synthetic claims out of real venue data.
3. Give fixtures distinct names as well as IDs (or intentionally distinct
   locations/addresses). Nearby same-name fixtures can collapse in listing
   deduplication, masking a broken rejection predicate. Check the unfiltered
   inventory before trusting rejection tests.
4. Preserve mode-specific rules: positive laptop evidence in both presets,
   seating/noise in Deep focus, existing library-kind exception, New York weekend
   clock. Test exact freshness threshold and either side through public seams.
5. Replay representative real NYC queries against base and candidate at the same
   clock. Compare membership, order, scores and unchanged claims. Zero difference
   means a safety repair with no measured current ranking lift, not no test value.
6. Separate author full-suite results from independent exact-head evidence.
   Retain skipped database gates and local-vs-production boundaries explicitly.
7. Release only after applicable review/permission gates, and record new Production
   revision plus fresh alias behavior separately from previous verified release.

Example: [work-mode repair](https://github.com/mrbam88/bamware-venue-engine/pull/204).
Its source publication and tests are not deployment proof.
