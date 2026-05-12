# ForeKingHell

Personal golf analytics web app for importing Rapsodo CSV data, preserving every non-empty CSV row, and turning launch-monitor shots, rounds, bag gapping, progress, achievements, and coaching signals into a Postgres-backed golf improvement plan.

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

Authenticated Playwright coverage is opt-in because Supabase sessions are cookie backed. Capture a logged-in storage state and run with `PLAYWRIGHT_AUTH_STATE=/absolute/path/to/state.json npm run test:e2e` to exercise the import wizard, mobile shot explorer, round scorecard, PWA offline queue, and coach chat checks. Without that env var, the public auth and login accessibility checks still run.

`npm run test:lighthouse` audits `/login` by default against `next start`. Set `LIGHTHOUSE_ROUTES=/login,/dashboard` and `LIGHTHOUSE_COOKIE` or `LIGHTHOUSE_EXTRA_HEADERS_JSON` when auditing authenticated routes.

## Current Product Scope

- `/dashboard` summarizes the latest sessions, totals, trends, and next actions.
- `/import` previews Rapsodo MLM2PRO CSV files, supports manual column mapping when export headers change, defaults unknown distance units to yards, and saves raw CSV plus normalized shot rows. Simulated-course imports can include a scorecard so shot order is inferred into hole overlays.
- `/shots` is a paginated shot explorer with filters for club, session, shot category, date range, and file/course search. Advanced metrics remain available in expandable row details.
- `/bag` and `/bag/[clubId]` analyze club gapping, stock yardages, dispersion, longest shots, and per-club analytics.
- `/rounds`, `/rounds/new`, and `/rounds/[sessionId]` support manual rounds, linked course scorecards, shot-to-hole assignment, and hole scoring.
- `/handicap`, `/courses`, `/progress`, `/coach`, and `/achievements` add playing trends, course data, practice priorities, AI-assisted coaching, XP, and achievement tracking.

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
