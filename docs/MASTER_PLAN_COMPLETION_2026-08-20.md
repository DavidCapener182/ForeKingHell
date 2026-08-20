# Integrated master-plan completion — 20 August 2026

This document records the completed repository-wide ForeKingHell upgrade and the final production
release gate. The exhaustive route inventory and ownership map lives in
[`ROUTE_MAP.md`](./ROUTE_MAP.md); this document records the cross-route changes, migrations,
verification evidence and remaining external constraints.

## Architecture and product changes

- Desktop navigation now converges on Home, Practice, Sessions, Rounds, Strategy / Course Twin,
  Bag, Insights, Data and Settings, with role-gated Admin kept separate.
- The phone companion has exactly five primary destinations: Today, Practice, Strategy, Review and
  Bag. Profile, settings and secondary tools live behind the profile affordance. Dense desktop-only
  tools use an explicit companion handoff rather than downloading a hidden workbench.
- Shot evidence now has a reversible lifecycle. Suggested exclusions, user exclusions, restore
  events and legacy compatibility tags feed one eligibility boundary. Raw source rows remain intact,
  and trusted analytical consumers use only included/restored evidence.
- Stock yardages are recomputed by owner, club and play context after review changes. The live
  lifecycle-affected stock group was rebuilt after the migration ledger repair.
- Practice, speed development, session review, comparisons, rounds, Course Twin, coaching,
  achievements, challenges, records and public leaderboards share the lifecycle-aware evidence
  rules introduced by the integrated workflow release.
- Course Twin now selects high, balanced or 2D fallback rendering from device signals and explicit
  quality overrides. The fallback keeps an accessible overhead plan and avoids WebGL; server
  rendering uses a deterministic snapshot before the browser quality probe.
- Shared loading and error/retry boundaries cover the authenticated app. Import offline queuing,
  partial/empty states and slow-document recovery are exercised in browser acceptance tests.
- Structured product events cover completed review, practice, round, strategy and export workflows.
  The allowlist rejects account IDs, raw shot values and arbitrary payload keys.
- `src/domain` provides typed Shot, Session, Club, ClubVersion, Course, Hole, Strategy,
  PracticePlan, Round and Goal boundaries plus service interfaces.

## Route-by-route change log

| Routes                                                                                         | Primary decision and completed change                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/login`, `/welcome`, `/privacy`                                                          | Complete public product story, accessible authentication and resumable real-account activation; no visitor golf data is read.                                                               |
| `/today`, `/dashboard`                                                                         | Today is the companion action home; Dashboard remains the evidence-dense desktop command centre.                                                                                            |
| `/practice`, `/practice/quick-range`, `/speed`, `/speed/sessions/[sessionId]`                  | Goal-led plans, measurable completion, debrief events, speed ladder/guardrails and mobile practice execution.                                                                               |
| `/sessions`, `/sessions/[sessionId]`, `/shots`, `/compare`                                     | Master-detail review, URL-derived focus and comparison, reversible exclude/restore, suggestions and raw-source history. `/shots` hands companion users to Review or the explicit full site. |
| `/rounds`, `/rounds/new`, `/rounds/[sessionId]`, `/handicap`                                   | Lifecycle-clean round mapping/recalculation, score/decision review, Course Twin linkage and round creation telemetry.                                                                       |
| `/bag`, `/quick-bag`, `/bag/[clubId]`, `/bag/[clubId]/analytics`, `/bag/longest`, `/equipment` | Trusted carry/gapping evidence, confidence and context-aware stock, club analytics, equipment epochs and fast companion reference.                                                          |
| `/courses/strategy`, `/course-twins`, `/play`, `/play/[courseId]`, `/courses/**`               | Map-first companion strategy, full desktop Course Twin planning, quality tiers, accessible 2D fallback and owner-scoped saved plans/favourites.                                             |
| `/analyse/**`, `/progress`, `/strokes-gained`, `/simulator-lab`                                | Question-led lifecycle-clean analysis, source-linked evidence, comparison and change review. Raw ledgers remain deliberately separate.                                                      |
| `/coach`, `/data-chat`, `/goals`, `/stats/training-over-time`                                  | Deterministic diagnosis remains available; Data Chat reports its real entitlement state; goals and training evidence use the shared lifecycle boundary.                                     |
| `/import`, `/import/result`, `/rapsodo`, `/providers`                                          | Guided CSV mapping/validation, offline queue, duplicate/reconciliation handling, reversible committed data and provider status.                                                             |
| `/achievements`, `/challenges/**`, `/tournaments/**`, `/leaderboard`, `/course-records/**`     | New rewards, personal bests, records and competition evidence exclude untrusted shots and preserve restored evidence.                                                                       |
| `/feed`, `/friends`, `/groups/**`, `/profile/**`, `/shared/**`, `/share/**`                    | Privacy-aware social projections and explicit collaborator/bearer-token surfaces retain owner and visibility boundaries.                                                                    |
| `/settings/**`, `/billing`, `/partners`, `/admin/**`                                           | Profile-owned settings, export workflow telemetry, entitlement surfaces and server-validated role gates. Admin remains outside personal navigation.                                         |

## Merged routes, deep links and redirects

- No public or authenticated deep link was deleted in this release.
- `/dashboard` remains a supported desktop overview while `/today` owns the companion-home decision.
- `/compare` remains a supported deep link and is also discoverable through the Analyse/Sessions
  ownership model.
- Surface routes preserve explicit user intent: `/surface/companion?next=…` selects the companion;
  `/surface/workbench?next=…` selects the desktop workbench. Desktop-only companion requests receive
  a handoff with relevant alternatives.
- Internal `/companion-runtime/*` rewrites remain implementation routes and are not primary
  navigation destinations.

## Database migrations and rollback notes

- `0055_account_course_favourites.sql`: owner-scoped favourites plus explicit authenticated
  `SELECT`, `INSERT` and `DELETE` grants. The production repair first revokes excess inherited
  privileges. Rollback: revoke the three grants and drop the table only after exporting any saved
  favourites.
- `0056_shot_review_lifecycle.sql`: replay-safe review columns, constraints, audit-event table,
  legacy classification and owner-select RLS. Production already contained part of this schema, so
  the migration was made idempotent before repairing the Drizzle ledger. Rollback should be a
  forward migration that disables review writes and preserves audit rows; dropping columns/events
  would destroy provenance and is not recommended.
- `0057_shot_review_warm_up_security_repair.sql`: idempotently classifies untouched legacy warm-up
  rows, inserts one audit event and removes browser mutation grants. Rollback requires restoring the
  prior lifecycle state from the audit event inside a transaction; do not broad-update tags.
- `0058_shot_mutation_security.sql`: makes the Supabase Data API read-only for shots and removes
  direct session delete/truncate cascade bypasses. Trusted server workflows continue through the
  private database connection. Rollback is an explicit least-privilege grant migration, never a
  broad `GRANT ALL`.

Production ledger readback after `npm run db:migrate` is through `0058`. Production grants were read
back as favourites `SELECT/INSERT/DELETE`, shots `SELECT`, and shot-review events `SELECT` for the
authenticated role. The review-event table had one event, one non-included shot and no duplicate
migration-event groups. The lifecycle stock rebuild updated one affected group without inserting or
deleting history.

## Verification evidence

- `npx vitest run`: 445 files and 2,024 tests passed, including the final Course Twin SSR regression
  coverage.
- `npx tsc --noEmit --pretty false`: passed after the final SSR fix.
- `npx drizzle-kit check`: passed.
- `npm audit --audit-level=high`: passed with no high or critical advisory.
- `npm run build`: passed; 25/25 static pages generated.
- `npm run check:route-budgets`: all 21 monitored routes passed their JavaScript budgets.
- Authenticated local browser acceptance: 14/14 app-flow tests passed, including CSV mapping,
  offline queue/retry, slow-document recovery, companion review and honest Data Chat entitlement.
- Accessibility/interaction checks passed for exactly five primary tabs, 44px targets and visible
  focus, reduced motion, 200% reflow and labelled chart alternatives.
- The low-power Course Twin browser check passed after fixing the SSR device probe.
- The exact width audit passed at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 CSS pixels for
  the public routes plus Today, Practice, Sessions, Strategy and Bag: 2/2 Playwright matrix tests.
- `npm run security:rls-live`: the rollback-only owner/coach/viewer/editor/friend/stranger/blocked/
  moderator/admin/anonymous matrix passed in production.
- `npm run security:shot-review-live`: rollback-only owner/stranger import visibility,
  exclude/restore, raw-source preservation, exact event sequence and client mutation denial passed.
  Fixture rows were rolled back; the residual probe returned zero fixture users.

## Evidence-backed limitations

- A two-disposable-account, mutating browser run against production cannot be performed from this
  checkout: no production service-role key or two disposable authenticated states are available.
  The only stored real state belongs to a populated non-test account and its refresh token is no
  longer reusable, so it was not mutated. Production authorization was instead verified with the
  rollback-only JWT-role SQL matrices. Completing the separate browser proof requires two fresh
  disposable Supabase accounts/states and an exact cleanup identity.
- Historical achievements, XP, social claims and accepted practice/record artifacts cannot be
  safely rewritten when their original rows lack deterministic shot provenance. New awards are
  lifecycle-clean; retroactive revocation needs the provenance/compensating-entry schema described
  in [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md).
- The full dependency audit has 10 moderate transitive advisories under OpenTelemetry/Vercel and
  esbuild/Drizzle tooling. No high or critical advisory remains, and npm's suggested fixes require
  breaking dependency changes.
- Rapsodo Cloud, OpenAI, Stripe and Google enrichment retain the environment/provider constraints
  listed in [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md); their deterministic fallback and
  unavailable states remain visible rather than using fake production data.
