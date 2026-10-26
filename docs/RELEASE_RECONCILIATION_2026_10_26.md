# ForeKingHell release reconciliation — 26 October 2026

## Release scope

David authorized safely publishing all completed work to main. The release starts from `origin/main` at `8deac162`, preserves later fixes rather than copying the stale personal checkout over main, and retains a recoverable snapshot at `codex/release-snapshot-20261026` (`9539bd96`). The primary checkout and historical worktrees were not reset or cleaned.

Included: React/Next compatibility repair from PR #100; PR #101 Pro round plans, import allowance recovery, trial foundation and CI fixes; unpublished `fix/nightly-audit-browser` browser/hydration/accessibility changes; residual personal-checkout cleanup, compressed artwork, stock labels and offline destinations; current dependency PR changes, aligned OpenTelemetry/Vercel peers, and supported GitHub Action upgrades. Prettier 3.9.10 required formatting changes in 32 existing files.

The newer main atomic bulk shot correction, historical club filter, chronological stock-yardage calculations, chart sizing and benchmark work remain intact. Six unused presentation modules were removed only after checking source/test references.

## Validation before publication

- Full unit suite: **3,426 passed**, 219 skipped. Opt-in feature database cases were run explicitly below; other skipped integrations are not claimed as verified.
- Disposable PostgreSQL 17.10: all **63 migrations** applied from zero; **23 feature tests** passed, covering quotas, ownership, RLS, concurrent reservations, trial lifecycle and recovery.
- Separate pre-0062 database: **62 migrations**, **1 staged rollout test** passed. Billing/imports continue without the optional tables; first-import eligibility survives in the existing server-managed usage ledger.
- Pro feature browser flows: **9 passed**, Chromium/Firefox/mobile WebKit, using synthetic local personas and disposable data.
- Core companion, accessibility and responsive shared progress browser checks: **6 passed** on Chromium.
- Formatting, lint, TypeScript, migration consistency, full production build and route JavaScript budgets passed.
- Dependency audit: no high/critical findings; no force or legacy peer bypass. The expired historical exception is not needed for these results.
- Lint compatibility: installed adapter source/package and unchanged Next caller hash verified; 234 directory fixtures and 35 real Next rule cases remain covered. Exact historical secret-scan fingerprints were independently verified.

An initial attempt to run local synthetic-persona browser tests against a production server correctly redirected to sign-in because production disables the bypass. Those cases were rerun successfully using the designated development-only harness. This is not authenticated production acceptance.

## Trial review findings

First-import eligibility is now durably recorded before migration 0062 and hydrated once its table exists. Stale sessionless reservations are reconciled against paginated Stripe Checkout metadata while holding the reservation lock: existing open sessions are recovered, confirmed absent/expired sessions can rotate, and completed/ambiguous/unavailable/incomplete evidence blocks another checkout. No live Stripe transaction was performed.

## Production database boundary

A read-only production query confirmed both `fkh_billing_trials` and `fkh_course_twin_round_plans` absent before this release. The existing release plan requires separate authorization for migration 0062. Approval was requested separately; this document does not claim that migration or operational Stripe acceptance occurred. The schema readiness guard keeps optional features unavailable until storage is ready.

## Checkout and artifact inventory

- Personal checkout: 55 tracked changes and 19 untracked entries captured; the LibreOffice `.~lock.ForeKingHell-completion-tracker.xlsx#` artifact was excluded and preserved.
- Old Course Twin checkout: its committed tip is already included in main. Its 26 missing assets/script entries are not unpublished features and were not used to delete files from the working app.
- Historical nightly audit checkout: all 382 materialized tracked files match its committed branch; no untracked files were listed. 2,742 iCloud-only files could not be content-verified because Git reads stalled. Their committed branch is integrated; no claim is made about unavailable local file content.
- Prunable temporary worktree records contain no accessible checkout files. Their reachable branch tips were included in the branch audit. No branch or recoverable snapshot was deleted.

## Branch audit

71 distinct non-ancestor branch tips were checked using their merge-base changes and per-path blob history. 65 tips have all changed file versions already in main history. The six remaining tips were integrated or proven superseded below. Squash-merged branches need not be Git ancestors to have their work published.

| Branch                                              | Changed paths | Previously unseen final blobs | Disposition                                                                                             |
| --------------------------------------------------- | ------------: | ----------------------------: | ------------------------------------------------------------------------------------------------------- |
| `codex/all-current-work-20260822`                   |            60 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/bag-mobile-overflow-20261018`                |            11 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/benchmark-intelligence-20261018`             |           235 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/benchmark-metric-coverage-20261018`          |            12 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/benchmark-mobile-release`                    |             8 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/combined-september-release`                  |           133 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/combined-visual-practice`                    |             7 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/course-scenery-publish`                      |            91 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/delivery-club-artwork`                       |            10 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/driver-evidence-confidence`                  |            78 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/equal-practice-card-heights`                 |             2 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/exclude-output-from-vitest`                  |             1 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/fix-command-selection-contrast`              |             1 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/fix-react-peer-pr81`                         |             3 |                             3 | Superseded by the current React 19.2.8 compatibility repair and Next 16.4.2 upgrade.                    |
| `codex/full-repo-audit-release-20260819`            |           186 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/iphone-companion-refresh`                    |            43 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/iphone-companion-release-20260905`           |            97 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/local-before-main-sync`                      |            10 |                             2 | Superseded: main supports arbitrary numbered woods and hybrids, with broader identity tests.            |
| `codex/lock-dispersion-main`                        |             9 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/master-plan-completion`                      |            51 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-bag-session-polish-20260905`          |            23 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-caddie-book-offline`                  |            19 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-companion-final-polish`               |            54 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-companion-followthrough-20260905`     |            29 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-findings-follow-up`                   |             4 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-header-safe-area`                     |             6 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-history-club-session-review`          |            23 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-practice-speed-polish-20260905`       |            25 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-progress-settings-release`            |            18 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-quick-bag-speed-release`              |            25 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-range-round-speed-polish`             |            20 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-rapsodo-release`                      |            15 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-replay-shot-review`                   |            18 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-session-map-polish-2026-09-05`        |            31 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/mobile-today-briefing-20260905`              |            22 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/offline-recovery-navigation`                 |            11 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/pb-distance-toggle`                          |             3 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/practice-navigation-carry-clarity`           |             6 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/pre-sync-2026-08-23-53e67a3c`                |            14 |                            11 | Superseded by main practice-day evidence, manual-evidence filtering and reviewed-session refresh fixes. |
| `codex/publish-remaining-card-polish`               |            11 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/real-round-achievements`                     |             9 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/real-round-training-load`                    |            17 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/round-carry-axis-to-ten`                     |             6 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/round-load-weighting`                        |             9 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/search-focus-boundary`                       |             5 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/shared-club-progress-release-20261001`       |            26 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/sign-in-connection-recovery`                 |             6 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/speed-current-work-20260822`                 |            20 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/today-latest-practice`                       |            12 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/today-mobile-practice-review`                |             7 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/today-practice-progress`                     |            19 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/today-round-polish`                          |            12 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/today-round-release`                         |             9 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/today-session-recap`                         |             8 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `codex/transitions-dev-motion`                      |            79 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `fix/nightly-audit-browser`                         |           229 |                           229 | Integrated, preserving newer main chart geometry and both tab focus behavior and accessibility.         |
| `upgrade/acceptance-closure`                        |           104 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `upgrade/history-and-live-checks`                   |            43 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `upgrade/import-history-and-recovery`               |            42 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `upgrade/untitled-ui-migration`                     |          1176 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `origin/codex/active-bag-bulk-corrections`          |            12 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `origin/codex/course-twin-planning-rendering`       |            79 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `origin/codex/mobile-strategy-twin-polish-20260905` |            28 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `origin/codex/mobile-twin-evidence-3d-preserved`    |            18 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `origin/codex/practice-day-evidence`                |            14 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `origin/feat/pro-trial-round-plan`                  |            95 |                            90 | Integrated; fixed the two unresolved review findings and retained newer lint adapter source.            |
| `origin/fix/club-progress-chart`                    |             2 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `origin/fix/mobile-rapsodo-shot-review-20260819`    |             6 |                             1 | Superseded by current import review lifecycle, quotas and duplicate practice-plan association.          |
| `origin/fix/shots-active-club-filter`               |             4 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `origin/release/rapsodo-beta`                       |            16 |                             0 | Already included in main history; preserve newer main evolution.                                        |
| `origin/upgrade/untitled-ui-migration`              |          1080 |                             0 | Already included in main history; preserve newer main evolution.                                        |
