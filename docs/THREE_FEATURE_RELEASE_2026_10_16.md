# Pro round planning, Free import allowance and seven-day trial

Local implementation on `feat/pro-trial-round-plan`, based on the separate CI repair commit `b64a0904`. The original dirty personal checkout and company checkout are untouched. This document records local evidence; it is not a production release or a claim that GitHub CI is green.

## Result

- Course Twin catalogue links to `?mode=plan`. Authenticated Free/Plus accounts can preview hole 1; direct strategy requests for holes 2–18 and all saved-plan requests require Pro/Coach/Full, including a current Pro trial. The planner reuses existing mobile maps and simulation options, shows measured evidence/confidence and modelled hazard disclosures, represents missing geometry/options as unavailable, and saves append-only owner/course snapshots. Reload reads the latest snapshot; export retains the saved evidence. Next rechecks access when an account upgrades during the teaser.
- One shared UTC allowance reader mirrors the existing usage ledger and legacy-import fallback. Free gets five monthly imports; duplicate retries return before charging. Workbench, companion and result views show allowance, reset date, saved evidence and an upgrade path. Upload/save controls stop new imports at the limit, retaining drafts/mapping. Structured quota responses drive the same recovery UI when another device takes the last slot. Plus benefits come from the pricing catalogue.
- First successful nonduplicate imports create trial eligibility. Only Free accounts that have never trialled qualify. Monthly Pro Checkout collects a card and uses a durable, locked request ID as its Stripe idempotency key. Provider failure does not consume eligibility. An open Checkout is reused; only a provider-confirmed expired session can be replaced. Uncertain attempts older than 23 hours fail closed rather than risk a second subscription. Verified live webhook events atomically apply subscription/entitlement state and consume the one-shot trial; delayed/duplicate events retain ordering checks. Trial end bounds local access even if the next webhook is delayed. Paid Pro without a trial does not consume eligibility.
- Account-scoped funnel events use server-side usage events. Activation/expiry events come from the live webhook transaction. Trial UI states card requirement, one trial/account, £12.99/month after seven days and cancellation through Manage billing. Missing Stripe configuration hides the offer.

## Security and migration

`0062_pro_trial_and_round_plan.sql` adds server-managed trial reservations and round-plan history. Both tables force RLS, revoke direct PUBLIC/anon/authenticated access, grant the server role access, cascade account deletion, and participate in the governance manifest. Export redacts provider IDs and Checkout URLs. APIs authenticate, gate the plan and resolve course visibility for the current owner; clients cannot submit another user or forged hole evidence.

Migration 0062 has been applied only to the disposable local database. **Do not deploy this code before the migration is applied to the intended environment through the approved migration process.** Billing/import/plan loaders query the new tables. A future production migration requires separate authorization; none was performed here. No Stripe API transaction was performed: all payment test calls were mocked. No secrets, permissions or account settings changed.

## Validation and limits

Final local results:

| Check                                     | Result                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| Full Vitest                               | 3,198 passed; 207 skipped (including opt-in integration cases)                            |
| Explicit PostgreSQL acceptance            | 12 passed                                                                                 |
| Feature browser acceptance                | 9 passed across Chromium, Firefox and mobile WebKit                                       |
| Affected Chromium accessibility/app flows | 44 passed                                                                                 |
| Formatting, route types and TypeScript    | Passed                                                                                    |
| ESLint                                    | Zero errors; one existing unused-variable warning in `ui-upgrade-record-alias.spec.ts:53` |
| Migration consistency                     | Passed                                                                                    |
| Production build and all route budgets    | Passed                                                                                    |
| Eight-shard inventory                     | 5,760 unique cases; zero missing/duplicated/unexpected; all 15 projects                   |
| Dependency audit                          | **Blocked**: 11 moderate, five high, zero critical                                        |

Supporting logs are saved beside the isolated checkout in the task directory (`features-*.log`). Unit, real PostgreSQL, browser, formatting, lint, type, migration and build evidence is reported in the task's final checkpoint. The browser acceptance suite exercises Chromium, Firefox and mobile WebKit. The database tests cover real first imports, duplicates at quota, a last-slot race, checkout concurrency/failure/expiry, atomic webhook rollback, one-shot consumption, owner isolation, append history, expiry gates and denied client-table access. Nightly runs these database tests once on shard 1 before its browser coverage.

A broader accessibility regression exposed a pre-existing clubhouse sidebar colour override applying pale text to a pale avatar background. The selector now excludes avatar fallbacks so their paired muted foreground/background tokens remain together; no Axe rule was disabled.

The complete 15-project browser matrix has not been run locally. Eight shards preserve all enumerated tests and save diagnostics, but remote execution must verify Linux/PostgreSQL 17/browser runtime and time budgets. No production webhook delivery, Checkout purchase, production RLS persona run, migration or deployment has been exercised. Use Stripe test mode and the intended preview for final operational acceptance after authorization.

## Release blocker and recovery

The unchanged dependency audit still fails: 11 moderate, five high, zero critical. The high chain is Next ESLint → fast-glob → micromatch → braces. Current maintained releases retain it. `CI_REPAIR_2026_10_16.md` records the upgrade/parity investigation and alternatives. No waiver or threshold reduction was made. Therefore conditional main-push authorization is not satisfied; no push, merge or deployment was attempted.

Preferred recovery: obtain a maintained patched upstream release, update the minimal chain and rerun audit/lint/units/build. Alternatively commission a reviewed lint-tooling migration with rule parity and regression evidence. Then verify current main, reconcile changes in isolation, obtain the required migration rollout authorization, run preview/payment test-mode checks, and push only when all gates pass. Never force push. To inspect just the CI repair, use branch `fix/ci-dependency-audit`; to inspect all feature work, use the feature branch. The original user checkout need not be reset or stashed.
