# Aintree routing correction — 2026-09-13

The unnumbered OSM routes had been matched to scorecard numbers incorrectly. The local package now matches physical greens to the official course tour (https://www.aintreegolf.co.uk/hole_1 through /hole_9) and the nine numbered photographs supplied by David. Names are reference labels, not newly stored course data.

| Official hole | Name | Former route number | Supplied yards | Par | SI |
|---|---|---:|---:|---:|---:|
| 1 | Lottery | 9 | 549 | 5 | 3 |
| 2 | Little Charley | 5 | 199 | 3 | 6 |
| 3 | Ben Nevis | 8 | 449 | 4 | 2 |
| 4 | Foinavon | 4 | 146 | 3 | 8 |
| 5 | Double Chance | 6 | 255 | 4 | 9 |
| 6 | SunLoch | 2 | 206 | 3 | 5 |
| 7 | Disturbance | 7 | 454 | 4 | 1 |
| 8 | Wanderer | 3 | 428 | 5 | 7 |
| 9 | Last Suspect | 1 | 552 | 5 | 4 |

Landmarks: 1 leaves the clubhouse with the motor track left; 3 follows the outer track towards the far corner; 4 crosses the brook at the bend; 5 approaches the lake from the corner; 6 carries the lake to the bunkerless green; 7 returns from the lake; 8 reverses through the centre; 9 follows the home straight towards the clubhouse. Hole 2's former route started at the alternate par-4 tee; its existing intermediate map vertex lies on tee polygon OSM 1279395014 and is now the par-3 start. No new tee elevation was invented.

**Scorecard discrepancy:** David's image individually lists 428 yards for 8 but prints OUT 3292. Individual values sum to 3238. Substituting 482 would reproduce the printed total, but that is not a verified correction. The local card uses the supplied individual values and the package warning records the discrepancy. The official tour also describes a different yellow-tee par for 8; no tee-set equivalence is inferred.

The correction matches known green coordinates, not array order, and fails closed if source geometry changes. Rebuilding a local package re-applies it idempotently. Hole-owned features and putting-surface references follow their physical route. Package version increases to 2; terrain hashes and source imagery stay unchanged. It does not rewrite database scorecards, measured shot metrics, saved round scores, signed remote packages or previously saved virtual-round geometry. Newly reconstructed replays use the corrected local route for the original recorded hole number. This is not a terrain or putting-surface accuracy upgrade.
