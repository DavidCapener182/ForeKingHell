# Approved lint compatibility and staged rollout — 16 October 2026

David approved preparing, testing and pushing the compatibility fix. This follow-up preserves the previous CI repair and three-feature commits, all lint rules, the security gate and the original dirty personal checkout. The company repository is unchanged.

## Root cause and repair

The maintained Next ESLint plugin still pulled the high-severity braces chain through fast-glob. A direct tinyglobby alias failed directory behavior and was rejected. The owned private adapter implements only the pinned Next 16.3.8 caller's directory glob signature using maintained picomatch 4.0.7, brace-expansion 5.0.12 and Node filesystem enumeration. Unexpected callers fail explicitly. No check or rule is suppressed.

The readable source, pinned caller hash, maintenance guidance and original baselines are in `tools/eslint-fast-glob-compat`. A tracked npm tarball avoids npm 11 nested directory-link resolution falling back to an ancestor package. The regression test verifies the installed package/source identity as well as behavior. Review source and repack together; prefer removing this adapter after a maintained upstream repair passes the same tests.

## Verification

- Clean `npm ci`; installed source/caller identity passed.
- 234 original directory fixtures and 35 actual Next rule diagnostic cases passed.
- All 2,365 pre-existing JS/TS file inventories, rule profiles, settings and diagnostics matched exactly (`docs/evidence/compat`). Default TypeScript has 86 rules; JavaScript has 82.
- Unchanged audit gate passed: 11 moderate, zero high and zero critical. No waiver renewed.
- Full unit suite: 3,205 passed, 212 skipped.
- Real PostgreSQL feature acceptance: 16 passed. Separate pre-0062 database rollout case: 1 passed.
- Browser feature flows: 9 passed across Chromium, Firefox and mobile WebKit. Affected Chromium accessibility/app flows: 44 passed after the final clean install.
- Formatting, lint, TypeScript, migration consistency, production build and route budgets passed. One pre-existing unused-variable lint warning remains.

The full 15-project nightly runtime still requires remote verification. Linux dependency installation and exact-commit GitHub results cannot be inferred from local Mac results.

## Code-first rollout and recovery

Production migration 0062 was not run. Server schema readiness checks require both optional tables; when absent, ordinary billing/imports continue, trial offers are hidden, checkout fails unavailable before any provider request, and saved round-plan endpoints return 503 with honest disabled persistence controls. Measured round-plan viewing remains available. An actual old-schema database test verifies these boundaries. Migration activation and live Stripe transactions remain outside this approval.

The existing linked Vercel project is `lm-world-tour`; inspection showed the normal Next build and no repository build-time migration hook. A main push may trigger its existing deployment. Inspect its exact commit after push; do not create a separate deployment, change settings or migrate production.

Recovery should use a normal corrective/revert commit without rewriting main. Reverting the adapter also restores the known high audit failure; do not bypass the gate to hide it. Restoring previous feature behavior must account for any separately approved future migration or real trial records. Preserve the existing migration history and payment records.
