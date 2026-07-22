# Course Twin operations

Course Twin is split into the authenticated Next.js control plane, a durable Postgres queue, a separately deployed builder worker, private immutable package storage, the browser runtime, and the loopback-only launch-monitor bridge.

## First-wave catalogue

Generate up to 50 ranked UK candidates without writing application data:

```sh
npm run builder:catalog -- --limit 30 --output /tmp/course-twin-candidates.json
```

An administrator imports a reviewed candidate document through `POST /api/course-twins/catalog/import`. Import returns immediately after writing durable `fkh_course_twin_catalog_jobs` rows. Vercel invokes `/api/cron/course-twin-catalog` every five minutes; each invocation atomically claims one job, imports real mapped holes and course-scoped OSM surfaces, queues a build, and retries transient failures with exponential backoff. Do not count a course as first-wave ready until the job is `completed` with at least nine mapped holes. Replace persistent `no_geometry_found` candidates rather than presenting them as playable.

The Aintree first-wave entry deliberately reuses the existing `Aintree Golf Centre` course and nine-hole scorecard so saved rounds remain connected to the generated twin.

## Builder deployment and package delivery

The `Course Twin Builder Image` GitHub workflow tests and publishes `ghcr.io/<owner>/forekinghell-course-twin-builder:<git-sha>`. Deploy the immutable SHA image behind authenticated HTTPS with:

- `COURSE_TWIN_WORKER_SECRET`: same random value of at least 32 characters in worker and app.
- `COURSE_TWIN_CALLBACK_ORIGINS`: exact public app origin.
- `COURSE_TWIN_BUILDER_ALLOW_REMOTE=1` and `COURSE_TWIN_BUILDER_HOST=0.0.0.0` only inside the container network.
- `OPENTOPOGRAPHY_API_KEY` for Copernicus fallback jobs.

Set `COURSE_TWIN_BUILDER_URL`, `COURSE_TWIN_CALLBACK_BASE_URL`, `COURSE_TWIN_WORKER_SECRET`, `CRON_SECRET`, Supabase service-role credentials, and `COURSE_TWIN_STORAGE_BUCKET=course-twins` in the app. `/health` is the worker readiness endpoint. Completion callbacks are timestamped and HMAC-signed. Validated packages are uploaded with immutable one-year cache metadata to the private Supabase bucket; the app converts internal `storage://` references to short-lived signed CDN URLs.

## Grade A green surveys

Grade A is unavailable until every expected hole has a reviewed grid at 0.25 m spacing and 10 mm vertical accuracy or better. Import survey JSON through the admin-only `POST /api/course-twins/:courseId/putting-surveys` route. Grid rows run north to south, columns west to east, use EPSG:4326 bounds, and contain absolute elevations in metres. Review with `PATCH` on the same route. A verified review queues a fresh immutable build; the worker converts elevations to local course coordinates and the browser uses the surveyed grid for putting collision and visible green geometry.

Raw grids remain forced-RLS, service-role-only data. Published manifests include only the validated grid and source attribution. Bootle and all other unsurveyed courses remain honestly Grade B or lower.

## Physical MLM2PRO acceptance

Run the bridge, pair Course Twin Live mode, select handedness and a club, and then run:

```sh
npm run bridge:acceptance -- --device "Rapsodo MLM2PRO" --shots 5 --duration 300
```

Hit at least five real shots. Acceptance passes only with the expected device, official loopback port, paired browser, fresh club data, handedness/club feedback and zero rejected messages. Archive the redacted report with the release record. The report contains no launch metrics, raw JSON, pairing code or session token.

## Signed desktop releases

The protected `Course Twin Bridge Release` workflow builds macOS, Windows and Linux packages with Node 24.15.0, runs bridge tests and executable self-tests, hashes every artifact, and signs the release manifest with Ed25519. Configure these protected environment secrets:

- `FKH_RELEASE_MANIFEST_PRIVATE_KEY`
- `FKH_MACOS_CERTIFICATE_BASE64`, `FKH_MACOS_CERTIFICATE_PASSWORD`, `FKH_MACOS_SIGN_IDENTITY`
- `FKH_APPLE_ID`, `FKH_APPLE_TEAM_ID`, `FKH_APPLE_APP_PASSWORD`
- `FKH_WINDOWS_CERTIFICATE_BASE64`, `FKH_WINDOWS_CERTIFICATE_PASSWORD`

Public channels fail closed without the required platform credentials. Stable macOS builds are submitted to Apple notary service; Windows executables receive Authenticode plus a trusted timestamp. A GitHub release attaches the signed artifacts only after all per-platform build steps succeed.

## Operational truth

Software readiness is not physical or geographic acceptance. A course is production-ready only after package generation, source attribution, visual hole-by-hole review and quality-grade approval. A bridge release is hardware-ready only after a passing real-device report. Signing credentials, external worker hosting and physical MLM2PRO access are deployment inputs and are intentionally not stored in this repository.
