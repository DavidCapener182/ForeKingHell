# Plan tee coverage audit

14 September 2026. Local package inspection, not a survey or live validation of every course.

Tee features carry IDs, source and optional hole ownership, but no verified colour field. A scorecard distance does not uniquely locate a tee. Do not manufacture white/yellow/red positions by subtracting yardages along a route. Official Aintree sources checked: https://www.aintreegolf.co.uk/scorecard and https://www.aintreegolf.co.uk/hole_1. They do not supply georeferenced tee-colour coordinates.

Saved selections are device-local, separated by course, package version and coordinate origin. Custom locations remain user-selected, not surveyed. Unknown holes, invalid numbers and out-of-package positions are rejected on restoration.

| Course | Holes | Tee polygons | Holes with owned mapped tees | Invalid reference coordinates |
|---|---:|---:|---:|---:|
| Aberystwyth Golf Course | 18 | 18 | 0 | 0 |
| Aintree Golf Centre | 9 | 9 | 0 | 0 |
| Aldenham Golf Club | 18 | 18 | 0 | 0 |
| Alexander Park Resort | 18 | 0 | 0 | 0 |
| Alsager Golf and Country Club | 18 | 0 | 0 | 0 |
| Altrincham Golf Course | 18 | 0 | 0 | 0 |
| Arrowe Park Golf Course | 18 | 0 | 0 | 0 |
| Arscott | 18 | 0 | 0 | 0 |
| Ash Valley Golf Club | 18 | 18 | 0 | 0 |
| Ashton & Lea Golf Club | 18 | 18 | 0 | 0 |
| Aspley Guise & Woburn Sands Golf Club | 18 | 0 | 0 | 0 |
| Astbury Golf Course | 18 | 18 | 0 | 0 |
| Badgemore Park Golf Club | 18 | 0 | 0 | 0 |
| Barkway Park Golf Club | 18 | 0 | 0 | 0 |
| Barnard Castle Golf Course | 18 | 0 | 0 | 0 |
| Bearwood Lakes Golf Club | 18 | 0 | 0 | 0 |
| Belton Park Golf Club | 18 | 0 | 0 | 0 |
| Bentham Golf Club | 18 | 18 | 0 | 0 |
| Benton Hall Golf and Country Club | 18 | 18 | 0 | 0 |
| Bird Hills Golf Centre | 18 | 0 | 0 | 0 |
| Blackwell Golf Club | 18 | 0 | 0 | 0 |
| Bletchingley Golf Course | 18 | 0 | 0 | 0 |
| Bootle Golf Course (Bootle) | 18 | 0 | 0 | 0 |
| Bowood Park Golf Course | 18 | 0 | 0 | 0 |
| Bransford Golf Club | 18 | 0 | 0 | 0 |
| Brean Golf Club | 18 | 0 | 0 | 0 |
| Brett Vale Golf Course | 18 | 18 | 0 | 0 |
| Brickhampton Court Golf Complex | 18 | 0 | 0 | 0 |
| Bridport and West Dorset Golf Club | 18 | 0 | 0 | 0 |
| Brookmans Park Golf Course | 18 | 0 | 0 | 0 |
| Buckingham Golf Club | 18 | 0 | 0 | 0 |
| Bulbury Woods Golf Club | 18 | 0 | 0 | 0 |
| Doral - Blue Monster | 18 | 18 | 2 | 0 |
| Ellesmere Port | 18 | 0 | 0 | 0 |
| Firestone South | 18 | 0 | 0 | 0 |
| Mountain Park Hotel and Golf Club - Mountain Park | 9 | 0 | 0 | 0 |
| Quail Hollow Club | 18 | 0 | 0 | 0 |
| Sedgefield Country Club | 18 | 0 | 0 | 0 |
| Teeth of the Dog | 18 | 0 | 0 | 0 |
| TPC Sawgrass - THE PLAYERS Stadium Course | 18 | 0 | 0 | 0 |

Total packages: 40. Official tee-colour mapping remains an evidence gap across the catalogue. Context may add visual tee polygons, but unowned polygons are not automatically assigned to neighbouring holes.

## Implementation and evidence

- Device-local tee persistence uses validated hole IDs/finite in-bounds coordinates and keys containing course ID, package version and coordinate origin. A storage failure retains session-only behaviour with an explicit message.
- Alternate tees join the remaining route at the nearest segment, preventing a forward tee from routing backwards around a dogleg. Official scorecard yards remain unchanged; the UI separately labels direct distance to pin.
- Plan ranks the initial club against the current display surfaces and tee. A deliberate club selection remains selected while aiming.
- Desktop and mobile have two-degree aim nudges and reset. Mobile defaults behind the tee; camera drags do not count as aim clicks. Tee options live in expandable mobile controls.
- All 320 simulated landings are displayed and used in the percentages. Dot colours distinguish fairway, green, rough/sand and hazards. This is a planning visual improvement, not a claim of photorealistic turf or surveyed bunker depths.
- Live checks: Aintree saved custom tee restored after reload with matching panel values; reference reset restored the original calculations. Bootle, Arscott and Teeth of the Dog each loaded a 320-point plan and changed probabilities after aim nudges. Separate course selections remained at reference. Two blocked context requests still left a working course canvas. Phone-size emulation showed no horizontal overflow and used the golfer camera; physical-phone validation remains outstanding.
- Catalogue inspection: 40 packages, 702 holes, no invalid reference coordinate triples. This does not verify accuracy or tee colours.
- 82 targeted tests pass, including persistence corruption/isolation, forward-tee routing, straight-shot dispersion, visible sample percentages, shifted origins, context assets and rendering guards. Final scoped lint, TypeScript and production build pass. Concurrent marketing/root-layout errors were resolved by their owning task before the final successful build.

## Outstanding work

1. Verified colour-to-position mapping requires georeferenced tee data or a reviewed labelled course map. Existing official scorecards do not establish those coordinates. No red/yellow/white positions have been fabricated.
2. The larger landscape art pass remains unfinished: finer source silhouettes for greens/bunkers and less repetitive tree/building assets need further visual work. This pass improves planning readability, not those underlying assets.
3. Physical-phone checks and cross-device/account-synced tee preferences are not implemented; saved tee locations are local to this browser.

No commit, push or deployment was performed.


## Final refinements

The initial club is re-ranked using the current tee and displayed boundaries. Final Bootle first-hole browser readback selected GW, 107.8 yd carry, 23.2 yd average leave, 76.56% fairway and 11.56% green; these are simulation results for that local fixture, not verified real-world odds. The final mobile readback used the golfer camera and had no horizontal overflow or page errors. Screenshots: `output/playwright/plan-final-bootle.png`, `plan-final-mobile.png`.

Fine texture luminance references were also calibrated from existing source images in linear space: Grass005 mean 0.1950, Grass008 0.1937, Ground080 0.3555, replacing unsuitable 0.47/0.47/0.63 offsets. This restores restrained fine-grain variation instead of clipping much of it to a constant. Matching close-up captures are `output/playwright/surface-fine-before.png` and `surface-fine-after.png`; the visual change is modest and does not alter terrain geometry. This does not finish the broader landscape art pass.
