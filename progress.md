Original prompt: Implement the proposed full ForeKingHell Course Twin plan: real course packages, replay, strategy, virtual play, live launch-monitor integration, scalable course generation and later multiplayer.

# Course Twin goal progress

## Verified foundation

- Bootle pilot route renders mapped holes, semantic surfaces and reconstructed Rapsodo replays.
- Authenticated manifest and replay APIs return scoped, provenance-labelled documents.
- Course Twin schema migration is applied to Supabase with forced RLS and authenticated SELECT-only grants.
- Three.js remains lazy and route-local; the current route passes its JavaScript budget.
- Course and round entry points, API boundaries and WebGL mounting have focused tests and browser smoke evidence.
- Bootle now has a reproducible Environment Agency LiDAR package with a 2.4 m browser mesh, georeferenced aerial reference imagery and a verified authenticated browser capture.
- The LiDAR work is isolated on `codex/course-twin-full` so the public-beta release checkout can remain frozen.
- Bootle now uses browser-sized ambientCG CC0 colour, normal and roughness maps for fairways, greens, tees, rough and bunker sand, with an auditable asset ledger. A feathered terrain-splat shader blends fairway, green, tee, bunker and water masks into the LiDAR terrain material instead of drawing opaque polygon overlays.
- Mapped woodland now uses four photographic British parkland tree silhouettes and four shrub silhouettes on crossed, instanced billboards. This replaces the toy low-poly canopies while keeping deterministic placement inside mapped woodland and outside mapped golf surfaces and water.
- The scene now includes a blue atmospheric dome, a full ring of low cloud banks and a restrained distant tree/roof line so golfer-level views no longer terminate in a flat white background.
- The runtime now offers separate Golfer and Aerial camera presets; the lower view exposes material detail and keeps replay tracers in the same real-terrain scene.
- Replay now renders only the selected shot. Selecting another shot resets playback and moves a lower Shot view camera behind that shot's recorded start coordinate, looking down its own start-to-end direction. Short chips retain at least 24 m of forward course context.
- Accessible camera controls now provide left/right orbit, optical zoom in/out and reset-to-selected-shot actions alongside drag/scroll controls. Optical zoom preserves the shot-start anchor instead of dollying past short shots.

## Active work

- [x] Add deterministic runtime state hooks for automated gameplay inspection.
- [ ] Replace prototype trajectory-only playback with a tested golf-flight, bounce and roll engine.
- [ ] Classify semantic landing surfaces and apply lie, penalty and collision rules.
- [ ] Add player-specific dispersion strategy and My Bag virtual-round play.
- [x] Produce a versioned real-terrain Bootle package through a repeatable course-builder pipeline.
- [ ] Add secure GSPro localhost bridge protocol and a signed-app build path.
- [ ] Add on-demand course jobs, package storage/versioning, QA corrections and wider-course adapters.
- [ ] Complete performance, accessibility, security, browser gameplay and regression verification.

## Known constraints

- The current Bootle runtime uses a Grade B 2.4 m mesh generated from Environment Agency 1 m LiDAR; putting contours remain explicitly unverified.
- Imported shot metrics are measured, but current course placement and flight animation are reconstructed.
- No live launch-monitor bridge or multiplayer runtime exists yet.
- The terrain-splat PBR pass and Golfer view are typechecked and have a clean hole 5 automated browser state; final full-page visual acceptance is recorded separately.
- The billboard vegetation and atmosphere pass typechecks cleanly. A live authenticated browser smoke selected Bootle hole 5, retained the saved-round replay tracers and visually confirmed the new foliage, clouds and distant background.
- Final visual evidence is saved at `/Users/davidcapener/.codex/visualizations/2026/07/22/019f8747-3ce1-7612-b9e7-37a32edced58/bootle-hole-5-real-vegetation-sky.png`.
- Camera/replay interaction evidence: the web-game state reports `visibleShotCount: 1`; selecting shot 2 changes `selectedShotIndex` from 0 to 1 and changes the camera anchor from shot 1's end to shot 2's start. Browser smoke confirmed the control panel, shot replacement, short-chip framing, orbit and anchored optical zoom.
- Production build and the formal route budget pass; `/play/[courseId]` is 954 KiB against a 1,025 KiB uncompressed limit. The new source-contract assertions pass directly. Vitest itself is currently blocked before test discovery by its CommonJS config requiring the ESM-only `std-env` package (`ERR_REQUIRE_ESM`).
