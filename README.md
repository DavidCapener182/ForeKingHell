# ForeKingHell

Personal golf analytics and social competition app for importing Rapsodo CSV data, preserving every non-empty CSV row, and turning launch-monitor shots, rounds, bag gapping, progress, achievements, coaching signals, friend feeds, groups, challenges, billing entitlements, and provider imports into a Postgres-backed golf improvement network.

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

Set `DATABASE_URL` to your Supabase Postgres connection string. Configure Supabase Auth with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` so runtime data access is scoped to the signed-in user and server-side admin jobs can run safely.

`FKH_BASIC_AUTH_PASSWORD` remains available as an optional extra private deployment gate, but it is no longer a substitute for Supabase Auth.

### Stripe billing setup

Billing uses Stripe Checkout, the customer portal, and the App Router webhook at `/api/stripe/webhook`.

1. Add `STRIPE_SECRET_KEY`.
2. Add `STRIPE_WEBHOOK_SECRET` from the Stripe CLI or Dashboard webhook endpoint.
3. Add all plan price IDs: `STRIPE_PLUS_MONTHLY_PRICE_ID`, `STRIPE_PLUS_YEARLY_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_YEARLY_PRICE_ID`, `STRIPE_COACH_MONTHLY_PRICE_ID`, and `STRIPE_COACH_YEARLY_PRICE_ID`.
4. Point Stripe webhooks at `https://your-domain.example/api/stripe/webhook` and subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`.
5. Keep the Billing Portal enabled in Stripe so `/billing` can open subscription management for linked customers.

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

Authenticated Playwright coverage is opt-in because Supabase sessions are cookie backed. Capture a logged-in storage state and run with `PLAYWRIGHT_AUTH_STATE=/absolute/path/to/state.json npm run test:e2e` to exercise the import wizard, mobile shot explorer, round scorecard, PWA offline queue, and coach chat checks. Without that env var, the public auth and login accessibility checks still run.

`npm run test:lighthouse` audits `/login` by default against `next start`. Set `LIGHTHOUSE_ROUTES=/login,/dashboard` and `LIGHTHOUSE_COOKIE` or `LIGHTHOUSE_EXTRA_HEADERS_JSON` when auditing authenticated routes.

## Current Product Scope

### Social, challenges, and platform routes

- `/feed` is the Strava-style golf network home with daily digests, filters, kudos, comments, share cards, verification labels, visibility controls, hide/delete actions, and reporting.
- `/friends` supports username search, friend requests, accepted friends, outgoing requests, blocking, and QR/link invite onboarding.
- `/profile` exposes a privacy-first public profile with username, feed default visibility, leaderboard visibility, granular round/PB/bag/achievement/handicap/practice/exact-shot settings, and QR invite support.
- `/groups` and `/groups/[groupSlug]` provide private-by-default society/coach/group homes with feed, leaderboard, challenges, members, invite, and settings surfaces.
- `/challenges` is a competition hub with a featured monthly challenge, active entries, friend/public board counts, challenge templates, and create flow.
- `/challenges/[challengeId]` is an event page with join/submit attempt, podium cards, full leaderboard, verification labels, anti-gaming flags, comments, and friend invites.
- `/leaderboard` covers friends, monthly, challenges, public opt-in, podium/rank contexts, filters, and verification chips.
- `/billing` is the pricing and entitlement page for Free, Plus, Pro, Coach/Club, and internal Lifetime Full access.
- `/providers` is the import hub for Rapsodo live/CSV, Square beta/coming soon, TrackMan coming soon, field mapping, normalisation, and import job status.
- `/partners`, `/admin`, `/admin/users`, `/admin/billing`, `/admin/challenges`, and `/admin/moderation` are role-gated operational/sponsor/admin surfaces.
- `/social-intelligence` is presented as Recaps & Safety for weekly recaps, challenge recaps, moderation, suspicious attempts, and reported comments.


- `/dashboard` summarizes the latest sessions, totals, trends, and next actions.
- `/import` previews Rapsodo MLM2PRO CSV files, supports manual column mapping when export headers change, defaults unknown distance units to yards, and saves raw CSV plus normalized shot rows. Simulated-course imports can include a scorecard so shot order is inferred into hole overlays.
- `/shots` is a paginated shot explorer with filters for club, session, shot category, date range, and file/course search. Advanced metrics remain available in expandable row details.
- `/bag` and `/bag/[clubId]` analyze club gapping, stock yardages, dispersion, longest shots, and per-club analytics.
- `/rounds`, `/rounds/new`, and `/rounds/[sessionId]` support manual rounds, linked course scorecards, shot-to-hole assignment, and hole scoring.
- `/handicap`, `/courses`, `/progress`, `/coach`, and `/achievements` add playing trends, course data, practice priorities, AI-assisted coaching, XP, and achievement tracking.

## Database, RLS, and migrations

Run `npm run db:migrate` before testing social or billing flows. The social/platform foundation is in the Drizzle migrations, including social profiles, feed items, comments/reactions, friendships, blocks, challenges, challenge attempts/results/comments, groups, group memberships/posts, billing customers/subscriptions/entitlements, provider import jobs, partner offers, social reports, moderation events, and admin audit rows.

RLS expectations:

- Users can read and mutate their own private rows.
- Friend-only feed/profile/challenge rows are visible only to accepted friends and never to blocked users.
- Private profiles and private challenges cannot be opened by strangers.
- Group rows are private by default and scoped to active members or admins.
- Billing customers, subscriptions, and entitlements are owner-readable; webhook writes are server-side only.
- Partner and admin routes should be shown only to users with the correct role or entitlement.

Admin setup is intentionally explicit: grant owner/operator accounts with the admin tools or a trusted database migration, then verify admin navigation and `/partners` visibility before public launch.

## Data Notes

- Shot distances are stored in yards, apex is stored in feet, speeds are stored in mph, and angles are stored in degrees.
- Every non-empty CSV row is preserved in `fkh_import_rows`, while actual shot rows are also normalized into `fkh_shots`.
- Session imports store the original CSV text and a SHA-256 `raw_csv_hash`; duplicate import detection uses player + source + hash so renamed files do not import twice.
- The schema includes shared-database-safe tables prefixed with `fkh_`: users, clubs, sessions, import rows, shots, stock yardages, courses, tee sets, holes, achievements, XP ledger, progress, social profiles/feed/friends/groups/challenges, billing customers/subscriptions/entitlements, provider adapters/jobs, partners, moderation, admin audit rows, and achievement sync state.
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

Before a public launch, run `npm run db:migrate`, enable the configured Supabase Auth providers, set Stripe webhook secrets and price IDs, test RLS with anon/authenticated roles, verify private profile/block/group/challenge visibility, run the billing webhook tests, and publish privacy/export/delete controls.
