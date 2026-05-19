# Known Limitations

These are launch constraints, not hidden failures.

- Authenticated Playwright coverage requires `PLAYWRIGHT_AUTH_STATE`; without it the public/login tests run but the app is not fully production-verified. Use `npm run test:e2e:capture-auth` to capture `.playwright/auth/forekinghell-state.json` before running the production gate.
- Local authenticated E2E uses a local Playwright auth guard to avoid Supabase Auth request-rate limits during dense route sweeps. The guard is disabled in production; deployed preview verification still depends on the target deployment's real Supabase Auth and RLS behavior.
- Rapsodo CSV import is live. Rapsodo cloud sync depends on `RAPSODO_TOKEN_SECRET` and `RAPSODO_API_BASE_URL` being configured and tested against real accounts.
- Square and TrackMan are beta/coming-soon provider tiles unless their adapters are enabled for the tester cohort.
- Google course enrichment depends on Maps/Places keys, quotas and provider response quality.
- Lighthouse audits `/login` by default. Authenticated Lighthouse routes require cookies or extra headers.
- OpenAI coach and scorecard routes require `OPENAI_API_KEY`; rules-based fallbacks should remain understandable when the key is absent.
- Stripe billing should not be shown to testers unless price IDs and webhook verification are configured in the target environment.
- Course rating/slope and scorecard proof can still be incomplete for manual or imported rounds; Data Health should call this out.
- Public launch still depends on verifying Supabase RLS in the live project, not only in local tests.
