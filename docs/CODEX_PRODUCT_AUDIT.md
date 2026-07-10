# Codex Product Audit

Initial verified baseline for `main` at `7c8242141e3ad84c03f57ca3e40237d0848645ae` on 10 July 2026.

This is the pre-implementation audit required by the production pass. A finding is marked confirmed only where the current checkout, a command result, or a reproducible browser result supports it. Live Supabase and third-party integration behaviour remains explicitly unverified where local evidence is insufficient.

## Baseline result

| Check                                        | Result                  | Evidence                                                                                                                                                                                                              |
| -------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree                                     | Pass                    | Clean `main`, aligned with `origin/main` at `7c824214`                                                                                                                                                                |
| `npm install`                                | Completed with warnings | Node 22.11 is below several transitive packages' declared minimum 22.13; npm reported 32 advisories                                                                                                                   |
| `npm run format:check`                       | Failed                  | Seven files fail Prettier: Bag benchmark panel, Compare source test, Partners, Profile, two shell/artwork tests and desktop E2E                                                                                       |
| `npm run lint`                               | Pass                    | Exit 0                                                                                                                                                                                                                |
| `npx tsc --noEmit`                           | Pass                    | Exit 0                                                                                                                                                                                                                |
| `npm run test`                               | Pass                    | 192 files, 711 tests                                                                                                                                                                                                  |
| `npm run build`                              | Pass                    | Next.js 16.2.6 production build completed                                                                                                                                                                             |
| `npm run test:e2e`                           | Blocked before tests    | A running Next server already owned port 3000                                                                                                                                                                         |
| Authenticated E2E against the running server | Failed precondition     | Saved state redirected protected routes to `/login`; 2 public tests passed, 15 auth-derived failures were observed, 1 test was interrupted and 1,278 did not run                                                      |
| `npm run test:lighthouse`                    | Completed               | Public/redirect audit completed; `/login` scored 83 performance, 100 accessibility and 100 best practices, with 4.6s LCP. Protected-route reports resolved to `/login` and are not authenticated performance evidence |

## Application inventory

- 69 page routes.
- 33 routes below `src/app/api` plus authentication and QR route handlers.
- 24 server-action files.
- 39 route loading states, 18 error boundaries and 18 not-found boundaries.
- PWA manifest, Apple web-app metadata, service-worker registration, versioned cache cleanup and safe-area layout rules already exist.
- The mobile shell already renders five persistent tabs; the earlier seven-action toolbar finding does not match this checkout.

## Confirmed bugs and P0 risks

### Theme preference is not implemented

The current code does not merely ignore a selected theme. Migration `0032_remove_dark_mode.sql` rewrote every account to light and changed the default to light. `src/lib/user-settings.ts` only permits `light`, both preference readers return `light`, the settings UI has no theme control, the root layout hard-codes `data-theme="light"`, and the stylesheet declares `color-scheme: light` with no dark token set.

There is also a separate local-only `Sunlight mode` implementation in the desktop shell. It writes `data-sunlight` and `fkh:sunlight-mode`, creating a second appearance system outside the stored account preference.

Required fix: restore `light`, `dark` and `system` as one typed preference; apply the resolved theme before paint; react to system changes; update theme metadata; remove the competing sunlight implementation; add hydration and interaction coverage.

### Account export includes data belonging to other people

`src/app/api/settings/export/route.ts` starts with user-scoped rows, but then expands groups owned by the requester and exports all memberships, invites, posts, rivalry pairings and leaderboard snapshots for those groups. Those rows can contain other users' identifiers, roles, activity and derived competition data. Owning a group is not a safe default for including every member's private row in a personal account export.

The same payload selects full invitation and share-link records, including `tokenHash`, and exports broad raw metadata/cache objects by default. Token hashes and internal cache/render metadata are operational fields, not normal portable account data.

Required fix: make the default export strictly about the requesting user's authored/owned rows; exclude other members' rows and internal tokens; explicitly document export scope; set no-store headers; add isolation and redaction tests. Explicit group or coach exports should be separate permissioned operations.

### CSV formula injection is possible

The shared desktop table exporter quotes cell text but does not neutralise values beginning with `=`, `+`, `-` or `@`. A provider/imported label rendered in a table can therefore become a spreadsheet formula when the CSV is opened.

Required fix: centralise CSV cell encoding, prefix formula-like values safely, preserve stable headers and add tests for formula prefixes, quotes, newlines and ordinary negative numeric values.

### Offline messaging overstates cached access

The service worker deliberately caches only `/login`, `/offline` and `/privacy` and avoids caching private authenticated pages. The offline page states that clearly. `PwaRegister`, however, says “Previously loaded screens remain available” on protected routes, which is not true under the current cache policy. The replay loop also announces that sync “finished” even when one or more queued actions failed and were retained for retry.

Required fix: state that private screens require reconnection, distinguish queued edits/imports from cached viewing, report partial retry failure accurately and test the messaging.

### Preferred display units are not respected by the analysis UI

The account can store `yards` or `metres`, and the choice influences the import fallback. The root exposes `data-preferred-units`, but no display layer consumes it. Core pages continue to render yards, feet and mph directly. The setting therefore behaves as an import preference, not a display preference.

Required fix: define central stored-unit, calculation-unit and display-unit utilities; wire the preference into core analysis surfaces; keep calculations in canonical units; add metric/imperial, null, zero, sign and rounding tests.

### Longest-shot analysis performs an unbounded full-row read

`src/app/bag/longest/page.tsx` loads every shot for the user, groups in application memory and then chooses one row per club. This grows with the complete shot history even though Postgres can rank or aggregate one eligible row per club.

Its eligibility rules also differ from Bag personal bests: the Longest page accepts every row, while Bag excludes several quality/category values. Bag's SQL excludes `bad_data` but not the `bad-data` or `misread` variants handled elsewhere. The product can therefore show different “personal best” evidence for the same club.

Required fix: define one record-eligibility contract, use an indexed all-time ranked/aggregate query, return club/session/date/source provenance, and distinguish raw maximum from trusted maximum. Add a regression case where the record predates recent pagination windows.

## Suspected issues requiring live data or credentials

- Supabase RLS has migration and source-level tests, but owner, stranger, revoked collaborator, removed group member, anonymous, admin and partner personas still need live-project verification.
- The saved Playwright state is stale or invalid for `localhost:3000`. Protected-route accessibility, overflow, screenshots and full interaction coverage are not currently verified.
- Rapsodo Cloud, OpenAI, Google Maps/Places and Stripe behaviour depends on configured live credentials and real provider responses.
- Offline round edits replay the latest queued fields without a row version or conflict token. Ownership checks are reused from server actions, but lost-update/conflict behaviour requires a live multi-client test.
- The service worker update path has a visible prompt, but installed iOS update behaviour still needs device or standalone-browser validation.

## Privacy and security observations

- Positive: core owner reads commonly include `user_id`; round and equipment mutations visibly combine resource IDs with the authenticated owner ID; private HTML/API responses are not stored by the service worker.
- Positive: the Stripe webhook verifies its signature through the billing layer, AI routes use request-size/rate-limit helpers, and prior migrations restrict RLS helper execution while preserving policy-role grants.
- Confirmed concern: default account export scope and token redaction are unsafe, as described above.
- Dependency audit at baseline: npm reported 6 production-tree advisories. The high-severity `hono` path came from the `shadcn` CLI being installed as a production dependency, not an app runtime import. After moving that CLI, the final production audit still reports two moderate advisories in Next.js's embedded PostCSS path; npm's proposed forced remediation is a breaking Next 9.3.3 downgrade. Dev-only advisories include the older Vitest/Vite toolchain and Lighthouse WebSocket dependencies. Upgrades must be evaluated against official compatibility guidance rather than using `npm audit fix --force`.
- Live security confidence remains conditional on target-project RLS and provider configuration.

## Accessibility findings

- Public `/login` and `/privacy` passed the critical/serious axe smoke checks.
- Protected accessibility checks did not reach protected content. They scanned the redirect document and reported `meta-refresh` and an unnamed link; these results must not be attributed to `/dashboard`, `/today` or other target pages.
- The five-tab mobile bar uses `aria-current`, 44px-or-larger targets and bottom safe-area padding.
- Charts have an accessible fallback primitive, but route-level coverage is inconsistent and needs verification across the highest-value analysis pages.
- Focus, sheet dismissal, reduced motion and mobile landscape remain browser-verification items after authenticated state is refreshed.

## Mobile and information-architecture findings

- The persistent tab count is already five, with safe-area-aware top and bottom chrome.
- The current tabs are `Home`, `Play`, `Analyse` (which opens Bag), `Coach` and `Social`. This keeps Social primary, omits Profile, and provides no actual Analyse hub.
- Desktop navigation still uses `Home`, `Analyse`, `Play`, `Improve`, `Social`, `Platform` and `Admin`, rather than a smaller Review / Improve / Compete / Manage hierarchy.
- Import is already a prominent shell action and should remain contextual rather than becoming a sixth tab.
- The app has three page-header primitives (`PageHeader`, `MobileCompactPageHeader`, `MobileRouteHeader`) plus route-local headers, which contributes to inconsistent title density and scrolling behaviour.

## Performance findings

- The largest production files are well beyond maintainable page size: Today 5,570 lines, Bag 4,968, Dashboard 4,517, Practice Planner logic 3,972, Practice client 3,408, Progress 3,289 and desktop chrome 2,618.
- Several routes cap application-side samples at 500–600 rows, which is bounded but still serialises/iterates more data than many overview cards require.
- Longest-shot analysis is unbounded and should be replaced with SQL ranking.
- The settings export launches more than 50 queries and materialises the complete export in memory. Very large accounts need scoped sections and streaming/pagination rather than one unbounded JSON object.
- The current Lighthouse login run records 4.6s LCP and performance 83. Protected-route Lighthouse reports are redirect measurements and cannot be used as page baselines.
- Root shell data fetches profile, XP and admin state concurrently, which is a good existing pattern.

## Data-integrity findings

- Import storage is canonicalised to yards, feet, mph and degrees, and the parser already tests metre-to-yard and apex conversion.
- Date-only import normalisation and duplicate hashes have existing tests.
- Record eligibility is inconsistent between Bag, Longest and achievement/notification paths.
- The shot schema has `qualityTag` and `shotCategory`, but no explicit soft-delete, excluded-from-analysis, warm-up or verified/misread status. Some requested eligibility semantics therefore need a safe migration or a clearly documented mapping to existing fields.
- The preferred-unit setting is not a reliable display contract.
- Raw maximum, trusted maximum, stock distance and recent reliable distance exist conceptually, but provenance and eligibility are not consistently carried into every record surface.

## Loading, error and offline states

- Coverage exists for many routes, but it is uneven: 69 pages versus 39 loading, 18 error and 18 not-found files.
- Major routes such as Today, Bag and Dashboard have route states; secondary and admin routes rely more heavily on parent/global handling.
- Skeletons and empty states use several competing primitives (`LoadingCard`, route loaders, `GolfLoading`, `EmptyState`, premium panels), which should be consolidated without one all-purpose component.
- Offline private-page policy is conservative, but the global status message is inaccurate.

## Duplicated or inconsistent UI patterns

- Appearance is split between a removed account theme and the local `Sunlight mode` override.
- Page headers are implemented through multiple shared and route-local patterns.
- Metric, section, empty, loading and status panels exist in both `src/components/app` and `src/components/premium.tsx` families.
- Mobile primary navigation is structurally sound but its labels and destination hierarchy conflict with the documented post-session product loop.
- Hard-coded white/slate/emerald colours remain widespread, so dark mode cannot be restored reliably through root tokens alone.

## Test coverage gaps

- No light/dark/system persistence, first-paint or system-change coverage.
- No account-export tests for other group members, token redaction, no-store headers or large-export behaviour.
- No CSV formula-injection tests.
- No all-time PB regression proving a record older than a recent sample remains eligible.
- No single shared eligibility test across Bag, Longest and import PB notifications.
- No display-unit tests proving account preference changes rendered output.
- Authenticated E2E does not fail fast when the saved state redirects to login; the full matrix can produce hundreds of derivative failures.
- Authenticated Lighthouse and required screenshots remain unavailable until the auth state is refreshed.
- Live persona-based RLS coverage remains a production gate.

## Existing high-value foundations to preserve

- Five-item mobile shell and safe-area spacing.
- Full-width app layout contract.
- Performance Lab, top-down/trajectory visual foundations, Today confidence language and recommendation-first Bag hierarchy.
- Deterministic coaching/practice fallback and session-data-backed Practice Planner matching.
- User-scoped queries, ownership checks, RLS migrations and privacy-first service-worker cache rules.
- Route-level loading/error coverage where it already exists.

## Implementation priority from this audit

1. P0: export isolation/redaction, CSV formula safety, unified record eligibility/querying, theme restoration, honest offline messaging and unit-format foundation.
2. P1: five tabs mapped to Today / Sessions / Analyse / Bag / Profile; `/analyse` hub; desktop Review / Improve / Compete / Manage grouping.
3. P2: authenticated mobile verification and focused Today -> Latest Session -> Analyse -> Practice Plan hierarchy polish.
4. P3: extract oversized pages and progressively add the explainable analysis features not already present.

## Post-implementation status

This document intentionally preserves the Phase 1 baseline rather than rewriting history. The confirmed P0 findings above were repaired locally; the five-tab Apple mobile layer, Analyse hub, route regrouping, shared interface primitives, WCAG checks, query reductions and all twelve requested analysis foundations were then implemented and verified in Phases 2 through 10. Current evidence, exact command results, migrations, screenshots, performance data and remaining live-production gates are recorded in [CODEX_COMPLETION_REPORT.md](./CODEX_COMPLETION_REPORT.md).
