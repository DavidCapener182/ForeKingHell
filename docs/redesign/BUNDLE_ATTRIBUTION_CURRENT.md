# Production bundle attribution — 0500 snapshot

Read-only attribution from the successful Turbopack snapshot. Values are uncompressed initial JavaScript, matching the unchanged budget checker. Shared chunks are counted once per route; totals across routes must not be added. Snapshot predates subsequent UI edits.

Common to all 21 configured authenticated routes: **845.2 KiB** across 26 chunks. This is not necessarily removable JavaScript.

| Route                       | Initial KiB | Budget KiB | Over KiB | Outside common KiB |
| --------------------------- | ----------: | ---------: | -------: | -----------------: |
| `/today`                    |      1213.1 |     1035.2 |    177.9 |              367.9 |
| `/dashboard`                |      1087.1 |     1025.4 |     61.7 |              241.8 |
| `/import`                   |      1213.4 |     1152.3 |     61.1 |              368.2 |
| `/companion-runtime/import` |       936.7 |      927.7 |      8.9 |               91.4 |
| `/sessions`                 |      1188.3 |      937.5 |    250.8 |              343.1 |
| `/sessions/[sessionId]`     |      1201.8 |      913.1 |    288.7 |              356.6 |
| `/rounds/[sessionId]`       |      1019.0 |      957.0 |     62.0 |              173.8 |
| `/progress`                 |      1092.4 |     1025.4 |     67.0 |              247.1 |
| `/bag`                      |      1351.3 |     1103.5 |    247.8 |              506.0 |
| `/shots`                    |      1171.0 |     1123.0 |     47.9 |              325.8 |
| `/speed`                    |      1065.2 |     1025.4 |     39.9 |              220.0 |

## Largest initial chunks for Speed

These are included by the route; size alone does not identify which component owns the chunk. Inspect analyzer module attribution before changing imports.

| Chunk                                  |   KiB | Configured authenticated routes using it |
| -------------------------------------- | ----: | ---------------------------------------: |
| `.next/static/chunks/0-4srap-ffvu1.js` | 199.8 |                                       21 |
| `.next/static/chunks/2_fg3u1fiyogk.js` | 124.6 |                                       21 |
| `.next/static/chunks/1q26tx32xgzw6.js` |  57.9 |                                       11 |
| `.next/static/chunks/1u12-_hu1m-8i.js` |  49.0 |                                       10 |
| `.next/static/chunks/13csimbjqlz-u.js` |  48.4 |                                        1 |
| `.next/static/chunks/301zw9qwn6si5.js` |  46.3 |                                       21 |
| `.next/static/chunks/0fnq1prkdzcr8.js` |  36.7 |                                       21 |
| `.next/static/chunks/22oxav3zljm6l.js` |  33.2 |                                        1 |
| `.next/static/chunks/0ur35dn2jeeg0.js` |  31.7 |                                       21 |
| `.next/static/chunks/3yldrscf1mlub.js` |  31.4 |                                        8 |
| `.next/static/chunks/26g4tn5b226u5.js` |  31.2 |                                       21 |
| `.next/static/chunks/02q9me1tvza6m.js` |  30.5 |                                       21 |

Source diagnostics: `/private/tmp/fkh-redesign-build-20260907-0500/.next/diagnostics/route-bundle-stats.json`. No budget or runtime source was changed.
