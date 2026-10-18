# ForeKingHell route acceptance ledger

All work belongs to the existing ForeKingHell repository. Page review uses the existing green-and-cream design and full-width app contract. Routes marked retained are audited rather than cosmetically rewritten. Screenshots use labelled synthetic fixtures, not David’s live data. Backend ownership, authentication and billing behavior are preserved.

## Review groups

Detailed findings and verification: [Training](page-review-training.md), [Analysis](page-review-analysis.md), [Evidence](page-review-evidence.md), [On-course](page-review-on-course.md), [Social](page-review-social.md), [Account](page-review-account.md). Benchmark methodology and release evidence: [Benchmark intelligence](BENCHMARK_INTELLIGENCE.md).

## Actual route inventory

| Route                                     | Source                                                          | Owner / review record        |
| ----------------------------------------- | --------------------------------------------------------------- | ---------------------------- |
| `/admin/billing`                          | `src/app/(admin)/admin/billing/page.tsx`                        | Account / independent_review |
| `/admin/challenges`                       | `src/app/(admin)/admin/challenges/page.tsx`                     | Account / independent_review |
| `/admin/moderation`                       | `src/app/(admin)/admin/moderation/page.tsx`                     | Account / independent_review |
| `/admin`                                  | `src/app/(admin)/admin/page.tsx`                                | Account / independent_review |
| `/admin/system-checks`                    | `src/app/(admin)/admin/system-checks/page.tsx`                  | Account / independent_review |
| `/admin/users`                            | `src/app/(admin)/admin/users/page.tsx`                          | Account / independent_review |
| `/achievements`                           | `src/app/(app)/achievements/page.tsx`                           | Social / audit_foundation    |
| `/analyse/compare`                        | `src/app/(app)/analyse/compare/page.tsx`                        | Analysis / current_form      |
| `/analyse/conditions`                     | `src/app/(app)/analyse/conditions/page.tsx`                     | Analysis / current_form      |
| `/analyse`                                | `src/app/(app)/analyse/page.tsx`                                | Analysis / current_form      |
| `/analyse/session-impact`                 | `src/app/(app)/analyse/session-impact/page.tsx`                 | Analysis / current_form      |
| `/analyse/workspace`                      | `src/app/(app)/analyse/workspace/page.tsx`                      | Analysis / current_form      |
| `/bag/[clubId]/analytics`                 | `src/app/(app)/bag/[clubId]/analytics/page.tsx`                 | Bag / coordinator            |
| `/bag/[clubId]`                           | `src/app/(app)/bag/[clubId]/page.tsx`                           | Bag / coordinator            |
| `/bag/longest`                            | `src/app/(app)/bag/longest/page.tsx`                            | Bag / coordinator            |
| `/bag`                                    | `src/app/(app)/bag/page.tsx`                                    | Bag / coordinator            |
| `/billing`                                | `src/app/(app)/billing/page.tsx`                                | Account / independent_review |
| `/challenges/[challengeId]`               | `src/app/(app)/challenges/[challengeId]/page.tsx`               | Social / audit_foundation    |
| `/challenges`                             | `src/app/(app)/challenges/page.tsx`                             | Social / audit_foundation    |
| `/coach/diagnosis`                        | `src/app/(app)/coach/diagnosis/page.tsx`                        | Training / audit_practice    |
| `/coach`                                  | `src/app/(app)/coach/page.tsx`                                  | Training / audit_practice    |
| `/coach/reports`                          | `src/app/(app)/coach/reports/page.tsx`                          | Training / audit_practice    |
| `/coach/workspace`                        | `src/app/(app)/coach/workspace/page.tsx`                        | Training / audit_practice    |
| `/companion/handoff`                      | `src/app/(app)/companion/handoff/page.tsx`                      | Evidence / import_speed      |
| `/companion/summary`                      | `src/app/(app)/companion/summary/page.tsx`                      | Evidence / import_speed      |
| `/companion-runtime/import/csv`           | `src/app/(app)/companion-runtime/import/csv/page.tsx`           | Evidence / import_speed      |
| `/companion-runtime/import`               | `src/app/(app)/companion-runtime/import/page.tsx`               | Evidence / import_speed      |
| `/companion-runtime/import/result`        | `src/app/(app)/companion-runtime/import/result/page.tsx`        | Evidence / import_speed      |
| `/companion-runtime/rapsodo`              | `src/app/(app)/companion-runtime/rapsodo/page.tsx`              | Evidence / import_speed      |
| `/companion-runtime/today`                | `src/app/(app)/companion-runtime/today/page.tsx`                | Evidence / import_speed      |
| `/compare`                                | `src/app/(app)/compare/page.tsx`                                | Analysis / current_form      |
| `/course-records/[recordId]`              | `src/app/(app)/course-records/[recordId]/page.tsx`              | On-course / audit_ui         |
| `/course-records`                         | `src/app/(app)/course-records/page.tsx`                         | On-course / audit_ui         |
| `/course-twins`                           | `src/app/(app)/course-twins/page.tsx`                           | On-course / audit_ui         |
| `/courses/[courseId]/holes`               | `src/app/(app)/courses/[courseId]/holes/page.tsx`               | On-course / audit_ui         |
| `/courses/[courseId]`                     | `src/app/(app)/courses/[courseId]/page.tsx`                     | On-course / audit_ui         |
| `/courses/[courseId]/records/[recordId]`  | `src/app/(app)/courses/[courseId]/records/[recordId]/page.tsx`  | On-course / audit_ui         |
| `/courses/[courseId]/records`             | `src/app/(app)/courses/[courseId]/records/page.tsx`             | On-course / audit_ui         |
| `/courses/[courseId]/shot-pattern`        | `src/app/(app)/courses/[courseId]/shot-pattern/page.tsx`        | On-course / audit_ui         |
| `/courses/[courseId]/tournaments`         | `src/app/(app)/courses/[courseId]/tournaments/page.tsx`         | On-course / audit_ui         |
| `/courses/new`                            | `src/app/(app)/courses/new/page.tsx`                            | On-course / audit_ui         |
| `/courses`                                | `src/app/(app)/courses/page.tsx`                                | On-course / audit_ui         |
| `/courses/strategy`                       | `src/app/(app)/courses/strategy/page.tsx`                       | On-course / audit_ui         |
| `/dashboard`                              | `src/app/(app)/dashboard/page.tsx`                              | Training / audit_practice    |
| `/data-chat`                              | `src/app/(app)/data-chat/page.tsx`                              | Training / audit_practice    |
| `/equipment/experiments`                  | `src/app/(app)/equipment/experiments/page.tsx`                  | Analysis / current_form      |
| `/equipment/launch-monitors/calibration`  | `src/app/(app)/equipment/launch-monitors/calibration/page.tsx`  | Analysis / current_form      |
| `/equipment`                              | `src/app/(app)/equipment/page.tsx`                              | Analysis / current_form      |
| `/feed`                                   | `src/app/(app)/feed/page.tsx`                                   | Social / audit_foundation    |
| `/friends`                                | `src/app/(app)/friends/page.tsx`                                | Social / audit_foundation    |
| `/goals`                                  | `src/app/(app)/goals/page.tsx`                                  | Analysis / current_form      |
| `/groups/[groupSlug]`                     | `src/app/(app)/groups/[groupSlug]/page.tsx`                     | Social / audit_foundation    |
| `/groups`                                 | `src/app/(app)/groups/page.tsx`                                 | Social / audit_foundation    |
| `/handicap`                               | `src/app/(app)/handicap/page.tsx`                               | Analysis / current_form      |
| `/import`                                 | `src/app/(app)/import/page.tsx`                                 | Evidence / import_speed      |
| `/import/result`                          | `src/app/(app)/import/result/page.tsx`                          | Evidence / import_speed      |
| `/leaderboard`                            | `src/app/(app)/leaderboard/page.tsx`                            | Social / audit_foundation    |
| `/partners`                               | `src/app/(app)/partners/page.tsx`                               | Social / audit_foundation    |
| `/play/[courseId]`                        | `src/app/(app)/play/[courseId]/page.tsx`                        | On-course / audit_ui         |
| `/play`                                   | `src/app/(app)/play/page.tsx`                                   | On-course / audit_ui         |
| `/practice`                               | `src/app/(app)/practice/page.tsx`                               | Training / audit_practice    |
| `/practice/quick-range`                   | `src/app/(app)/practice/quick-range/page.tsx`                   | Training / audit_practice    |
| `/profile/[username]`                     | `src/app/(app)/profile/[username]/page.tsx`                     | Social / audit_foundation    |
| `/profile`                                | `src/app/(app)/profile/page.tsx`                                | Social / audit_foundation    |
| `/progress`                               | `src/app/(app)/progress/page.tsx`                               | Analysis / current_form      |
| `/providers`                              | `src/app/(app)/providers/page.tsx`                              | Evidence / import_speed      |
| `/quick-bag`                              | `src/app/(app)/quick-bag/page.tsx`                              | Analysis / current_form      |
| `/rapsodo`                                | `src/app/(app)/rapsodo/page.tsx`                                | Evidence / import_speed      |
| `/rounds/[sessionId]`                     | `src/app/(app)/rounds/[sessionId]/page.tsx`                     | On-course / audit_ui         |
| `/rounds/new`                             | `src/app/(app)/rounds/new/page.tsx`                             | On-course / audit_ui         |
| `/rounds`                                 | `src/app/(app)/rounds/page.tsx`                                 | On-course / audit_ui         |
| `/sessions/[sessionId]`                   | `src/app/(app)/sessions/[sessionId]/page.tsx`                   | Evidence / import_speed      |
| `/sessions`                               | `src/app/(app)/sessions/page.tsx`                               | Evidence / import_speed      |
| `/settings/invitations/[token]`           | `src/app/(app)/settings/invitations/[token]/page.tsx`           | Account / independent_review |
| `/settings/notifications`                 | `src/app/(app)/settings/notifications/page.tsx`                 | Account / independent_review |
| `/settings`                               | `src/app/(app)/settings/page.tsx`                               | Account / independent_review |
| `/shared/[userId]`                        | `src/app/(app)/shared/[userId]/page.tsx`                        | Social / audit_foundation    |
| `/shots`                                  | `src/app/(app)/shots/page.tsx`                                  | Evidence / import_speed      |
| `/shots/review`                           | `src/app/(app)/shots/review/page.tsx`                           | Evidence / import_speed      |
| `/simulator-lab`                          | `src/app/(app)/simulator-lab/page.tsx`                          | On-course / audit_ui         |
| `/social-intelligence`                    | `src/app/(app)/social-intelligence/page.tsx`                    | Social / audit_foundation    |
| `/speed`                                  | `src/app/(app)/speed/page.tsx`                                  | Training / audit_practice    |
| `/speed/sessions/[sessionId]`             | `src/app/(app)/speed/sessions/[sessionId]/page.tsx`             | Training / audit_practice    |
| `/stats/training-over-time`               | `src/app/(app)/stats/training-over-time/page.tsx`               | Analysis / current_form      |
| `/strokes-gained`                         | `src/app/(app)/strokes-gained/page.tsx`                         | Analysis / current_form      |
| `/today`                                  | `src/app/(app)/today/page.tsx`                                  | Training / audit_practice    |
| `/tournaments/[tournamentId]/leaderboard` | `src/app/(app)/tournaments/[tournamentId]/leaderboard/page.tsx` | Social / audit_foundation    |
| `/tournaments/[tournamentId]`             | `src/app/(app)/tournaments/[tournamentId]/page.tsx`             | Social / audit_foundation    |
| `/tournaments/[tournamentId]/rounds`      | `src/app/(app)/tournaments/[tournamentId]/rounds/page.tsx`      | Social / audit_foundation    |
| `/tournaments/[tournamentId]/rules`       | `src/app/(app)/tournaments/[tournamentId]/rules/page.tsx`       | Social / audit_foundation    |
| `/tournaments/[tournamentId]/submit`      | `src/app/(app)/tournaments/[tournamentId]/submit/page.tsx`      | Social / audit_foundation    |
| `/tournaments`                            | `src/app/(app)/tournaments/page.tsx`                            | Social / audit_foundation    |
| `/welcome`                                | `src/app/(app)/welcome/page.tsx`                                | Training / audit_practice    |
| `/404`                                    | `src/app/404/page.tsx`                                          | Account / independent_review |
| `/cookies`                                | `src/app/cookies/page.tsx`                                      | Account / independent_review |
| `/login`                                  | `src/app/login/page.tsx`                                        | Account / independent_review |
| `/offline`                                | `src/app/offline/page.tsx`                                      | Account / independent_review |
| `/`                                       | `src/app/page.tsx`                                              | Account / independent_review |
| `/privacy`                                | `src/app/privacy/page.tsx`                                      | Account / independent_review |
| `/share/[token]`                          | `src/app/share/[token]/page.tsx`                                | Account / independent_review |
| `/share/course-twin/[token]`              | `src/app/share/course-twin/[token]/page.tsx`                    | Account / independent_review |
| `/share/report/[token]`                   | `src/app/share/report/[token]/page.tsx`                         | Account / independent_review |
| `/terms`                                  | `src/app/terms/page.tsx`                                        | Account / independent_review |
| `/thank-you`                              | `src/app/thank-you/page.tsx`                                    | Account / independent_review |

Total: **104 actual page routes**, including aliases, share pages, public pages and administrator pages. API handlers are background functionality, not pages.

## Acceptance and limitations

Each group records route-specific changes, retained behavior and actual verification. Shared acceptance: navigation preserved; accessible labels and recovery actions; no page-wide overflow in representative responsive fixtures; no invented user values; no imports or database migrations. A fixture screenshot does not establish authenticated end-to-end route success. Live authenticated data and administrative/billing actions have not been exercised.

Integrated verification passes: 3,317 unit tests (195 skipped), seven actual-component synthetic browser matrices at 390/768/1440/1920 widths, production build, route budgets, formatting, TypeScript, migration-file checks and lint (one pre-existing test warning). The separately approved dependency repair passes the unchanged gate with zero high/critical findings; 11 moderate findings remain. No audit rule or exception is weakened, and unrelated PR101 remains unmerged. Remote release confirmation is recorded in the delivery report after publication.
