# UI release bundle measurements

Measured on 7 September 2026 using the normal Next.js 16.3 Turbopack production build. These measurements include the import first-use and social-preview loading fixes. No configured limit has been changed.

The existing checker measures uncompressed initial JavaScript, counting each route chunk once. Approximate gzip values below compress each chunk independently; they are not measured network transfer or interaction timing.

| Route                              | Existing cap (bytes) | Measured initial bytes | Approximate gzip bytes | Proposed release cap (bytes) |
| ---------------------------------- | -------------------: | ---------------------: | ---------------------: | ---------------------------: |
| `/today`                           |              1060000 |                1227526 |                 384401 |                      1240000 |
| `/dashboard`                       |              1050000 |                1096119 |                 343070 |                      1110000 |
| `/import`                          |              1180000 |                1230784 |                 385481 |                      1250000 |
| `/companion-runtime/import/result` |               930000 |                 984817 |                 306958 |                      1000000 |
| `/companion-runtime/rapsodo`       |               930000 |                1022748 |                 316812 |                      1040000 |
| `/sessions`                        |               960000 |                1200539 |                 373770 |                      1220000 |
| `/sessions/[sessionId]`            |               935000 |                1212287 |                 379557 |                      1230000 |
| `/rounds/[sessionId]`              |               980000 |                1026455 |                 318286 |                      1040000 |
| `/progress`                        |              1050000 |                1099766 |                 344158 |                      1120000 |
| `/bag`                             |              1130000 |                1369336 |                 424143 |                      1390000 |
| `/shots`                           |              1150000 |                1182365 |                 367767 |                      1200000 |
| `/speed`                           |              1050000 |                1071003 |                 333574 |                      1090000 |

## Changes already measured

- Deferring the full companion import workspace until first use preserves visited drafts. Browser checks passed at all six requested widths.
- Analytical routes no longer load the unused social feed preview. A production build passed; the quick import route now passes its original cap.
- Package-import optimisation, splitting form adapters, and direct Tabs/RadioGroup imports did not materially improve route sizes. Those experiments were not applied to the repository.

## Decision still required

The proposed caps above would accept the current larger UI bundles with about 1 percent headroom, rounded to 10,000 bytes. This is a performance requirement change, not proof that the original budgets passed. Keep all original limits unless the user explicitly accepts that tradeoff.

Further reduction requires changing loading boundaries around the new complete workspaces and their accessible controls. React Aria-containing chunks contribute substantial initial code to Today, Sessions and Bag, but this is not evidence that every byte is unavoidable. The budget checker and CI gate remain unchanged.
