# Benchmark and performance intelligence

## Implementation map

The existing Bag table (`distance-benchmark-panel.tsx`) and `club-benchmarks.ts` remain the benchmark entry point. `benchmark-registry.ts` identifies the preserved Legacy v1 definitions and explains internal LMWT bands separately from legacy Tour anchors. No new reference population or numeric dataset is introduced.

`performance-intelligence.ts` supplies deterministic, independently testable shot sets, recent form and one evidence-backed practice action. `performance-intelligence-data.ts` loads owner-scoped observations and equipment history for the existing Bag and selected-club pages. Existing Today and Progress timelines remain available. Missing context is disclosed rather than reconstructed from distance.

`metric-provenance.ts` and import adapters preserve metric-specific validity, original source rows and explicit unit conversion. The existing Speed Centre keeps speed testing separate from normal-ball evidence.

The existing `practice-planner.ts` continues to generate, save and match plans; saved JSON freezes evaluation rules and baseline evidence. Match, coverage and outcome are separate. Existing achievement identities and reward deduplication remain authoritative.

## Calculation contract

- Potential: arithmetic mean of up to 30 longest eligible clean identified full swings in one comparable context. All related metrics use those same shot IDs. Missing readings reduce coverage, never draw replacement shots.
- Stock: median of recent identified full swings, excluding explicitly classified severe mishits, warm-ups, no-ball work, invalid observations and incompatible intent. Ordinary imperfect contact remains.
- All attempts: valid observations of the same intended shot, including genuine mishits. Short distance alone establishes neither mishit nor partial intent.
- Typical range: P20–P80, the middle 60% of observed carry distances, using linear interpolation (R-7). This is not a confidence interval or a guarantee.
- Current: latest five comparable sessions in 90 days. Baseline: preceding five non-overlapping sessions in 180 days. Actual dates and counts are displayed. Session summaries carry equal weight for comparisons.
- Readiness: Provisional below 10 valid observations or two sessions; Establishing at 10/two; Well sampled at 30/three. These product rules do not guarantee measurement accuracy.
- Absolute lateral error and signed directional bias are separate. No carry projection, handicap probability, universal calibration or composite golfer rating is inferred.

## Release and rollback

This additive release does not require a database migration and performs no session import or historical data rewrite. Original source records, user exclusions, imported sessions and earned achievements are preserved. Existing saved plans remain readable; a legacy plan without frozen baseline evidence is explicitly limited.

The interface can be disabled using `BENCHMARK_INTELLIGENCE_ENABLED=0` on the server. This hides the new panels while retaining existing benchmarks and stored evidence. Reverting the release commit restores the previous application without deleting user data. New saved JSON fields are additive.

## Reference interpretation

Legacy v1 preserves the repository's current numeric bands. Its Driver internal Tour band is 296 yd while the separate legacy Tour anchor is 275 yd; these are intentionally disclosed as different definitions. The screenshot's 286 yd is not the currently committed threshold and is not substituted into live calculations. Legacy source publication dates are unknown and are labelled accordingly; these bands are not verified population percentiles. Reference relabelling is not a new performance achievement.

## Verification record

Development baseline source at `bb43ba14`: 624 test files passed, 68 skipped; 3,164 tests passed, 195 skipped, using the original installed Next 16.3.4 / Vitest 4 runtime. These early checks are not the final release verification. A clean `npm ci` subsequently installed the unchanged lockfile (Next 16.3.8 / Vitest 5.0.1) for final checks.

## Acceptance evidence

| Brief requirement                                                                            | Implemented evidence and regression coverage                                                                                                                          |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep ladder, tabs, metric-specific caveats and mean-gap targets                              | `benchmark-registry.test.ts`, `club-benchmarks.test.ts`, benchmark component browser fixture                                                                          |
| Potential versus stock versus all attempts; 220 potential can coexist with lower stock       | `performance-intelligence.test.ts`, `stock-yardage.test.ts`; actual distribution in existing Bag UI                                                                   |
| One carry-selected cohort with 18/30 speed coverage and no backfill                          | `benchmark-evidence.test.ts`; rendered fixture shows actual coverage                                                                                                  |
| Imported smash retained; paired derived ratio separately identified                          | `metric-provenance.test.ts`, `benchmark-evidence.test.ts`                                                                                                             |
| Explicit intent, partial wedges, genuine mishits and invalid observations stay separate      | `stock-yardage.test.ts`, `bag-intelligence.test.ts`, import-triage and practice tests                                                                                 |
| Known units convert once; unknown apex/flags unresolved; zero axis and negative angles valid | `metric-provenance.test.ts`, parser/provider adapter tests                                                                                                            |
| Carry-only quarantine preserves valid speed                                                  | `import-quality-triage-integration.test.ts`, performance and speed tests                                                                                              |
| Identical rounded readings survive; only confirmed canonical links deduplicate               | Performance and speed-training-data tests; original source-separated observations retained                                                                            |
| Comparable current/baseline windows, equal session weighting, absolute error versus bias     | `performance-intelligence.test.ts`, `performance-shot-adapter.test.ts`; source/setup selector on selected club                                                        |
| Bag gapping uses current source/setup stock rather than pooled devices                       | `bag-performance-stock.test.ts`; all-time PB remains separate                                                                                                         |
| Sparse/noisy/unknown-context evidence cannot establish strong improvement                    | Performance readiness/coverage tests; early-signal copy and deterministic retest action                                                                               |
| Frozen practice baseline, intent/setup matching and no reused disjoint-block evidence        | `practice-planner.test.ts`; immutable evidence in existing saved JSON                                                                                                 |
| Missing practice evidence inconclusive; notifications and XP idempotent                      | Practice planner/view/notification and achievement evidence tests                                                                                                     |
| Truthful explanation without model availability                                              | Rules-based structured coaching is always available and labelled; no new model dependency or generated numerical claim                                                |
| Responsive accessible existing pages, scoped evidence queries                                | Seven synthetic component/browser matrices and route-specific tests; owner joins independently reviewed. Live authenticated database paths are not claimed as tested. |

## Remaining limitations

Legacy sessions often lack ball, firmware, normalization, intent or equipment-period metadata; they remain available but can legitimately show Early signal or an inconclusive comparison. No context is invented to produce a stronger result. Historical screenshot values have not been traced against a live authenticated database during this run and are not production constants.

Confirmed canonical swing links are accepted only when explicitly recorded in source metadata. No automatic cross-device matching or new duplicate-linking database workflow is invented. Each source view retains its own original readings; no pooled physical-swing total is presented.

Existing achievements retain their original recorded evidence; legacy records without versions are labelled unrecorded. Their historical award method is explicitly identified as the legacy stock-median method, distinct from corrected Bag best-30 potential. Future reference versions cannot silently mint new rewards.

Authenticated imports, production data reads/writes, real model calls, administrative/billing operations and retention claims have not been exercised. Browser evidence uses visibly labelled synthetic fixtures of actual components. No production migration, re-import, secret modification or unrelated PR merge occurred.

The separately approved dependency-only repair clears the unchanged high/critical audit gate. See [baseline findings and verified repair](DEPENDENCY_RELEASE_BLOCKER_2026_10_18.md). No PR101 product changes, migrations or security-policy exceptions are included.
