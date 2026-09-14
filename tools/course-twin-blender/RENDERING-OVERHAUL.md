# Course landscape rendering pass — 13 September 2026

This pass stays in the existing Three/R3F viewer. It does not modify signed remote terrain packages, elevation samples, physics or saved scoring. The separately requested Aintree correction updates the local routing package and supplied scorecard values, as documented below. Local changes are not published.

## Confirmed causes and changes

The runtime sun had a shadow camera spanning **-5 to +5 metres**, targeting the origin, with a far plane of 500 m. No component fitted or moved it. It now follows the view's focus with a bounded local 160–480 m square shadow area, a fixed sun direction, light-space texel snapping and size hysteresis. High/balanced maps remain 2048/1024. Foliage alpha maps are used in the depth pass. This adds actual shadow work that the previous renderer was mostly skipping.

Vegetation previously used distance alone (including camera altitude). It now ranks visible instances by projected height, retaining the existing maximum 10 near / 20 middle trees in high quality, 4 / 8 balanced. Thresholds have hysteresis; partitions update at most about three times a second, with instancing retained. Bark and vehicles preserve exported material semantics instead of receiving leaf alpha/sidedness overrides. Matching unlit impostors replace unrelated species cards; old cards remain a failure fallback. Colour and shadow passes share very slight world-directed wind, frozen by the development QA configuration.

Fairway stripe amplitude drops from .085 to .035. Reliably mapped fairways suppress almost all aerial colour bleed. Low-frequency turf variation survives the normal-map distance fade. Only surveyed/source-mapped rough and course boundaries receive the stronger rough replacement: estimated boundaries do not justify painting over unknown surroundings. Collars are lighter. Balanced rendering uses corresponding turf colours. No surface boundaries or terrain heights are moved by the rendering changes.

The sky/fog backdrop uses one neutral colour family for both cameras. The floating horizon cylinder and unused cloud sprite system are removed. The existing sky texture now places its haze colour at the sphere UV equator, with ground-coloured lower sky and a restrained 650–1750 m fog transition. HDR remains low-intensity environment illumination, not a background or a new landscape. Water retains physical Fresnel/environment response with subtle normal detail and a cheap grazing-angle sky tint when an environment is unavailable. Shoreline bathymetry is not invented. Roads have restrained broad wear and fine grain; building bases have mild contact tint.

**Bootle pond correction:** cached OSM contained the water outlines but the importer retained only `golf=*` surfaces. Closed `natural=water` and `landuse=reservoir` ways now enter the shared decorative context pipeline. It restores 370 water polygons across 38 cached courses, including Bootle ways **1503034378** (5th approach) and **1503123505** (14th approach), plus a third Bootle pond. Data remain ODbL, with source IDs, original extract timestamps, checksums and terrain anchoring. This is a scenery correction; signed gameplay hazard data and ball penalties are unchanged. Multipolygon relations and incomplete/out-of-bounds ways remain unsupported.

Scenery view hides in-scene numbers, shot traces, aim guides and dispersion. The strategy/replay/play controls, selected-hole flag and measurement/reconstruction disclosures remain available. Turning analysis back on restores the layers.

## Aintree routing review

Official tour photos and descriptions identify the new holes 1–9 as former routes **9, 5, 8, 4, 6, 2, 7, 3, 1**. The second uses an existing map vertex on the par-3 tee instead of the alternate par-4 start. Green coordinates, feature shapes and terrain samples stay fixed. Feature/survey ownership follows the corrected route; saved scores and measured shot metrics are not renumbered. The local builder applies the correction idempotently by physical green and requires review if that geometry changes. See `../course-twin-builder/catalog/aintree-routing-review.md` for all nine rows and evidence. The supplied card has a 54-yard conflict between its individual entries and printed total; that warning is retained rather than claiming verified yardages.

## Reproducible Blender work

No new downloads or paid assets were required. Existing Poly Haven CC0 tree_small_02 and shrub_04 models are the source of 512-pixel albedo/opacity impostors. `impostors.json` records source pages, licence references, source GLB hashes and output hashes. The original two-metre rough AO tile is CC0; `rough-ao.json` records its channel contract and checksum. Combined new PNGs are 653,237 bytes. The AO texture is linear/non-colour, separate from albedo, and multiplies **indirect diffuse only**, fading between 30 and 90 metres. There are no baked sun shadows. Editable Blender files remain under ignored `scenes/`.

From the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python tools/course-twin-blender/bake-impostors.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python tools/course-twin-blender/bake-rough-ao.py
python3 tools/course-twin-blender/download-context.py --offline
node --import tsx tools/course-twin-blender/build-context-catalogue.ts
```

## Inspection and measurement

Development-only tools:

- `?shadowDebug=1`: Three CameraHelper showing the fitted shadow volume.
- `?terrainDebug=masks|albedo|normals|roughness|shadows|aerial`: inspect the terrain channels separately. The original aerial file and attribution are retained.
- `window.courseTwinVisualQa.configure({dpr:1})`: fixed pixel density and frozen wind.
- `.camera(position,target)`, `.resetFrames()`, `.read()`, `.landmarks()`, `.release()`.
- Readback includes shadow bounds, detail counts (including visible far instances), pixel ratio, viewport, median/p95/p99/max frame intervals, draws, triangles, geometry/texture counts and resource-body bytes.

Comparisons use the old renderer on localhost:3201 and the new renderer on :3200, the same Chrome session, 1440×900 viewport (1184×844 canvas), fixed DPR 1, high quality, exact numeric camera poses and static wind. They are local development measurements, not production/mobile hardware benchmarks. Network-body totals include cached responses and are not equivalent to cold-wire download bytes; source-file sizes are recorded separately. Loading/warm-up samples must not be treated as steady performance.

Screenshots and raw measurement captures are under ignored `output/playwright/`. Aintree and Bootle have elevated, tee, green and water views; Aintree also has a fixed tree/contact view. Bootle's pond14 comparison is a fixed camera over the fourteenth while the matching baseline's selected HUD hole remains five; `bootle-14-pond-restored.png` shows the actual fourteenth HUD.

## Limits visible in the browser

Mapped silhouettes are still limited by source polygon resolution; coarse terrain provides no measured bunker depths or fine putting contours. Unmapped Bootle rough and surrounding imagery remain visibly blurred. There is one modelled broadleaf canopy shape, with matching far views rather than three fictitious species changes. Water is inexpensive and does not provide real-time landscape reflections or measured depth. Local shadow coverage deliberately does not cover the whole course at once. Regional palm assets remain the tropical fallback. Browser emulation is not a physical iPhone test.

## Final local validation

Production build, TypeScript and scoped ESLint pass. 88 targeted Vitest tests and five routing/builder tests pass, including the 40-course context asset audit. Aintree and Bootle rendered with no page/renderer errors; the shadow-only debug shader shows actual leaf shadows. Blocking all new Blender assets loaded the legacy tree/shrub WebP fallback and retained a working canvas. The 390×844 balanced viewport has no horizontal overflow; a global workbench display rule was overriding the desktop navigation visibility, now isolated with a dedicated CSS class. This is desktop Chrome emulation, not a physical-device result.

Fixed DPR 1, 1184×844 canvas, high quality, 12 s initial warm-up and 5 s frame windows per pose. Values are **before → after**, milliseconds for timings. These are a single development run per pose, not a claim of universal speed improvement.

| Course / view | Median | p95 | p99 | Max | Draw calls | Triangles | Geometries | Textures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| aintree / aerial | 11.1 → 12.3 | 15.4 → 16.1 | 17.5 → 17.9 | 19.7 → 18.5 | 68 → 55 | 964,675 → 1,098,947 | 52 → 47 | 52 → 56 |
| aintree / ground | 8.9 → 10.1 | 13.1 → 13.8 | 15.8 → 15.1 | 35.9 → 16.0 | 75 → 55 | 1,239,892 → 952,378 | 59 → 48 | 64 → 59 |
| bootle / aerial | 9.7 → 11.5 | 14.6 → 15.7 | 16.7 → 17.1 | 17.5 → 20.0 | 79 → 64 | 1,230,275 → 1,382,900 | 58 → 52 | 49 → 56 |
| bootle / ground | 12.8 → 12.2 | 17.7 → 16.7 | 20.7 → 18.3 | 22.8 → 20.7 | 80 → 63 | 1,473,679 → 1,394,102 | 63 → 56 | 59 → 60 |

Actual shadows add work: aerial median rose about 1–2 ms despite fewer draw calls; Bootle ground-level improved slightly. Aintree resource-body totals were 7,070,474 → 13,122,875 bytes; Bootle 5,901,048 → 6,559,909. These include optional imagery, cached bodies and loading behaviour, so do not attribute the entire difference to the 653,237-byte new PNG set or equate it to cold network transfer.

Three client-side course transitions (Aintree → Bootle → Aintree) completed. Aintree returned to 155 objects and 75 geometries; textures changed 43 → 48 as optional assets warmed. This is a short lifecycle check, not proof against long-session leaks. Pure texture-loader tests separately verify disposal of stale and owned textures and the failed-primary fallback.

## Refocused landscape pass

After the Aintree routing detour, the brief was re-read and the following actual browser defects were corrected:

- The decorative treeline cylinder floated above the terrain edge, exposing a blue gap. Removing it also removes invented distant buildings/trees. The old sky ramp put its horizon colour near the bottom of the spherical texture rather than its equator; the corrected ramp agrees with the distance haze.
- The broad turf shader assumed a mean luminance around 0.35 per grass sample. The actual Grass001 texture averages 0.090 in linear colour space (64×64 reduction: p10 0.0795, p90 0.1008). Its two-sample variation had mostly clamped to the same dark value. It is now centred on 0.18 for two samples and samples coarse mip levels, retaining broad variation without enlarging grass blades. Fine-grass normal fading remains 25–100 m.
- The previous water normal generator used unrelated X/Y waves and nonperiodic edges. Three related oblique periodic derivatives now tile seamlessly; a rougher clearcoat reduces the grid-like highlight. No additional textures, model downloads, real-time reflections or postprocessing were added.

The revised shader compiled in the browser with no renderer/page errors. Scoped ESLint, 72 targeted tests, TypeScript within the production build, and the production build passed. Both courses were rechecked at the identical fixed aerial and golfer-height cameras. Raw results: `output/playwright/course-refinement-final-measure.log`; screenshots `final-{aintree,bootle}-{aerial,ground}-3200.png`, with the preceding pass retained as `refinement-*-before.png`.

The view still shows coarse source silhouettes, simplified tree canopies and repetitive illustrative buildings; it is more coherent, not photorealistic or a higher-accuracy course survey. These limits should not be hidden through camera changes or invented terrain detail.

Matched refinement timing (previous pass → refined pass, median / p95 ms):

- aintree aerial: 12.3 / 16.1 → 11.8 / 15.8; draws 55 → 54.
- aintree ground: 10.1 / 13.8 → 9.8 / 13.9; draws 55 → 54.
- bootle aerial: 11.5 / 15.7 → 10.1 / 14.2; draws 64 → 57.
- bootle ground: 12.2 / 16.7 → 12.0 / 16.5; draws 63 → 62.

These short local windows include normal run-to-run variance. Removing the cylinder saves one draw; view-dependent LOD can alter other counts. No physical-phone or cold-wire benchmark is claimed.

The final Aintree sixth-hole water close-up was captured in an isolated headless Chrome session after 12 seconds of warm-up, with one working canvas and no page errors: `output/playwright/refinement-aintree-water.png`. It shows the revised highlights and the remaining coarse shoreline. An earlier shared-browser capture was invalidated by navigation and is not used as evidence.
