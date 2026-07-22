# Observability and performance budgets

ForeKingHell uses Next.js request instrumentation plus provider-neutral OpenTelemetry. On Vercel,
connect the project trace drain to the chosen observability backend; self-hosted deployments must
configure an OpenTelemetry collector or exporter.

## Privacy boundary

Telemetry may contain route templates, operation names, durations, result categories and aggregate
row counts. It must not contain email addresses, auth tokens, raw CSV rows, raw shots, uploaded
proof, free-text notes or social content. `onRequestError` records a digest and route metadata but
not the error message. Expected server failures record only a normalized error type and allow-listed
`app.*`, `db.*`, `provider.*` or `job.*` attributes; they never serialize the error object or message.
Custom server operations record only those same attribute namespaces. Import telemetry is separately
restricted to aggregate counts, timings, source/version labels and replay/duplicate booleans; raw
filenames, CSV cells and shot values are excluded.

Set `SERVER_TIMING_LOGS=1` in a diagnostic environment to emit every custom server-operation timing.
Production emits the same structured log only for operations lasting at least 500 ms; OpenTelemetry
spans are still created for all operations.

The report-only CSP posts to the exact public `/api/security/csp-report` endpoint. The collector is
rate- and body-limited and reduces each violation to its directive, report/enforce disposition and a
same-origin/cross-origin/inline/data/blob category. It never logs document, source or blocked URLs.

## Alert policy

Configure alerts against structured events and traces for:

- repeated `server_request_error` events on auth, Stripe, cron, provider and import routes;
- new or sharply increasing `csp_violation` directive/category combinations before CSP enforcement;
- `server_operation` P95 duration regressions or database row-count spikes;
- invalid-refresh recovery rate, provider failures and offline dead-letter growth;
- Stripe webhook backlog, cron failures, database saturation and AI latency/cost anomalies;
- any failed live tenant persona check in CI or release verification.

## JavaScript budgets

`config/route-js-budgets.json` defines uncompressed first-load JavaScript ceilings for the public
entry and core post-session loop. `npm run check:route-budgets` reads Next's production build
diagnostics and fails CI when a route is missing or exceeds its ceiling. Change a budget only with a
measured build and a short explanation in the release notes.

Lighthouse audits `/` and `/login` without credentials. Private routes are added only when
`LIGHTHOUSE_COOKIE` or `LIGHTHOUSE_EXTRA_HEADERS_JSON` supplies an authenticated test session; this
prevents a redirected login page from being misreported as every private route.
