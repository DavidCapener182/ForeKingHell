# LM World Tour Production Readiness

LM World Tour is ready for first public testers only when the product loop and the safety checks both pass:

Sign up -> import or sync Rapsodo -> map clubs -> review stock yardages -> understand improvement -> follow one coach next action -> optionally share or compete.

## Production Gate

The repository workflow and its enforcement are separate controls. Keep the `main` ruleset aligned
with [GITHUB_BRANCH_PROTECTION.md](./GITHUB_BRANCH_PROTECTION.md), including the merge-queue checks;
otherwise a green workflow remains advisory rather than compulsory.

Run the full gate:

```bash
npm run production:check
```

The gate runs:

- `npm run format:check`
- `npm run lint`
- `npx next typegen`
- `npx tsc --noEmit`
- `npm run test`
- `npx drizzle-kit check`
- `npm audit --audit-level=high`
- `npm run build`
- `npm run check:route-budgets`
- `npm run test:lighthouse`
- `npm run test:e2e`
- `git diff --check`

Authenticated E2E coverage requires a real Supabase session storage state:

```bash
npm run test:e2e:capture-auth
PLAYWRIGHT_AUTH_STATE=/absolute/path/to/state.json npm run production:check
```

By default the capture command opens `/login`, waits for a manual tester sign-in, verifies `/dashboard`, and writes `.playwright/auth/forekinghell-state.json`. Use `PLAYWRIGHT_BASE_URL=https://your-preview-url npm run test:e2e:capture-auth` to capture against a deployed preview instead of local dev.

If `PLAYWRIGHT_AUTH_STATE` is missing, the script prints:

```text
Authenticated E2E not fully verified because PLAYWRIGHT_AUTH_STATE is missing.
```

The gate fails in that state so nobody can claim a fully verified public launch from skipped authenticated flows.

When an auth state is present and the gate starts its local Playwright server, it enables a local Playwright auth guard that reads the captured Supabase auth cookie and avoids repeatedly calling Supabase Auth during the rapid route sweep. The guard is disabled in production and the normal runtime path still uses Supabase server auth validation.

The production gate stops after the first Playwright failure so a known defect does not consume the rest of a multi-project release run. A passing run still completes every configured browser and viewport project.
For local authenticated competition flows, the runner supplies a deterministic test-only
`SCORECARD_PROOF_SECRET` when the real variable is absent. Production startup still requires the
real secret and never receives this fallback.

## Launch Checklist

- Supabase Auth providers configured for the target domain.
- Drizzle migrations applied through the latest migration.
- RLS policies verified with anon, signed-in owner, friend, stranger, group member, blocked user, coach, viewer, editor, admin and partner personas.
- Stripe price IDs and `STRIPE_WEBHOOK_SECRET` configured if billing is visible.
- Stripe webhook endpoint points at `/api/stripe/webhook` and rejects invalid signatures.
- Rapsodo CSV import works from `/import`; R-Cloud token settings are configured before using cloud sync.
- Google Maps/Places keys and quota alerts configured before enabling course enrichment.
- OpenAI coach and scorecard routes keep authentication, rate limits and request-size limits.
- Export and delete flows verified in `/settings`.
- Mobile first viewport checked for identity, status, one action and active content.
- Public landing checked at 390px, 768px, 1024px and 1440px for overflow, duplicate paired interfaces, blocked sticky controls and broken media.
- Data Chat has one complete interface per viewport; mobile and desktop trees must switch at `lg`.
- Landing content remains readable with JavaScript disabled and with reduced motion enabled; Course Twin must retain its static fallback.
- Verify the Join beta path reaches `/welcome`, activation progress is real-account derived, and established users continue to Today without a forced wizard.
- Verify `Command+K`, `Control+K`, `/`, keyboard selection and the mobile command sheet without exposing role-restricted routes.
- No empty media boxes, no raw debug metadata above the fold, no full mobile tables above the fold.

## Asset Usage Table

| Asset                              | Page/component             | Purpose                            |
| ---------------------------------- | -------------------------- | ---------------------------------- |
| `page-import-rapsodo.webp`         | Import/Rapsodo empty state | Rapsodo-first onboarding media     |
| `page-shots-shot-trace.svg`        | Dashboard/Shots motif      | Compact shot-trace visual cue      |
| `page-handicap-scorecard.webp`     | Handicap                   | Scorecard context/empty state      |
| `page-course-records-honours.webp` | Course Records             | Honours and champion board imagery |
| `page-coach-drill-board.webp`      | Coach                      | Drill-board prescription visual    |
| `course-placeholder-map.webp`      | Courses/Rounds             | Course map fallback                |
| `hole-350-aerial.jpg`              | Courses/Rounds             | Hole/aerial fallback               |
| `tour-covers/*`                    | Tournaments                | Event cover imagery                |
| `challenge-*.webp`                 | Challenges                 | Challenge cards                    |
| `feed-empty-state.webp`            | Feed                       | Empty activity state               |
| `feed-pb-card-bg.webp`             | Feed share/PB cards        | PB card background                 |
| `provider-rapsodo-device.webp`     | Providers                  | Rapsodo live provider tile         |
| `provider-square-device.webp`      | Providers                  | Square beta provider tile          |
| `provider-trackman-radar.webp`     | Providers                  | TrackMan coming-soon provider tile |
| `clubs/panel/*`                    | Bag/Club detail            | Compact club imagery               |
| `clubs/generated-v2/*`             | Bag/Equipment/Club detail  | Generated club fallback imagery    |

Rules: use `next/image` for raster assets, keep fixed aspect ratios, provide useful alt text for informative images, and use empty alt text for decorative images.

## Product Acceptance

- Dashboard leads with today's signal, one next action, compact metrics, Data Health and latest meaningful change.
- Dashboard shows the first-run Rapsodo path only when there is no usable shot data.
- Import/Rapsodo leads with Source -> Upload/Sync -> Review -> Match -> Submit/Share.
- Import Quality Score covers mapped clubs, rows saved, duplicates, missing metrics, distance unit confidence, course detection, scorecard match and eligible events.
- Data Health Score covers last import, club sample sizes, missing club mapping, course/rating gaps, low-confidence stock yardages, rounds needing verification and provider sync.
- Settings exposes Privacy Preview, Visibility Simulator and Data export/delete status before destructive account controls.
- Social remains secondary on data pages. Feed, friends, groups, challenges, tournaments and leaderboards support verified golf data rather than replacing the data product.

## Current Verification Notes

Use [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) for unresolved launch limitations. Do not post broadly to Facebook/Rapsodo groups until the production gate passes with authenticated Playwright state against the intended deployment.
