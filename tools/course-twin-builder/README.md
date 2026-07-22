# ForeKingHell Course Twin Builder

This separately deployable worker receives an exact-body HMAC-authenticated build plan, downloads the selected terrain source, converts mapped holes and polygons into local ENU coordinates, packages a float32 heightfield plus aerial reference image, and posts a signed completion to the application.

## Run locally

```bash
COURSE_TWIN_WORKER_SECRET='at-least-32-random-characters-here' \
COURSE_TWIN_CALLBACK_ORIGINS='http://localhost:3200' \
npm run builder:start
```

The worker binds to `127.0.0.1:8787` by default. A remote/container binding requires `COURSE_TWIN_BUILDER_ALLOW_REMOTE=1` and should sit behind authenticated TLS ingress.

The `Course Twin Builder Image` workflow runs the complete worker test suite, builds the pinned container, and publishes immutable-SHA plus `latest` images to GitHub Container Registry from `main`. Deploy that image behind authenticated TLS, set `COURSE_TWIN_BUILDER_URL` and the matching 32+ character `COURSE_TWIN_WORKER_SECRET` in the application, and configure `COURSE_TWIN_CALLBACK_ORIGINS` to the exact application origin. `/health` is the container readiness endpoint. Vercel cron routes drain both durable catalogue and build queues; Supabase Storage is the immutable package store and its signed asset URLs are the CDN boundary.

England uses the Environment Agency 1 m LiDAR WCS. Wales reads the official Welsh Government 1 m DTM Cloud Optimized GeoTIFF by bounded range requests and reprojects WGS84 course geometry into British National Grid. Scotland and Northern Ireland currently use the honest Copernicus GLO-30 fallback until their tile catalogues can be resolved automatically. Copernicus access through OpenTopography requires `OPENTOPOGRAPHY_API_KEY`.

The executable global adapters are:

- United States: USGS National Map 3DEP bare-earth ImageServer export.
- New Zealand: LINZ's public `nz-elevation` static STAC catalogue and 1 m COG archive.
- Canada: NRCan's `hrdem-lidar` STAC API and DTM COG assets.
- Everywhere else: Copernicus GLO-30 through OpenTopography, clearly downgraded to strategy/replay quality when the generated mesh exceeds 5 m.

Before terrain generation the worker refreshes missing golf polygons from a bounded OpenStreetMap Overpass query. The container also installs the official Overture Maps Python client and, with `COURSE_TWIN_OVERTURE_ENABLED=1`, retrieves bounded water and wooded land-cover polygons from the latest Overture release. Existing saved polygons remain authoritative, so a refresh fills missing semantic classes instead of duplicating a checked course.

## Container

Build from the repository root so the worker gets the lockfile and its production-only dependencies:

```bash
docker build -f tools/course-twin-builder/Dockerfile -t forekinghell-course-twin-builder .
docker run --rm -p 127.0.0.1:8787:8787 \
  -e COURSE_TWIN_WORKER_SECRET='at-least-32-random-characters-here' \
  -e COURSE_TWIN_CALLBACK_ORIGINS='https://app.example.com' \
  -e COURSE_TWIN_BUILDER_ALLOW_REMOTE=1 \
  forekinghell-course-twin-builder
```

The worker stores no long-lived credentials. The USGS, LINZ, NRCan, OSM and Overture adapters use their public endpoints; only the Copernicus fallback requires `OPENTOPOGRAPHY_API_KEY`.

## First production wave

Generate the auditable first UK production wave with `npm run builder:catalog -- --limit 20`.
The catalogue uses named OpenStreetMap golf-course objects and ranks only courses with at least nine
uniquely numbered mapped hole ways. Nearby mapped greens, fairways, tees, bunkers and water hazards
contribute to readiness without being presented as manual verification. The generated JSON retains the
OSM object identifier, geographic origin, mapping counts, source region and ODbL licence so an admin can
review the exact 20-50 candidates before queueing immutable builds.
