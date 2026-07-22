# ForeKingHell Course Twin Builder

This separately deployable worker receives an exact-body HMAC-authenticated build plan, downloads the selected terrain source, converts mapped holes and polygons into local ENU coordinates, packages a float32 heightfield plus aerial reference image, and posts a signed completion to the application.

## Run locally

```bash
COURSE_TWIN_WORKER_SECRET='at-least-32-random-characters-here' \
COURSE_TWIN_CALLBACK_ORIGINS='http://localhost:3200' \
npm run builder:start
```

The worker binds to `127.0.0.1:8787` by default. A remote/container binding requires `COURSE_TWIN_BUILDER_ALLOW_REMOTE=1` and should sit behind authenticated TLS ingress.

England uses the Environment Agency 1 m LiDAR WCS. Wales reads the official Welsh Government 1 m DTM Cloud Optimized GeoTIFF by bounded range requests and reprojects WGS84 course geometry into British National Grid. Scotland and Northern Ireland currently use the honest Copernicus GLO-30 fallback until their tile catalogues can be resolved automatically. Copernicus access through OpenTopography requires `OPENTOPOGRAPHY_API_KEY`.
