# iPhone companion implementation ledger

Baseline: main `8efd2b6b`; refreshed origin/main on 5 September 2026 and confirmed 0 commits ahead / behind. The pre-existing `.github/workflows/nightly.yml` modification is unrelated and retained. Changes are local; this document does not claim deployment.

David's brief stops during section 23. The subsequent instruction authorises finishing the iPhone experience and mobile polish by judgement. Desktop, authentic account data, calculations, and valid deep links remain the boundaries.

## Architecture audit

Inspected the route inventory (97 page routes), source structure (1,451 source files at baseline), tests, domain boundaries and recent implementation history. App Router entrypoints live in `src/app/(app)`; feature implementations also live in `src/app`. `proxy.ts` applies companion handoffs using `app-route-capabilities.ts`. `PrivateAppShell` selects companion/workbench, and route metadata owns navigation/back links. An explicit workbench choice remains authoritative.

Drizzle schema, domain services and authenticated server actions remain authoritative for shot lifecycle, stock yardages, speed transfer, practice prescriptions, training load and scoring. Releases #31 and #32 supplied existing shot-integrity and speed-evidence behaviour. The mobile work consumes those calculations rather than replacing them.

## Implemented coverage

| Brief                           | Implementation                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–3: companion and navigation   | Today, Practice, Play, Progress and Bag are the five persistent destinations. Sessions, shots, import, settings and secondary tools remain available under contextual navigation. Existing deep links are retained.                                                                                                                                                                                           |
| 4: shell                        | Contextual compact titles/back actions, native large titles, profile entry, stable safe-area tabs, saved tab scroll, keyboard adaptation and immersive activity chrome. Existing accessible Radix/Vaul sheets keep focus and scroll locking.                                                                                                                                                                  |
| 5–6: design system              | Semantic green light/dark tokens, Apple system-font stack, type roles, readable metrics, touch targets, restrained surfaces and reduced-motion support. Grouped primitives have one implementation with compatibility exports for existing callers.                                                                                                                                                           |
| 7: Today                        | One evidence-backed focus, greeting/date, current saved activity, next action, meaningful measured change and compact recent activity. Low sample counts are explicit.                                                                                                                                                                                                                                        |
| 8: Practice                     | Recommendation, quick duration changes, intent/facility/energy sheet, block preview and a single start/resume action. Failed regeneration retains the previous plan.                                                                                                                                                                                                                                          |
| 9: Range Mode                   | Immersive instruction-first screen, success target, swipe/previous/next, ball counter, block progress, notes, pause and finish. Wake-lock/haptic hooks are capability-dependent. Full active plan, selected block, counts, notes and completion survive local recovery; progress retries online. Activity completion remains distinct from measured success.                                                  |
| 10: Quick Range                 | Single-screen club/focus/balls/optional-target setup; timer and manual shot context; local recovery; measured import, note and review handoffs. Practise-this-club links preselect the club.                                                                                                                                                                                                                  |
| 11: Speed                       | Existing playing speed, verified PB, seven-day average and comparable-session trend, target and labelled carry projection; staged training, measured entry, rest timer, fatigue guidance, target ladder and history. PB feedback follows saved evidence. Ball-transfer quality remains separate from raw speed.                                                                                               |
| 12: Play                        | Selected course/tee, real readiness/last played, preparation, Course Twin, Start Round and Quick Bag. Only missing setup is surfaced. Chronological recent rounds replace dashboard clutter.                                                                                                                                                                                                                  |
| 13–14: strategy and Course Twin | Mapped one-hole strategy, personal dispersion, evidence-supported Safe/Normal/Aggressive, hole navigation/swipe. Course Twin retains dynamic scene loading, mobile quality tiers, resolution/shadow controls and fallback. Mobile modes read Plan/Play/Replay. Explicit Plan/hole links now survive loading an older resumable round.                                                                         |
| 15–16: rounds                   | Short course/tee start flow; outdoor score/putt/penalty controls, optional fairway/GIR/notes, hole swipe and running score. Serial account-scoped offline saves retain operation IDs and version preconditions. Completion drains pending holes before marking the round complete. History and Summary/Scorecard/Map/Insights retain existing scoring calculations; advanced correction remains in workbench. |
| 17: session review              | Session metadata, verdict, measured pattern, swipeable metric story, signals/change/next practice and direct shot exploration. Heavy measured charts load on demand.                                                                                                                                                                                                                                          |
| 18–19: shot evidence            | Lightweight shot rows, club/session/trust/type/search/sort filters, detail sheet, review suggestions, reasons/confidence, reversible exclusion/restore and batch review. Club correction validates ownership, records provenance and refreshes both clubs' trusted stock. Raw measurements and source rows are retained. Existing importer/statistical classifications remain authoritative.                  |
| 20–21: bag                      | Distance-ordered trusted club ladder, compact range bars, rounded phone metrics, club detail/evidence/next practice. Quick Bag has Carry/Total and account-scoped offline caching.                                                                                                                                                                                                                            |
| 22–23: progress and training    | Performance/Scoring/Training/Goals story using existing scores and confidence. Training Over Time has range selection, fitness/load/form, compact chart, evidence and recent sessions.                                                                                                                                                                                                                        |
| Offline/account boundaries      | Public offline shell preloads its static assets and recovers same-account Quick Bag, Range Mode, Quick Range and scoring. Private HTML is not cached. Signing out/account switching purges private companion storage.                                                                                                                                                                                         |

## Data and capability boundaries

- No new demo data is shipped. Empty, unavailable, modelled and low-confidence evidence remain labelled.
- Automatic review now combines existing triage with conservative wrong-club suggestions: paired carry/speed, one unique alternative, at least 20 trusted samples from two other sessions, matching equipment identity/source/context. Intentional chips and pitches are classified without filling the suspect-data queue. Suggestions never change data automatically. Keep records provenance and supports guarded Undo; exclusions and club corrections remain reversible.
- Plan-versus-actual, measured replay, weather, strike quality and handicap effects use available linked evidence. No planned/actual shot pair or performance improvement is manufactured from manual completion.
- Screen wake lock, vibration and device offline storage depend on browser capability. WebKit emulation verifies rendering, not physical iPhone haptics or battery consumption.
- Full authenticated production mutation tests were not run against the personal account. Round retry/completion QA used isolated local fixtures with intercepted requests. Existing data-lifecycle tests cover server/domain paths.

## Verification — 5 September 2026

- Full Vitest suite: **466 files, 2,242 tests passed**.
- TypeScript: `npx tsc --noEmit` passed.
- ESLint: all changed/new TypeScript and TSX files passed without warnings.
- Production Next build passed. Every configured route bundle budget passed; heavy practice result and range modules, and session charts, were split instead of raising budgets.
- Chromium and WebKit iPhone checks: Today, Practice, Range Mode, Play, Progress, Bag, Quick Bag, club detail, session review, shots, new round, speed, training and mapped strategy. Verified 390/393-pixel layouts; targeted 320-pixel checks for Practice, scoring setup, shot/speed surfaces and strategy. Inspected light/dark and reduced-motion states.
- Strategy: next hole and Safe selection work; no horizontal overflow at 320 pixels. Course Twin Plan link preserved its mode after loading the saved round; rendered mapped course and personal shot overlay without horizontal overflow.
- Isolated scoring interaction: offline score/note persistence and reopening passed; missing-score completion refused; simulated uncertain response retried the identical operation envelope; completion followed all hole acknowledgements.
- Production service worker: cold offline navigation recovered Quick Bag, including Carry/Total, from the public offline shell.
- Desktop workbench: shot table remains present, mobile tab bar absent, and explicit surface selection retained. An existing Radix checkbox style hydration warning was observed in development; the table remained functional.
- `git diff --check` passed. Alternate-build generated `tsconfig.json` edits were removed. Unrelated nightly workflow change retained.

Screenshots are in the ignored local `output/playwright` folder. Representative evidence: `iphone-today-light-settled.png`, `iphone-practice-final.png`, `iphone-range-mode-final.png`, `iphone-club-detail.png`, `iphone-session-review.png`, `iphone-strategy-final.png`, `iphone-course-twin-settled.png`, `iphone-offline-quick-bag.png` and `desktop-shot-regression.png`.

## Continuation checklist

- [x] Previous turn classified as verified implementation progress.
- [x] Implement automatic wrong-club review without altering raw data or authoritative calculations.
- [x] Add owned Keep/Undo and batch review with audit provenance and conflict guards.
- [x] Add explicit route registration and preserve deep navigation.
- [x] Add the missing seven-day speed trend without mixing measurement contexts.
- [x] Verify real-account read-only queue rendering in WebKit; no account review mutations made during UI QA.
- [x] Re-run complete verification after the automatic-review addition: 466 files / 2,242 tests, TypeScript, ESLint, production build and all configured route budgets passed. Added budget coverage for automatic review and Speed.
- [ ] Audit individual remaining acceptance details beyond the implementation coverage summary.

### Acceptance details still under review

- Today currently builds Recent from session/round records. The requested combined achievement/PB/goal-event timeline still needs integration and evidence.
- Active-round Play shows progress, score, to-par and Quick Bag; the requested direct Strategy shortcut is not yet present in that active-round hero.
- Inspect remaining immersive-flow details, club evidence consistency, and secondary settings/error states individually before claiming the full brief complete. The coverage table above is not proof of every acceptance detail.
