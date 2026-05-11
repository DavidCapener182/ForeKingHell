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

## Setup

```bash
npm install
cp .env.example .env
```

Set `DATABASE_URL` to your Supabase Postgres connection string. `DEFAULT_USER_ID` can stay as the provided deterministic single-user UUID for local/private use only.

For any public deployment before real multi-user auth is added, set `FKH_BASIC_AUTH_PASSWORD` (and optionally `FKH_BASIC_AUTH_USER`) so the middleware requires HTTP Basic auth before serving app or API routes.

## Commands

```bash
npm run dev
npm run test
npm run lint
npm run build
npm run db:generate
npm run db:migrate
```

## Current Product Scope

- `/dashboard` summarizes the latest sessions, totals, trends, and next actions.
- `/import` previews Rapsodo MLM2PRO CSV files, defaults unknown distance units to yards, and saves raw CSV plus normalized shot rows. Simulated-course imports can include a scorecard so shot order is inferred into hole overlays.
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

This is still a single-user app until real authentication lands. Do not expose it publicly without a gate. The current hardening layer includes:

- Optional Basic auth middleware controlled by `FKH_BASIC_AUTH_PASSWORD`.
- User-scoped shot explorer queries and tighter user/session scoping on round mutations.
- Rate limits and request-size limits on OpenAI-backed coach and scorecard extraction routes.
- Scorecard image data URL size validation before OpenAI requests are sent.

Future public-ready work should replace the temporary gate with first-class authentication and ownership checks everywhere a user can read or mutate data.
