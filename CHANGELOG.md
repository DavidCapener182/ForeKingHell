# Changelog

All notable changes to LM World Tour are recorded here. The project follows semantic versioning for
public beta releases.

## 0.2.0 - 2026-07-21

### Added

- Live rollback-only RLS persona verification for owner, collaborator, social, moderation,
  administrator and anonymous boundaries.
- Account export/deletion governance, offline operation idempotency, retry/dead-letter controls and
  optimistic conflict handling.
- Public, authenticated and admin route groups, a typed route registry, route JavaScript budgets and
  scrubbed OpenTelemetry operations, with server/client dependency guards around the database layer.
- Evidence provenance, session comparison, weekly change review, Data Quality Inbox, measured goals,
  Quick Range, course strategy, coach-report sharing and notification delivery preferences.
- Outdoor, High Contrast, Range Night and Tour Broadcast display modes.
- GitHub CI, nightly browser/dependency/bundle gates, CodeQL, dependency review, secret scanning,
  release SBOM generation, Dependabot and code-owner rules.

### Changed

- Simplified desktop navigation to six product areas and mobile navigation to five destinations.
- Reworked first import into source, preview, club mapping and first-insight stages.
- Split public pages from the authenticated workbench and decomposed notification/workspace controls.
- Upgraded the runtime to Node 24, Next.js 16.2.11, React 19.2.8, current Supabase clients,
  Recharts 3.10, Playwright 1.61 and Vitest 4.1.

### Security

- Added central stale-session recovery, exact public route allow-lists, CSP report-only policy with a
  bounded privacy-reducing violation collector, and disabled the framework signature header.
- Enforced byte, row, shot and field limits for imports; restricted scorecard images to validated
  JPEG, PNG or WebP payloads with metadata-stripping normalization and a pixel ceiling; retained
  spreadsheet-formula-safe exports.
- Added permanent auth-identity deletion, share revocation, recent reauthentication and live database
  policy evidence.

Deployment-dependent constraints and current transitive advisories are documented in
[`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md).
