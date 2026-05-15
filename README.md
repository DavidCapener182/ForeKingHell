# ForeKingHell

Golf analytics and social competition web app for importing launch-monitor data, preserving every non-empty CSV row, and turning shots, rounds, bag gapping, progress, achievements, feed posts, friends, groups, challenges and coaching signals into a Postgres-backed improvement platform.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Drizzle ORM
- Supabase Postgres-compatible database
- Vitest
- Playwright, axe, and Lighthouse smoke coverage

## Setup

```bash
npm install
cp .env.example .env
```

Set `DATABASE_URL` to your Supabase Postgres connection string. Configure Supabase Auth with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` so runtime data access is scoped to the signed-in user.

For billing, set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the plan price IDs:

- `STRIPE_PLUS_MONTHLY_PRICE_ID`
- `STRIPE_PLUS_YEARLY_PRICE_ID`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `STRIPE_COACH_MONTHLY_PRICE_ID`
- `STRIPE_COACH_YEARLY_PRICE_ID`

Point Stripe webhooks at `/api/stripe/webhook`. The handler verifies `Stripe-Signature` and processes `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`.

`FKH_BASIC_AUTH_PASSWORD` remains available as an optional extra private deployment gate, but it is no longer a substitute for Supabase Auth.

## Commands

```bash
npm run dev
npm run test
npm run lint
npm run build
npm run test:e2e
npm run test:lighthouse
npm run db:generate
npm run db:migrate
```

Authenticated Playwright coverage is opt-in because Supabase sessions are cookie backed. Capture a logged-in storage state and run with `PLAYWRIGHT_AUTH_STATE=/absolute/path/to/state.json npm run test:e2e` to exercise import, mobile density, user isolation, social graph/feed, challenge, billing and coach checks. Without that env var, the public auth and login accessibility checks still run.

`npm run test:lighthouse` audits `/login` by default against `next start`. Set `LIGHTHOUSE_ROUTES=/login,/dashboard` and `LIGHTHOUSE_COOKIE` or `LIGHTHOUSE_EXTRA_HEADERS_JSON` when auditing authenticated routes.

## Current Product Scope

- `/dashboard` summarizes the latest sessions, totals, trends, and next actions.
- `/import` previews Rapsodo MLM2PRO CSV files, supports manual column mapping when export headers change, defaults unknown distance units to yards, and saves raw CSV plus normalized shot rows. Simulated-course imports can include a scorecard so shot order is inferred into hole overlays.
- `/shots` is a paginated shot explorer with filters for club, session, shot category, date range, and file/course search. Advanced metrics remain available in expandable row details.
- `/bag` and `/bag/[clubId]` analyze club gapping, stock yardages, dispersion, longest shots, and per-club analytics.
- `/rounds`, `/rounds/new`, and `/rounds/[sessionId]` support manual rounds, linked course scorecards, shot-to-hole assignment, and hole scoring.
- `/feed`, `/friends`, `/profile`, `/groups`, `/challenges`, and `/leaderboard` provide social profiles, friend requests, privacy-first feed cards, group homes, competition boards, podiums, comments, kudos, reporting and leaderboard opt-in.
- `/billing` is the pricing and entitlement surface for Free, Plus, Pro, Coach/Club and internal lifetime-full access.
- `/providers` is the import hub for Rapsodo live, Square beta/coming soon and TrackMan coming soon adapters.
- `/partners` and `/admin` are role-gated operational surfaces for sponsors, offers, fulfilment, billing, moderation, challenges and site health.
- `/social-intelligence` is presented as Recaps & Safety for weekly recaps, challenge recaps, reports and suspicious social activity.
- `/handicap`, `/courses`, `/progress`, `/coach`, and `/achievements` add playing trends, course data, practice priorities, AI-assisted coaching, XP, and achievement tracking.

## Social, Privacy, and RLS

- Run all migrations through `0018_billing_webhook_templates.sql` before enabling social traffic.
- Profiles are private by default. Public username search, friend-visible profile detail, generated feed visibility, leaderboard visibility, and granular rounds/PBs/bag/achievements/handicap/practice/exact-shot visibility are user controlled.
- Friendships do not grant account access. Coach/viewer/editor account access remains separate in settings.
- RLS policies use the `fkh_` social helpers for feed, profile, challenge and group visibility. Verify anon and authenticated roles in the target Supabase project after migration.
- Admin and partner pages require active admin rows in `fkh_admin_users`.

## Provider and Rapsodo Setup

- Rapsodo CSV import is live through `/import`; Rapsodo Cloud token support uses `RAPSODO_TOKEN_SECRET` and `RAPSODO_API_BASE_URL`.
- Provider adapter metadata is stored in provider account/session/source-file/import-job tables and scoped to the signed-in user.
- Keep raw provider metadata available for debugging, but avoid exposing it as primary mobile UI.

## Data Notes

- Shot distances are stored in yards, apex is stored in feet, speeds are stored in mph, and angles are stored in degrees.
- Every non-empty CSV row is preserved in `fkh_import_rows`, while actual shot rows are also normalized into `fkh_shots`.
- Session imports store the original CSV text and a SHA-256 `raw_csv_hash`; duplicate import detection uses player + source + hash so renamed files do not import twice.
- The schema includes shared-database-safe tables prefixed with `fkh_`: users, clubs, sessions, import rows, shots, stock yardages, courses, tee sets, holes, achievements, XP ledger, progress, and achievement sync state.
- Simulated-course metadata is stored on sessions and shots: course name, scorecard JSON, inferred hole number, shot number within the hole, par, yardage, and remaining distance.
- Date-only session values are normalized at UTC noon so trend charts are stable across deployment time zones.

## Deployment Safety

ForeKingHell now has the public-release auth foundation, but do not expose it broadly until Supabase Auth providers, RLS migrations, privacy controls, and role-scoped access are verified in the target project. The current hardening layer includes:

- Supabase Auth-backed user identity for runtime reads and mutations.
- Drizzle/RLS migration foundations for owner, coach, viewer, and editor access.
- Optional Basic auth middleware controlled by `FKH_BASIC_AUTH_PASSWORD`.
- User-scoped shot explorer queries and tighter user/session scoping on round mutations.
- Rate limits and request-size limits on OpenAI-backed coach and scorecard extraction routes.
- Scorecard image data URL size validation before OpenAI requests are sent.

Before a public launch, run `npm run db:migrate`, enable the configured Supabase Auth providers, test RLS with anon/authenticated roles, and publish privacy/export/delete controls.
