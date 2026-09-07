# UI release bundle measurements

Measured on 7 September 2026 using the normal Next.js 16.3 Turbopack production build. The checker counts each initial JavaScript chunk once, uncompressed; these are not measured network transfer or interaction times.

## Original limits retained

The earlier proposal to raise limits was withdrawn. No configured limit or CI gate has changed. Optional workflows now load when requested; visited tabs retain state, complete phone tasks remain available, and shared components use narrow import boundaries.

Final production build: `/tmp/fkh-final-route-build.log`; checker: `/tmp/fkh-final-route-check.log`. **All 24 capped routes pass.** Every pre-existing limit is unchanged; the newly separated internal companion Today route has the same 1,060,000-byte cap as public Today. Public URLs, query parameters and authenticated surface selection are preserved.

| Route                              | Original cap (bytes) | Initial bytes | Result |
| ---------------------------------- | -------------------: | ------------: | ------ |
| `/`                                |               700000 |        583820 | PASS   |
| `/login`                           |               800000 |        583831 | PASS   |
| `/today`                           |              1060000 |       1052442 | PASS   |
| `/companion-runtime/today`         |              1060000 |        973508 | PASS   |
| `/dashboard`                       |              1050000 |        933555 | PASS   |
| `/import`                          |              1180000 |       1084140 | PASS   |
| `/companion-runtime/import`        |               950000 |        939832 | PASS   |
| `/companion-runtime/import/result` |               930000 |        903513 | PASS   |
| `/companion-runtime/rapsodo`       |               930000 |        871524 | PASS   |
| `/analyse`                         |              1050000 |        858217 | PASS   |
| `/coach`                           |              1050000 |        927151 | PASS   |
| `/practice`                        |              1120000 |       1090731 | PASS   |
| `/play`                            |               915000 |        858407 | PASS   |
| `/sessions`                        |               960000 |        916281 | PASS   |
| `/sessions/[sessionId]`            |               935000 |        923626 | PASS   |
| `/quick-bag`                       |               925000 |        851675 | PASS   |
| `/rounds/[sessionId]`              |               980000 |        938467 | PASS   |
| `/progress`                        |              1050000 |        978931 | PASS   |
| `/bag`                             |              1130000 |       1026422 | PASS   |
| `/shots`                           |              1150000 |       1051734 | PASS   |
| `/play/[courseId]`                 |              1050000 |        850995 | PASS   |
| `/stats/training-over-time`        |              1500000 |        972554 | PASS   |
| `/shots/review`                    |              1150000 |        894354 | PASS   |
| `/speed`                           |              1050000 |        983247 | PASS   |

## Preserved behaviour

- Required Select fields keep native validation and a usable failure fallback; the enhanced menu retains keyboard, focus and form contracts.
- Tabs use public React Aria hooks with preserved panel associations, disabled state and retained drafts.
- Unopened session evidence does not fetch or download its full workflow; first use exposes the complete task and reopening retains loaded content.
- Bag stock review keeps filters across closing, and the session carousel keeps its selected card across tab changes.
- Optional Bag, Rapsodo and Speed workspaces load when selected while preserving source data, calculations and first-use task controls.
- Narrow server shell imports avoid unrelated mobile controls without changing the page layout.

Scoped browser evidence is recorded in the completion tracker. Passing budgets is a release gate, not completion of the full migration acceptance matrix.
