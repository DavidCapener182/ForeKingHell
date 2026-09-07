# UI upgrade main release — 7 September 2026

The owner authorised finishing release failures and merging PR59 into main. This publishes the current implementation; it does not certify all 492 component acceptance checks across 98 routes.

## Current validation

- Full unit suite: **2,788 passed, zero failed, 149 skipped/pending**, 2,937 total. `/tmp/fkh-review-fixes-unit-final.json`. Earlier source-contract failures in this document have been resolved; assertions follow extracted components and retain the functional contracts.
- Full lint passed. `/tmp/fkh-final-release-lint.log`.
- Normal isolated Next.js production build passed, including TypeScript and static generation. `/tmp/fkh-review-final-build.log`.
- All 24 route budget checks pass. Every existing limit remains unchanged; the new internal companion Today route uses the same original Today cap. `/tmp/fkh-review-final-budgets.log`.
- High-severity dependency audit passed. `/tmp/fkh-release-audit.log`. The direct React Aria/React Stately declarations use already resolved versions.
- Inventory validation passed: 492 components, 98 routes.
- Scoped browser checks passed for deferred Select/forms, React Aria hook tabs, History, session detail, Bag, Speed, Rapsodo and import receipt. Requested desktop/mobile sizes and 1023/1024px boundaries are covered by the affected fixture suites. Source provenance, correction controls, filter and draft retention remain exercised. See the tracker and progress log for precise scope.
- Administrative account, health, billing, challenge, moderation and Partners retained controls previously passed their scoped authorised fixture suites. Existing source/ownership/export/confirmation checks are retained.

- Final public Today browser: PASS20.3s,12surface/viewport variants, public URL/query/tab history retained, owned evidence200 and foreign evidence404, no JS errors/overflow. `/tmp/fkh-today-route-isolation-retry.log`.

## Release status

All six required checks passed at `46921d5f935e7547fcc37480d3d3a6f4c9dc8d91`. GitHub additionally requires review threads to be resolved and permits squash merges. Partners/moderation controls were already fixed. Final reviewed fixes preserve canonical Quick Bag metric targets and defer hidden/closed training work while keeping the complete phone workflow. Both browser suites passed all12surface/size variants, fullunits passed andall24budgets passed. Publish this final batch, resolve the corresponding threads, verify all six required checks at its exact SHA, and squash merge PR59. Main has not yet changed at this checkpoint.

## Remaining acceptance work

Every tracker entry remains partially verified. Full application-wide accessibility, themes, software-keyboard, state/error permutations and all authorised-operation acceptance checks are not complete. This release must not be described as a completed 492-component migration. Read `ForeKingHell-completion-tracker.csv` and `UI-UPGRADE-PROGRESS.md` for per-component evidence and outstanding blockers.
