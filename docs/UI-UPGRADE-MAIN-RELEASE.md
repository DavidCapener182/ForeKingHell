# UI upgrade main release — 7 September 2026

User authorised pushing the current implementation to main despite the remaining migration acceptance work. This release does not certify completion of all 492 components or 98 routes.

## Validation

- Isolated production webpack build: PASS, including TypeScript and static generation. Snapshot /private/tmp/fkh-main-release-20260907; local log /tmp/fkh-main-build.log. Local environment files were used only for local verification and are excluded from git.
- Full lint: PASS, zero errors and one existing unused-variable warning in ui-upgrade-record-alias.spec.ts.
- Targeted session history, mobile review, report-history and notification tests: 14 PASS across five files, /tmp/fkh-main-integration.log.
- Health-register restored controls: browser PASS1.4m across both surfaces and all six sizes; filtered CSV, optional columns, saved view restoration/reload and existing diagnostics/audit checks. output/playwright/redesign/admin-system-restored-retry.log.
- Full unit suite after formatting: 2702 passed, 81 failed, 149 pending, 2932 total. Source-contract failures remain below; these are not silently skipped or waived by changing the tests.
- Session Review browser: FAILED navigation timeout while local dev server compiled the route; interaction matrix remains unverified. /tmp/fkh-main-session-browser.log.
- Route budgets: current webpack build does not produce the required route-bundle-stats diagnostic, so current check could not run. Earlier isolated default production build reported 13 budget failures; no budget pass is claimed.
- Formatting corrections applied; final command result recorded in UI-UPGRADE-PROGRESS.md.

## Remaining work

Retained export/saved-view/column controls in admin billing, challenges, Partners and moderation; mobile import/training-load loading/performance; complete desktop/mobile accessibility, state and authorised-operation acceptance. See UI-UPGRADE-PROGRESS.md and ForeKingHell-completion-tracker.csv. All entries remain partial; none is promoted to full acceptance by this release.

## Failing source-contract files

- src/lib/app-shell-source.test.ts: 1
- src/lib/product-phase5-source.test.ts: 1
- src/app/achievements/achievements-client-source.test.ts: 6
- src/app/bag/page-source.test.ts: 8
- src/app/dashboard/page-source.test.ts: 5
- src/app/handicap/page-source.test.ts: 2
- src/app/partners/page-source.test.ts: 5
- src/app/leaderboard/page-source.test.ts: 6
- src/app/practice/page-source.test.ts: 1
- src/app/quick-bag/quick-bag-client-source.test.ts: 3
- src/app/progress/page-source.test.ts: 7
- src/app/rounds/page-source.test.ts: 1
- src/app/import/page-source.test.ts: 3
- src/app/social-intelligence/page-source.test.ts: 2
- src/app/tournaments/page-source.test.ts: 4
- src/components/app/mobile-control-adoption-source.test.ts: 1
- src/components/training/TrainingLoadRangeView-source.test.ts: 1
- src/app/admin/billing/page-source.test.ts: 3
- src/app/admin/challenges/page-source.test.ts: 2
- src/app/admin/moderation/page-source.test.ts: 2
- src/app/admin/system-checks/page-source.test.ts: 1
- src/app/admin/users/page-source.test.ts: 3
- src/app/bag/[clubId]/club-analysis-tabs-source.test.ts: 2
- src/app/bag/[clubId]/club-detail-client-source.test.ts: 2
- src/app/challenges/[challengeId]/page-source.test.ts: 3
- src/app/rounds/[sessionId]/page-source.test.ts: 1
- src/app/tournaments/[tournamentId]/page-source.test.ts: 4
- src/app/courses/[courseId]/holes/page-source.test.ts: 1
