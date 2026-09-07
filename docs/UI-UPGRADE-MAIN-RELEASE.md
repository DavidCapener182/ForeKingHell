# UI upgrade main release — 7 September 2026

The owner authorised finishing release failures and merging PR59 into main. This publishes the current implementation; it does not certify all 492 component acceptance checks across 98 routes.

## Current validation

- Full unit suite: **2,788 passed, zero failed, 149 skipped/pending**, 2,937 total. `/tmp/fkh-release-unit-complete.json`. Earlier source-contract failures in this document have been resolved; assertions follow extracted components and retain the functional contracts.
- Full lint passed. `/tmp/fkh-final-release-lint.log`.
- Normal isolated Next.js production build passed, including TypeScript and static generation. `/tmp/fkh-final-route-build.log`.
- All 24 route budget checks pass. Every existing limit remains unchanged; the new internal companion Today route uses the same original Today cap. `/tmp/fkh-final-route-check.log`.
- High-severity dependency audit passed. `/tmp/fkh-release-audit.log`. The direct React Aria/React Stately declarations use already resolved versions.
- Inventory validation passed: 492 components, 98 routes.
- Scoped browser checks passed for deferred Select/forms, React Aria hook tabs, History, session detail, Bag, Speed, Rapsodo and import receipt. Requested desktop/mobile sizes and 1023/1024px boundaries are covered by the affected fixture suites. Source provenance, correction controls, filter and draft retention remain exercised. See the tracker and progress log for precise scope.
- Administrative account, health, billing, challenge, moderation and Partners retained controls previously passed their scoped authorised fixture suites. Existing source/ownership/export/confirmation checks are retained.

- Final public Today browser: PASS20.3s,12surface/viewport variants, public URL/query/tab history retained, owned evidence200 and foreign evidence404, no JS errors/overflow. `/tmp/fkh-today-route-isolation-retry.log`.

## Release status

Performance commit `6ea9d12219c22f26faa67389f8987ed8cb1245e9` is pushed to PR59. Main remains `cf9de4018e0273a7f86a0ae69791af4ff414d29c`. At this commit, five required jobs passed. The validate job passed build, all route budgets and every prior step; its final auth smoke found three ambiguous Email selectors. A test-only correction targets the password field exactly and independently asserts the secure-link field. The full isolated auth smoke rerun passed:7tests,1existing live-fixture skip,0failures (`/tmp/fkh-auth-release-browser.log`). Publish the correction, then verify all six required checks before normal exact-head merge.

## Remaining acceptance work

Every tracker entry remains partially verified. Full application-wide accessibility, themes, software-keyboard, state/error permutations and all authorised-operation acceptance checks are not complete. This release must not be described as a completed 492-component migration. Read `ForeKingHell-completion-tracker.csv` and `UI-UPGRADE-PROGRESS.md` for per-component evidence and outstanding blockers.
