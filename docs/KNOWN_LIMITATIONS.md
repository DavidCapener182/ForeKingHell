# Known Limitations

These are launch constraints, not hidden failures.

- Authenticated Playwright coverage requires `PLAYWRIGHT_AUTH_STATE`; without it the public/login tests run but the app is not fully production-verified. Use `npm run test:e2e:capture-auth` to capture `.playwright/auth/forekinghell-state.json` before running the production gate.
- Local authenticated E2E uses a local Playwright auth guard to avoid Supabase Auth request-rate limits during dense route sweeps. The guard is disabled in production; deployed preview verification still depends on the target deployment's real Supabase Auth and RLS behavior.
- Rapsodo CSV import is live. Rapsodo cloud sync depends on `RAPSODO_TOKEN_SECRET` and `RAPSODO_API_BASE_URL` being configured and tested against real accounts.
- Square and TrackMan are beta/coming-soon provider tiles unless their adapters are enabled for the tester cohort.
- Google course enrichment depends on Maps/Places keys, quotas and provider response quality.
- Lighthouse audits `/` and `/login` by default. Authenticated Lighthouse routes require cookies or extra headers.
- OpenAI coach and scorecard routes require `OPENAI_API_KEY`; rules-based fallbacks should remain understandable when the key is absent.
- Stripe billing should not be shown to testers unless price IDs and webhook verification are configured in the target environment.
- Course rating/slope and scorecard proof can still be incomplete for manual or imported rounds; Data Health should call this out.
- `npm audit --audit-level=high` currently reports 38 transitive advisories (11 high and 27
  moderate) in Next/PostCSS, Lighthouse/Sentry/OpenTelemetry, Drizzle tooling and the shadcn CLI.
  npm's proposed remediations require breaking downgrades or major-version changes, so they are
  tracked for upstream-compatible releases rather than force-applied to the beta branch.
- The live rollback-only RLS matrix verifies owner, coach, viewer, editor, friend, stranger, blocked,
  group-moderator, administrator and anonymous boundaries. It does not replace deployed-preview
  browser verification or explicit user scoping for privileged application-server queries.
- Shot review immediately removes excluded rows from live analytical evidence and rebuilds the
  affected current stock-yardage context. Historical achievements, XP entries, social feed claims,
  accepted practice results and course-record attempts are not silently rewritten: older rows do
  not consistently retain an unambiguous source-shot ID. Safe retroactive reconciliation requires
  an active/revoked state, deterministic evidence links, compensating XP entries and idempotent
  reactivation keys. Until that provenance contract is migrated, these records remain
  point-in-time history rather than claims about current trusted evidence.
- Imported training load deliberately counts committed physical swings, including shots later
  excluded from analysis. Review status changes evidence quality, not the work the golfer already
  performed.
