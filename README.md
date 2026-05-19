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
npm run format
npm run format:check
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

- `/dashboard` is the data command centre: latest signal, data health, compact metrics, action centre, on-course decisions, practice priorities, tools and social pulse.
- `/import` and `/rapsodo` are the tester-first Rapsodo flow: connect/sync or upload CSV, review import quality, map clubs, preserve source files, surface eligible records/challenges/tournaments only after data checks.
- `/shots` is a paginated shot explorer with filters, saved views, compact mobile shot cards and expandable advanced launch data.
- `/bag`, `/bag/[clubId]`, `/bag/[clubId]/analytics`, and `/bag/longest` cover stock yardages, gapping ladder, target-distance recommendations, club identity cards, dispersion, longest shots and coach links.
- `/rounds`, `/rounds/new`, and `/rounds/[sessionId]` support latest-round review, scorecards, shot-to-hole assignment, round opportunities, handicap eligibility and record/tournament proof.
- `/handicap`, `/progress`, `/coach`, `/strokes-gained`, and `/achievements` cover trend confidence, weekly recaps, practice mode, coach confidence, XP and achievement categories.
- `/courses`, `/courses/new`, `/courses/[courseId]/holes`, `/courses/[courseId]/records`, and `/course-records` provide course hubs, Google/OSM/manual course setup, course data quality, source labels, champion boards, proof tiers, goals and record notifications.
- `/challenges`, `/tournaments`, `/leaderboard`, and tournament detail routes provide daily micro-challenges, scheduled events, proof checklists, round-due reminders, podiums and ways-to-climb prompts.
- `/feed`, `/friends`, `/profile`, `/profile/[username]`, `/groups`, and `/social-intelligence` provide privacy-first feed cards, PB/record/tournament highlights, friend comparison, group digest, public profile preview, reporting and suspicious-activity review.
- `/equipment`, `/billing`, `/providers`, `/partners`, `/settings`, and `/admin` cover active equipment setup, before/after equipment history, plans/entitlements, provider health, sponsor operations, privacy preview, collaborator access and admin moderation.

## Google Course Enrichment

Migration `0023_google_course_enrichment.sql` adds Google Places metadata to courses: address, coordinates, Google Place ID, website, Google Maps URL, rating, rating count, opening hours, attribution JSON and enrichment timestamp. The course setup flow can import a Google Place, merge likely duplicates, and pull OSM hole geometry when coordinates are available.

Configure Google Maps Platform keys in `.env` using the variables listed in `.env.example`. Course UI should always distinguish the data source:

- Google-enriched
- OSM geometry
- Manual course
- Rapsodo alias
- Merged provider course

Course cards and tables expose data health signals such as address, location, mapped holes, rating/slope and provider alias state so testers know what is trusted and what still needs setup.

## Social, Competition, and Sharing

The social layer is deliberately secondary to the data product. Feed cards, friend boards, groups, challenges, tournaments and public profiles should amplify verified practice and round data rather than replace the core Rapsodo/import/bag/coach loop.

Proof tiers are used consistently across records and tournaments:

- Gold: direct Rapsodo/import-backed proof
- Silver: provider or scorecard-supported proof
- Bronze: reviewable saved-round proof
- Manual: unverified/manual entry

Public sharing stays opt-in through profile and settings privacy controls.

## Visual Assets

Reusable app art lives in `public/assets` and is wired through `PageArtwork`, `ClubArtwork`, `CourseLogoArtwork` and mobile sports components. Current assets cover import/Rapsodo, shots, stock yardages, rounds, handicap, coach, progress, achievements, course records, feed, provider devices, tour covers, challenge cards, course fallback imagery and club artwork.

Keep media containers small and intentional. Prefer `h-16`, `h-24`, `h-32`, `aspect-[16/9]`, `aspect-[4/3]` or `aspect-square`, and do not render empty image boxes.

## Testing and Visual Audit

Core checks:

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `npm run format:check`

Playwright includes layout overflow, mobile density, accessibility, user isolation, social, challenges, course records/tournaments and visual spacing checks. The visual spacing audit checks horizontal overflow, blank mobile zones, empty media containers, mobile header height, sticky/bottom navigation overlap, repeated CTA stacks, tables above the mobile fold and empty rails.

## Public Tester Launch Checklist

Before inviting Facebook/Rapsodo testers:

- Run `npm run format:check`, `npm run lint`, `npm run test`, `npm run build`, and the authenticated Playwright pack.
- Verify Supabase Auth providers and RLS in the target project.
- Run Drizzle migrations through the latest course enrichment and feature foundation migrations.
- Configure Stripe prices/webhooks if billing is visible.
- Configure Google Maps/Places keys and quota alerts if course enrichment is enabled.
- Confirm the first-run flow: sign up, import or sync Rapsodo, map clubs, see stock yardages, see one insight, review practice next step, then optionally share or compete.

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
