# Local course scenery pipeline

The viewer uses packaged course terrain and source polygons. Decorative models do not change lies, collisions, shot calculations, source quality or QA flags. No deployment is part of this work.

## Rebuild

1. `npm run twin-assets:download` downloads bounded, cached Poly Haven assets. Original SHA256/provider checksums are in assets.json.
2. `npm run twin-assets:build` imports and optimises models in Blender and creates the editable course scene. Set BLENDER_BIN if needed.
3. `npm run twin-assets:optimise` repacks model images and prepares the sand texture. Run after build.
4. Run `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python tools/course-twin-blender/grass.py`. Repeat with `palm.py` and `car.py` for the original grass, tropical palm/billboard and compact parked car. These scripts also save editable .blend files.
5. `python3 tools/course-twin-blender/download-context.py` downloads cached, sequential OSM map extracts. `node --import tsx tools/course-twin-blender/build-context-catalogue.ts` regenerates all course context packages and their registry.
6. Run Blender with `preview.py` to create the textured Arscott inspection copy with 10 km viewport clipping.

Generated scenes and source downloads are ignored under scenes/ and .cache/. Browser models live under public/course-twins/common/blender-v1/. Blender coordinates are east, north, up; browser coordinates are east, up, south. glTF converts once. Grass is close-range geometry; distant vegetation uses billboards. Near/mid instance limits, deferred loading and balanced-quality mid models bound rendering cost. Optional model failures retain the packaged course. Cars are static decorative instances, not live traffic.

## Course-specific context

All 40 active local course packages have separate context entries in src/generated/course-twins/context-assets.json. The context-v1 database totals 14,663,754 bytes across all courses: 5,579 surface outlines, 6,566 buildings, 4,553 road/path ways, 140 parking areas and 1,850 inferred parked cars. Only the selected course downloads. Counts include nearby mapped features and can overlap between neighbouring course extracts.

The downloader uses bounded course turf/hole extents, a 16 MB response limit and 160 MB aggregate cache budget. No third-party map calls occur in the browser. Source query URLs, retrieval dates, checksums and OSM way IDs remain in each package. Runtime origin and heightfield checksum checks prevent loading scenery on the wrong course. Incomplete ways, multipolygon relations, geometries outside the terrain extent and elevated/tunnel roads are omitted; building count is capped at 2,000 per course. Coverage is not a complete survey.

Fresh mapped outlines take display precedence over overlapping legacy estimates. Greens, tees, bunkers, roads and parking are draped against the actual rendered terrain triangles; authoritative physics retains its original sampler. Roads have restrained edging, paths have a separate material, and cars appear only inside mapped parking footprints with clearance from mapped access lanes. Untagged road widths, parking occupancy/bay layout, building heights and small-building roof shapes are inferred. This is simplified scenery, not a surveyed architectural reconstruction. OSM attribution is visible and the derived database is distributed under ODbL 1.0.

## Verification

41 targeted tests pass, including all 40 course packages, anchoring/asset integrity, parking containment and terrain-triangle draping. TypeScript and the production build pass. Aintree and Bootle roads/car parks were inspected close up in Chrome; earlier checks covered Arscott, Arrowe Park and tropical Teeth of the Dog. This is not individual visual approval of all 40 courses.

Screenshots are under output/playwright/, including aintree-roads-final.png and bootle-roads-final.png. Mobile 390×844 layout and optional context/model request failure were exercised. Mobile checking is viewport emulation, not physical-phone performance evidence. Concurrent Blender/build activity confounded initial frame measurements, so no controlled before/after performance claim is made. The optional Bootle high-detail imagery endpoint returned 502; packaged imagery still rendered. Existing CSP report-only blob notices remain; security policy was not weakened.

The next shared refinement adds deterministic facade colours, window frames, glazing and doors to mapped buildings (up to 20,000 windows per course). Facades are inferred decoration and merged into the building draw call. Pavement grain fades with viewing distance; road strips subdivide across their width as well as along bends to reduce terrain intersections.
