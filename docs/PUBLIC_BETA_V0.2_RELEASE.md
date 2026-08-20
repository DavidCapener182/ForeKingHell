# v0.2.0 Public Beta Hardening

This release consolidates the existing golf product rather than adding another top-level product
surface. The core loop is now: import trustworthy evidence, understand what changed, take one
practice action, review the result and optionally share a selected report.

## Security and reliability

- Invalid Supabase refresh sessions are recovered centrally, all related cookies are cleared, page
  requests redirect once with a local return target, and API requests receive a structured 401.
- The proxy uses exact public route and API allow-lists rather than a generic file-extension rule.
- The live rollback-only RLS matrix covers owner, coach, viewer, editor, friend, stranger, blocked
  user, group moderator, administrator and anonymous personas. Coach Workspace coverage additionally
  proves player-visible versus coach-only notes, coach create/update rights and immediate membership
  revocation.
- The governance manifest drives export and deletion coverage; permanent account deletion removes
  the auth identity after recent reauthentication, while golf-data reset remains separate.
- Offline imports and round edits use an account-bound operation ledger, stored results for duplicate
  replay, retry/dead-letter state and optimistic conflict handling.
- Scorecard images are magic-byte validated and safely decoded/re-encoded to remove embedded metadata
  before external AI processing; malformed and excessive-pixel inputs are rejected.
- CI runs Node 24 formatting, lint, TypeScript, unit tests, migration checks, a production build,
  JavaScript budgets and a public auth smoke. Security workflows add dependency review, CodeQL,
  secret scanning and versioned-release SBOM generation. `CODEOWNERS` assigns the repository and
  its security-sensitive boundaries to the maintainer; GitHub must enforce code-owner review in the
  protected-branch settings.

## Product consolidation

- Public, authenticated and admin layouts are split without changing public URLs.
- The PostgreSQL connection is explicitly server-only, and dependency-boundary tests prevent direct
  database imports in UI/client components and React imports in pure domain modules.
- Desktop navigation uses Home, Practice, Sessions, Rounds, Strategy/Course Twin, Bag, Insights, Data and Settings, with Admin role-gated separately. Mobile uses Today, Practice, Strategy, Review and Bag; account and settings live behind the profile affordance.
- A typed product-route registry supplies command search metadata and admin visibility.
- Import follows Source, Preview, Club mapping and First insight; sample data is explicitly preview
  only until a user chooses to save real evidence.
- Analyse adds evidence provenance and session comparison. Progress adds a deterministic six-part
  weekly change review. The Data Quality Inbox includes stale yardages, provider failures and offline
  actions needing review.
- Coach reports are immutable, selectively scoped, expiring and revocable; public report access reads
  the saved snapshot only.

## Design and accessibility

- Semantic evidence, answer, action, warning and chart primitives reduce route-level visual drift.
- Outdoor, Range Night, Tour Broadcast and High Contrast modes share the same preference/bootstrap
  path. Reduced-motion behaviour remains automatic.
- The public entry no longer loads the private workbench shell. Route-level JavaScript budgets fail CI
  on regression, and Lighthouse does not mislabel redirected private routes as public results.

## Operations and observability

- Next request failures and selected server operations emit scrubbed OpenTelemetry spans. Structured
  failure logs include only normalized error types and allow-listed operational attributes; import
  telemetry is limited to aggregate counts, timings and non-identifying source/version flags.
- The report-only CSP posts to an exact, rate- and body-limited collector that records directive and
  resource categories without storing document, source, or blocked URLs.
- The chosen deployment must connect the Vercel trace drain or an OpenTelemetry collector and create
  alerts described in `OBSERVABILITY_AND_BUDGETS.md`.
- Required status checks, protected-main settings and review rules must be enabled in the GitHub
  repository settings; workflow files cannot enforce those host-level controls by themselves.

## Release evidence

Before tagging or promoting a deployment, record:

- `npm run format:check`, lint, TypeScript and the full Vitest totals;
- a production build and `npm run check:route-budgets` output;
- `npx drizzle-kit check` and the migrated-from-zero CI result;
- `npm run security:rls-live` with `"transaction":"rolled-back"`;
- authenticated Chromium/WebKit/Firefox and mobile smoke evidence against the intended preview;
- public and authenticated Lighthouse results;
- `npm audit --audit-level=high` and the security workflow results.

The release audit passes at the high/critical threshold. Moderate transitive advisories and their
upstream constraints are recorded in `KNOWN_LIMITATIONS.md`; do not use `npm audit fix --force` to
replace production packages with unrelated breaking downgrades.

Known deployment-dependent constraints remain in `KNOWN_LIMITATIONS.md`.
