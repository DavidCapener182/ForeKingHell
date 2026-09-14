# Subscription audit — 14 September 2026

Local implementation and targeted verification complete. No deployment, live billing change or purchase.

## Prices and allocation

| Plan          | Monthly / yearly | Access                                                                                                                                                                                                                            |
| ------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free          | £0               | Five new imports per UTC calendar month; duplicate retries are free. Core bag/history, manual rounds, practice, public competition and course play remain available.                                                              |
| Plus          | £6.99 / £69      | Unlimited imports, advanced analysis/training views, equipment experiments, saved comparisons, private boards and competition creation, portrait exports, selective reports, 10 AI credits, up to 2 extracts.                     |
| Pro           | £12.99 / £119    | Plus capabilities, player comparison, social intelligence generation, AI coach/chat, Data Chat, AI strategy/challenge copy, Square/TrackMan adapters when enabled, 100 credits, 30 combined chat messages/day, up to 10 extracts. |
| Coach / Club  | £49 / £499       | Pro capabilities, consent-based coach roster, private notes/assignments/evidence requests, major hosting, 300 account credits, 60 combined chat messages/day, up to 25 extracts.                                                  |
| Lifetime Full | Internal grant   | Existing owner grant preserved, including internal AI safety caps. Does not replace separate admin authorisation.                                                                                                                 |

Prices retained; this is an access/product audit, not a competitor or profitability assessment. Yearly prices and Stripe price-ID mappings remain unchanged. Both pricing surfaces now use the same catalogue; billing no longer presents Pro as “Full”.

## Corrected gaps

- Consolidated both webhook entitlement definitions and lifetime grants. Pro and Coach now inherit private competition entitlements; Coach inherits Pro strategy/verification flags.
- Added dedicated server page gates and independent write/API guards for sold analytics, exports, reports, player comparisons, private hosting and coaching.
- Free imports are counted by upload month, inside the existing per-user transaction lock. Only new successful imports count. Rapsodo cloud, CSV, batches and offline replay call the same save service. Usage events survive data reset; legacy import rows seed usage when first encountered. Duplicate retries return before charging.
- AI already had atomic monthly-credit reservations but lacked advertised per-feature request caps. Added combined Ask Coach/Data Chat daily counts and monthly extract counts inside that same lock. Reserved and successful calls count; failed/released calls and cache reuse do not. Resets use UTC. All AI operations also consume the shared monthly credit budget; an extract costs 4 credits.
- Removed unsupported 25-seat licensing, pooled cross-player credits, custom seat pricing and standings-export claims. Account sharing grants access to a coach; it does not purchase a player's subscription. The current portrait export does not implement arbitrary card customisation, so the copy now says portrait exports.
- Downgrades preserve data, existing report history/revocation, player inbox/completion and safety reporting. Private competition participation remains available; the paid capability is creation. Private course boards require Plus to view/submit.
- Checkout refuses internal grants and directs already-paid users to Manage billing instead of opening a second subscription.

## Verification results

- 90 targeted tests passed across 17 files, including billing action/source regressions, entitlement matrix, server guards, AI limits, webhook handling and import action outcomes.
- TypeScript `tsc --noEmit` passed; ESLint passed on the task-owned source and test files; Git diff whitespace check passed.
- Chromium checkout regression passed for Plus, Pro and Coach / Club at 1440px, 390px and 360px (nine plan/viewport combinations). It checked yearly prices, plan IDs, interval preservation, cancellation without provider calls, recoverable checkout/portal failures and horizontal overflow. Screenshots are in `output/playwright/subscription-audit/`.
- Browser launch first failed under the filesystem sandbox; the automatically approved external-sandbox retry ran successfully. The optional Playwright CLI wrapper could not fetch its package due network DNS restrictions, so the repository's installed browser regression tooling supplied the browser evidence.
- The database-dependent integration suite was skipped because its designated fixture database was not enabled. No claim of live subscription persona or payment verification is made.

## Verification scope

Tests cover all five plan levels, feature inheritance, expired grants, inactive/past-due subscriptions, direct server/API rejection, request quotas, UTC resets, existing billing/webhook logic and import action outcomes. Browser checks use a synthetic checkout fixture; they do not charge or call Stripe. Live authenticated personas, Stripe price/currency/interval configuration, portal-enabled plan changes and production rollout remain unverified.

Historical caveat: the initial quota seed uses retained import rows. Imports deleted before this rollout cannot be reconstructed by this audit. Runtime AI monthly-credit limits can be overridden by existing database plan-limit rows; live values were not inspected.

Unrelated in-progress domain and course-twin changes in the shared checkout were preserved. System Git's launcher hit an Xcode licence prompt; the existing Command Line Tools Git binary works directly.

## Page inventory

Every current `page.tsx` is listed; component variants inherit their route boundary. “No new paywall” is an intentional allocation, not a claim that every underlying existing permission check received a security penetration test.

| Route                                     | Subscription treatment                                                       | Source                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `/admin/billing`                          | Administrative role checks; subscription does not grant admin access         | `src/app/(admin)/admin/billing/page.tsx`                        |
| `/admin/challenges`                       | Administrative role checks; subscription does not grant admin access         | `src/app/(admin)/admin/challenges/page.tsx`                     |
| `/admin/moderation`                       | Administrative role checks; subscription does not grant admin access         | `src/app/(admin)/admin/moderation/page.tsx`                     |
| `/admin`                                  | Administrative role checks; subscription does not grant admin access         | `src/app/(admin)/admin/page.tsx`                                |
| `/admin/system-checks`                    | Administrative role checks; subscription does not grant admin access         | `src/app/(admin)/admin/system-checks/page.tsx`                  |
| `/admin/users`                            | Administrative role checks; subscription does not grant admin access         | `src/app/(admin)/admin/users/page.tsx`                          |
| `/achievements`                           | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/achievements/page.tsx`                           |
| `/analyse/compare`                        | Paid page: advanced_analytics                                                | `src/app/(app)/analyse/compare/page.tsx`                        |
| `/analyse/conditions`                     | Paid page: advanced_analytics                                                | `src/app/(app)/analyse/conditions/page.tsx`                     |
| `/analyse`                                | Paid page: advanced_analytics                                                | `src/app/(app)/analyse/page.tsx`                                |
| `/analyse/session-impact`                 | Paid page: advanced_analytics                                                | `src/app/(app)/analyse/session-impact/page.tsx`                 |
| `/analyse/workspace`                      | Paid page: advanced_analytics                                                | `src/app/(app)/analyse/workspace/page.tsx`                      |
| `/bag/[clubId]/analytics`                 | Paid page: advanced_analytics                                                | `src/app/(app)/bag/[clubId]/analytics/page.tsx`                 |
| `/bag/[clubId]`                           | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/bag/[clubId]/page.tsx`                           |
| `/bag/longest`                            | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/bag/longest/page.tsx`                            |
| `/bag`                                    | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/bag/page.tsx`                                    |
| `/billing`                                | All tiers; shared four-plan catalogue; paid changes through customer portal  | `src/app/(app)/billing/page.tsx`                                |
| `/challenges/[challengeId]`               | Participation: all tiers; private creation: Plus; major hosting: Coach       | `src/app/(app)/challenges/[challengeId]/page.tsx`               |
| `/challenges`                             | Participation: all tiers; private creation: Plus; major hosting: Coach       | `src/app/(app)/challenges/page.tsx`                             |
| `/coach/diagnosis`                        | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/coach/diagnosis/page.tsx`                        |
| `/coach`                                  | Basic page available; AI generation checked by feature tier and quotas       | `src/app/(app)/coach/page.tsx`                                  |
| `/coach/reports`                          | Create: Plus; saved history and revocation: all tiers                        | `src/app/(app)/coach/reports/page.tsx`                          |
| `/coach/workspace`                        | Coach roster and writes: Coach; player inbox and completion: all tiers       | `src/app/(app)/coach/workspace/page.tsx`                        |
| `/companion/handoff`                      | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/companion/handoff/page.tsx`                      |
| `/companion/summary`                      | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/companion/summary/page.tsx`                      |
| `/companion-runtime/import/csv`           | Imports: 5 monthly Free / unlimited paid; Square and TrackMan: Pro           | `src/app/(app)/companion-runtime/import/csv/page.tsx`           |
| `/companion-runtime/import`               | Imports: 5 monthly Free / unlimited paid; Square and TrackMan: Pro           | `src/app/(app)/companion-runtime/import/page.tsx`               |
| `/companion-runtime/import/result`        | Imports: 5 monthly Free / unlimited paid; Square and TrackMan: Pro           | `src/app/(app)/companion-runtime/import/result/page.tsx`        |
| `/companion-runtime/rapsodo`              | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/companion-runtime/rapsodo/page.tsx`              |
| `/companion-runtime/today`                | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/companion-runtime/today/page.tsx`                |
| `/compare`                                | Paid page: advanced_analytics                                                | `src/app/(app)/compare/page.tsx`                                |
| `/course-records/[recordId]`              | Public: all tiers; private boards: Plus through canViewRecord                | `src/app/(app)/course-records/[recordId]/page.tsx`              |
| `/course-records`                         | Public: all tiers; private boards: Plus through canViewRecord                | `src/app/(app)/course-records/page.tsx`                         |
| `/course-twins`                           | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/course-twins/page.tsx`                           |
| `/courses/[courseId]/holes`               | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/courses/[courseId]/holes/page.tsx`               |
| `/courses/[courseId]`                     | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/courses/[courseId]/page.tsx`                     |
| `/courses/[courseId]/records/[recordId]`  | Public: all tiers; private boards: Plus through canViewRecord                | `src/app/(app)/courses/[courseId]/records/[recordId]/page.tsx`  |
| `/courses/[courseId]/records`             | Public: all tiers; private boards: Plus through canViewRecord                | `src/app/(app)/courses/[courseId]/records/page.tsx`             |
| `/courses/[courseId]/shot-pattern`        | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/courses/[courseId]/shot-pattern/page.tsx`        |
| `/courses/[courseId]/tournaments`         | Participation: all tiers; private creation: Plus; major hosting: Coach       | `src/app/(app)/courses/[courseId]/tournaments/page.tsx`         |
| `/courses/new`                            | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/courses/new/page.tsx`                            |
| `/courses`                                | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/courses/page.tsx`                                |
| `/courses/strategy`                       | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/courses/strategy/page.tsx`                       |
| `/dashboard`                              | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/dashboard/page.tsx`                              |
| `/data-chat`                              | Basic page available; AI generation checked by feature tier and quotas       | `src/app/(app)/data-chat/page.tsx`                              |
| `/equipment/experiments`                  | Paid page: advanced_analytics                                                | `src/app/(app)/equipment/experiments/page.tsx`                  |
| `/equipment`                              | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/equipment/page.tsx`                              |
| `/feed`                                   | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/feed/page.tsx`                                   |
| `/friends`                                | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/friends/page.tsx`                                |
| `/goals`                                  | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/goals/page.tsx`                                  |
| `/groups/[groupSlug]`                     | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/groups/[groupSlug]/page.tsx`                     |
| `/groups`                                 | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/groups/page.tsx`                                 |
| `/handicap`                               | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/handicap/page.tsx`                               |
| `/import`                                 | Imports: 5 monthly Free / unlimited paid; Square and TrackMan: Pro           | `src/app/(app)/import/page.tsx`                                 |
| `/import/result`                          | Imports: 5 monthly Free / unlimited paid; Square and TrackMan: Pro           | `src/app/(app)/import/result/page.tsx`                          |
| `/leaderboard`                            | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/leaderboard/page.tsx`                            |
| `/partners`                               | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/partners/page.tsx`                               |
| `/play/[courseId]`                        | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/play/[courseId]/page.tsx`                        |
| `/play`                                   | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/play/page.tsx`                                   |
| `/practice`                               | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/practice/page.tsx`                               |
| `/practice/quick-range`                   | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/practice/quick-range/page.tsx`                   |
| `/profile/[username]`                     | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/profile/[username]/page.tsx`                     |
| `/profile`                                | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/profile/page.tsx`                                |
| `/progress`                               | Paid page: advanced_analytics                                                | `src/app/(app)/progress/page.tsx`                               |
| `/providers`                              | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/providers/page.tsx`                              |
| `/quick-bag`                              | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/quick-bag/page.tsx`                              |
| `/rapsodo`                                | Imports: 5 monthly Free / unlimited paid; Square and TrackMan: Pro           | `src/app/(app)/rapsodo/page.tsx`                                |
| `/rounds/[sessionId]`                     | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/rounds/[sessionId]/page.tsx`                     |
| `/rounds/new`                             | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/rounds/new/page.tsx`                             |
| `/rounds`                                 | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/rounds/page.tsx`                                 |
| `/sessions/[sessionId]`                   | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/sessions/[sessionId]/page.tsx`                   |
| `/sessions`                               | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/sessions/page.tsx`                               |
| `/settings/invitations/[token]`           | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/settings/invitations/[token]/page.tsx`           |
| `/settings/notifications`                 | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/settings/notifications/page.tsx`                 |
| `/settings`                               | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/settings/page.tsx`                               |
| `/shared/[userId]`                        | Existing share-token/access controls; no extra recipient subscription        | `src/app/(app)/shared/[userId]/page.tsx`                        |
| `/shots`                                  | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/shots/page.tsx`                                  |
| `/shots/review`                           | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/shots/review/page.tsx`                           |
| `/simulator-lab`                          | Basic page available; AI generation checked by feature tier and quotas       | `src/app/(app)/simulator-lab/page.tsx`                          |
| `/social-intelligence`                    | Generate: Pro; reporting and saved history: all tiers                        | `src/app/(app)/social-intelligence/page.tsx`                    |
| `/speed`                                  | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/speed/page.tsx`                                  |
| `/speed/sessions/[sessionId]`             | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/speed/sessions/[sessionId]/page.tsx`             |
| `/stats/training-over-time`               | Paid page: advanced_analytics                                                | `src/app/(app)/stats/training-over-time/page.tsx`               |
| `/strokes-gained`                         | Paid page: advanced_analytics                                                | `src/app/(app)/strokes-gained/page.tsx`                         |
| `/today`                                  | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/today/page.tsx`                                  |
| `/tournaments/[tournamentId]/leaderboard` | Participation: all tiers; private creation: Plus; major hosting: Coach       | `src/app/(app)/tournaments/[tournamentId]/leaderboard/page.tsx` |
| `/tournaments/[tournamentId]`             | Participation: all tiers; private creation: Plus; major hosting: Coach       | `src/app/(app)/tournaments/[tournamentId]/page.tsx`             |
| `/tournaments/[tournamentId]/rounds`      | Participation: all tiers; private creation: Plus; major hosting: Coach       | `src/app/(app)/tournaments/[tournamentId]/rounds/page.tsx`      |
| `/tournaments/[tournamentId]/rules`       | Participation: all tiers; private creation: Plus; major hosting: Coach       | `src/app/(app)/tournaments/[tournamentId]/rules/page.tsx`       |
| `/tournaments/[tournamentId]/submit`      | Participation: all tiers; private creation: Plus; major hosting: Coach       | `src/app/(app)/tournaments/[tournamentId]/submit/page.tsx`      |
| `/tournaments`                            | Participation: all tiers; private creation: Plus; major hosting: Coach       | `src/app/(app)/tournaments/page.tsx`                            |
| `/welcome`                                | No new paywall: core, public, account, or existing access-controlled surface | `src/app/(app)/welcome/page.tsx`                                |
| `/404`                                    | No new paywall: core, public, account, or existing access-controlled surface | `src/app/404/page.tsx`                                          |
| `/cookies`                                | No new paywall: core, public, account, or existing access-controlled surface | `src/app/cookies/page.tsx`                                      |
| `/login`                                  | No new paywall: core, public, account, or existing access-controlled surface | `src/app/login/page.tsx`                                        |
| `/offline`                                | No new paywall: core, public, account, or existing access-controlled surface | `src/app/offline/page.tsx`                                      |
| `/`                                       | No new paywall: core, public, account, or existing access-controlled surface | `src/app/page.tsx`                                              |
| `/privacy`                                | No new paywall: core, public, account, or existing access-controlled surface | `src/app/privacy/page.tsx`                                      |
| `/share/[token]`                          | Existing share-token/access controls; no extra recipient subscription        | `src/app/share/[token]/page.tsx`                                |
| `/share/course-twin/[token]`              | Existing share-token/access controls; no extra recipient subscription        | `src/app/share/course-twin/[token]/page.tsx`                    |
| `/share/report/[token]`                   | Existing share-token/access controls; no extra recipient subscription        | `src/app/share/report/[token]/page.tsx`                         |
| `/terms`                                  | No new paywall: core, public, account, or existing access-controlled surface | `src/app/terms/page.tsx`                                        |
| `/thank-you`                              | No new paywall: core, public, account, or existing access-controlled surface | `src/app/thank-you/page.tsx`                                    |

## API inventory

| Route                                                       | Subscription treatment                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `/api/ai/challenge-copy`                                    | AI feature-plan guard plus atomic credit/request quotas                          |
| `/api/ai/course-strategy`                                   | AI feature-plan guard plus atomic credit/request quotas                          |
| `/api/ai/data-chat`                                         | AI feature-plan guard plus atomic credit/request quotas                          |
| `/api/ai/practice-recap`                                    | AI feature-plan guard plus atomic credit/request quotas                          |
| `/api/ai/session-roast`                                     | AI feature-plan guard plus atomic credit/request quotas                          |
| `/api/ai/social-caption`                                    | AI feature-plan guard plus atomic credit/request quotas                          |
| `/api/club-images`                                          | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/coach/chat`                                           | AI feature-plan guard plus atomic credit/request quotas                          |
| `/api/coach/summary`                                        | AI feature-plan guard plus atomic credit/request quotas                          |
| `/api/content-exports/[exportId]/image`                     | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/content-exports`                                      | Plus gate before creation; ownership checks retained                             |
| `/api/course-logos`                                         | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/build`                        | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/corrections/[correctionId]`   | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/corrections`                  | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/imagery`                      | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/manifest`                     | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/putting-surveys`              | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/replay`                       | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/rooms/public`                 | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/rooms`                        | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/rounds`                       | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/strategy`                     | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/[courseId]/versions/[versionId]/publish` | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/builds/[buildId]/complete`               | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/builds/batch`                            | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/catalog/import`                          | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/rooms/[roomId]/events`                   | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/rooms/[roomId]`                          | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/rooms/[roomId]/shared-round/events`      | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/rooms/[roomId]/state`                    | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/rooms/join`                              | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/rounds/[roundId]/events`                 | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/rounds/[roundId]`                        | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/course-twins/rounds/[roundId]/tournament`             | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/courses/[courseId]/features/ensure`                   | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/courses/google/elevation`                             | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/courses/google/map`                                   | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/courses/google/search`                                | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/courses/google/street-view`                           | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/courses/osm/holes`                                    | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/courses/osm/search`                                   | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/cron/course-twin-builds`                              | Existing cron authentication; not a customer tier capability                     |
| `/api/cron/course-twin-catalog`                             | Existing cron authentication; not a customer tier capability                     |
| `/api/cron/tour-leaderboards`                               | Existing cron authentication; not a customer tier capability                     |
| `/api/desktop-workbench/commands`                           | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/desktop-workbench/notifications`                      | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/imports/duplicate-check`                              | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/offline/imports`                                      | Shared import service: provider gate, monthly counter and duplicate protection   |
| `/api/offline/round-edits`                                  | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/plays-like`                                           | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/scorecard/extract`                                    | AI feature-plan guard plus atomic credit/request quotas                          |
| `/api/security/csp-report`                                  | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/sessions/[sessionId]/preview-shots`                   | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/settings/export`                                      | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/share-cards/feed/[feedItemId]`                        | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/shot-pattern`                                         | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/shots/[shotId]/evidence`                              | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/social/feed-preview/comment-reactions`                | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/social/feed-preview/comments`                         | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/social/feed-preview/reactions`                        | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/social/feed-preview`                                  | Existing access/ownership/token checks; no new paid feature claimed by catalogue |
| `/api/stripe/webhook`                                       | Signed Stripe webhook; canonical tier entitlements                               |
