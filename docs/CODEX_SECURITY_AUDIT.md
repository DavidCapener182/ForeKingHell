# Codex security audit

Repository revision reviewed: `7c8242141e3ad84c03f57ca3e40237d0848645ae` plus the production-pass changes on 10 July 2026.

## Confirmed findings repaired

1. The personal JSON export expanded owned groups into other users' memberships, invitations, posts and derived competition rows. It also exposed reporter/internal moderation data and blocker identities through symmetric relationship queries. The endpoint now queries and projects a strict requester-owned personal scope and redacts operational identifiers.
2. The shared browser CSV serializer allowed spreadsheet-formula prefixes from imported or user-authored table cells. CSV encoding is now centralised and neutralises formula-like text while preserving ordinary negative numeric values.
3. Authentication callback/login redirects accepted unsafe destination forms. Redirect selection now accepts only canonical same-origin paths.
4. Invitation claiming was non-atomic. Acceptance now prevents concurrent double-claim behaviour.
5. Account deletion removed moderation evidence needed for safety operations. The destructive path now preserves the operator evidence contract.
6. The Stripe proxy exemption was broader than the exact webhook route, completed-but-unpaid checkouts could update state, and stale client metadata could override configured price mapping. Exact route gating and authoritative price/payment checks are now tested.
7. Offline replay queues were not bound strongly enough to the current browser account. Queues now carry an owner, purge on mismatch/sign-out and are revalidated at the API boundary.
8. Several AI and Google proxy routes lacked consistent request-size, quota or destination hardening. Central request protection, scoped Data Chat context, prompt sanitation, fixed limits and private-address rejection were added.
9. Course discovery/import mutation paths could update or delete catalog rows without an adequate tenant predicate. Shared/unowned catalogue discovery remains available, while mutation is restricted to the owning user.
10. RLS policy/grant drift and ownership gaps identified statically are repaired by migration `0039_security_boundary_repairs.sql`.
11. Server-maintained identity links, usage ledgers, AI cache/credit rows, achievements, XP, competition results and practice evidence had client-reachable integrity paths. Migration `0040_security_integrity_lockdown.sql` removes those grants, validates identity-link email equality, adds non-negative credit constraints and locks scope/provenance fields against reassignment.
12. User-authored analysis annotations and snapshots use owner-only policies, immutable owner triggers and anonymous grant revocation in migration `0041_analysis_workspace.sql`.

## Defence-in-depth verification added

- personal-export isolation, redaction and no-store response tests;
- CSV formula-prefix tests;
- safe redirect tests;
- Stripe webhook mapping/payment tests;
- local offline account-isolation tests;
- API request-protection and remote-resource tests;
- course import tenant-safety tests;
- RLS source/policy regression tests;
- anonymous/public E2E and authenticated user-isolation coverage where local test identities permit.

## Remaining production security gates

- Migrations `0038` through `0041` were applied to live Supabase project `wngqphzpxhderwfjjzla` on 10 July 2026 and verified through migration history, object, trigger, policy, grant and RLS readback. The previous critical `fkh_user_identity_links` RLS-disabled advisor finding is cleared. Owner, coach/viewer/editor, stranger, revoked collaborator, removed group member and anonymous personas still require real-account RLS verification.
- The post-migration security advisor has no `ERROR` finding. It reports 12 informational `RLS enabled, no policy` notices for deliberately server-only tables whose client privileges were revoked; eight warnings for the four `SECURITY DEFINER` relationship helpers exposed to `anon`/`authenticated` but constrained to the caller's own `auth.uid()`; and platform warnings for disabled leaked-password protection and an available Postgres security update.
- The application-level database role can bypass Supabase RLS depending on deployment configuration; live role grants and policies must be inspected together.
- Personal export is scoped and redacted but still assembled in memory, so very large accounts need streaming/chunking and rate/cost validation.
- Offline writes still need durable idempotency keys, server row versions and explicit multi-client conflict resolution.
- Stripe needs a durable processed-event ledger before webhook replay/order handling is considered complete.
- AI credit decrement remains a concurrency-sensitive operation and should become one atomic database transaction.
- Google proxy rate limiting is process-local, and DNS validation still needs a transport-level rebinding-safe design for hostile deployment configurations.
- Dependency audit still reports two moderate production-tree advisories in Next.js's embedded PostCSS path and 23 moderate advisories across the full development tree. No high or critical advisory was reported. CLI-only `shadcn` has been moved to development dependencies.

## Coverage statement

The audit prioritised authentication, tenant boundaries, exports, offline replay, AI/provider cost controls, billing, Google/remote fetches and RLS migrations. Confirmed candidates received static data-flow validation and attack-path review. The repository-wide security worklist contains 571 files; seven high-risk files received full-file receipts in the formal scan ledger and the remaining frontier is explicitly deferred rather than falsely labelled exhaustively reviewed. Live infrastructure assertions remain unverified unless stated above.
