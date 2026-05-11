# ForeKingHell

Personal golf analytics web app for importing Rapsodo CSV data, preserving every non-empty CSV row, and normalizing shot metrics into a Postgres-backed data model.

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

Set `DATABASE_URL` to your Supabase Postgres connection string. `DEFAULT_USER_ID` can stay as the provided deterministic single-user UUID until auth is added.

## Commands

```bash
npm run dev
npm run test
npm run lint
npm run build
npm run db:generate
npm run db:migrate
```

## First Slice

- `/dashboard` shows the initial ForeKingHell dashboard shell.
- `/import` previews Rapsodo MLM2PRO CSV files, defaults unknown distance units to yards, and saves raw CSV plus normalized shot rows. Simulated-course imports can include a scorecard so shot order is inferred into hole overlays.
- `/shots` shows the saved shot database, session-level import counts, and raw CSV row preservation counts.
- Shot distances are stored in yards, apex is stored in feet, speeds are stored in mph, and angles are stored in degrees.
- Every non-empty CSV row is preserved in `fkh_import_rows`, while actual shot rows are also normalized into `fkh_shots`.
- The first schema includes shared-database-safe tables prefixed with `fkh_`: `fkh_users`, `fkh_clubs`, `fkh_sessions`, `fkh_import_rows`, `fkh_shots`, and `fkh_stock_yardages`.
- Simulated-course metadata is stored on sessions and shots: course name, scorecard JSON, inferred hole number, shot number within the hole, par, yardage, and remaining distance.
- Rapsodo export title dates are stored on `fkh_sessions.date` and copied to each `fkh_shots.shot_at` row for trend calculations.

Authentication, Shot Cloud, full round scoring, handicap, and real course map imagery are intentionally left for later slices.
