# ForeKingHell UI upgrade checkpoint

Updated 6 September 2026. Branch: `upgrade/untitled-ui-migration`.
Do not merge into main or deploy. Scope remains **98 routes / 492 component IDs**.

## Completion and current work

- Fully signed-off component IDs: **none**. No row is marked Passed without its full acceptance evidence.
- Implemented with partial verification: **G01, G05, G06**.
- Concurrent redesign evidence reconciled, still incomplete: **P44-C01, P44-C02, P44-C03, P45-C01, P45-C02, P51-C04, P51-C05**.
- Remaining **482 rows are Not started** in this migration tracker; concurrent work may provide further reusable evidence.
- Current batch: G06 navigation implementation and fixture matrix finished.
- First unfinished component to resume: **G01 acceptance gaps**, followed by G05/G06 acceptance gaps. Next implementation component: **G10**.

## Plan and work order

1. G01 → G05 → G06 → G10, then remaining G02–G14 shared components.
2. P01 Progress: validated comparison parameters, honest historical baseline and one recommendation source.
3. P35 Import and P36 result: source selection and complete desktop/mobile workflow.
4. Remaining routes in ForeKingHell-route-coverage.csv order, one complete page pack at a time.
5. Update each component's desktop/mobile fields independently. Never reset prior status/evidence or claim a handoff completes a mobile task.

## Starting state and reconciliation

All four root specifications were accessible in the attachment and extracted into the repository. CSV validation confirms 492 unique components, 478 route components, 14 shared components and 98 route rows; every documented source path exists.

HEAD at start was the audited commit `cf9de4018e0273a7f86a0ae69791af4ff414d29c`. Substantial uncommitted redesign changes already existed. `docs/ui-upgrade/starting-state.json` records the tracked dirty-file hashes at intake; those are evidence, not file locks. Later concurrent work is also present.

Read AGENTS.md, DESIGN.md, PRODUCT.md, the audit/master contract, relevant shared prompts, installed Next.js CSS and server/client guides, and the current docs/DESIGN_SYSTEM.md. Preserve all project instructions and branding.

- F01–F03 Progress fixes remain outstanding. No Progress implementation was done in this batch.
- F04 mobile capability restrictions remain; adding destinations to More does not complete their tasks. `/goals` in companion still redirects to `/companion/summary`.
- F05 reproduced source cause fixed: MobileAppShell no longer hides a server-selected companion at lg. Wide preview has named spacing roles, readable title/chrome, and bottom-tab clearance.
- F06 workbench Import cards remain outstanding; preserve the other agent's current import/practice edits.
- F07 shared headers now have one responsive tree, all supplied actions/metrics, natural wrapping and a semantic section heading. Operational font-family overrides now use the existing UI sans stack. Preserve specialist renderers and caller-supplied visual sizes.
- F08–F12 remain route/component tasks except the initial namespaced header composition and licensing register.
- Current bottom tabs are Today, Sessions, Practice, Play, Bag, confirmed in code and the current design contract. Earlier memory with different destinations is superseded.

## Coordination and file ownership

Other active thread: `01a077ea-7dd8-7ef2-979b-944425998882`, **Redesign ForeKingHell experience**. David explicitly requires communication before touching its files. Use send_message_to_thread and coordinate browser/HMR windows.

This thread owns shared premium headers, globals, companion/private/workbench shells, MobileNav, nav-items and associated tests, mobile-sports/mobile-primitives, app-surface-link, app-route-capabilities when needed, new Untitled UI namespace, new navigation helper, root specs/tracker/checkpoint and docs/ui-upgrade. The other agent granted these paths and agreed not to stage them.

Other agent owns rounds, course strategy, post-round review, their helpers/tests, docs/redesign and scripts/generate-redesign-ledger.mjs. Earlier dirty Today/Practice/Bag/shared primitive changes are also theirs. Do not stage or revert their changes. Read `docs/redesign/UNTITLED_HANDOFF.md` before touching P44/P45/P51. Their verified lifecycle covers rejected creation, score retry/reload, exact-once completion, note-save failure/retry, desktop parity and foreign-round rejection; full component/viewport acceptance is still incomplete.

## Changed implementation files

- `src/components/untitled-ui/headers.tsx`, `headers.module.css`, `headers.test.tsx`: namespaced semantic header compositions, preserving caller events/forms and visual dimensions.
- `src/components/premium.tsx`: compatibility exports point to the single header implementation; PageShell stays full-width; DataPanel remains content-sized.
- `src/app/globals.css`: scoped operational heading/numeric font-family consolidation. Other agent's palette and prior styling changes preserved.
- `src/components/app/surface-visibility.module.css`, `companion-preview.module.css`, `src/components/mobile-sports.tsx`: explicit surface-aware root visibility, wide preview spacing and bounded navigation drawer.
- `src/components/app/app-surface-link.tsx`, `src/lib/app-surface-navigation.ts`, its test: native navigation retains route/query/fragment and existing beforeunload handling.
- `src/components/app/private-app-shell.tsx`, `companion-app-shell.tsx`, `workbench-app-shell.tsx`, `mobile-nav.tsx`, `nav-items.ts`: pass server role into More, list authorised canonical tasks, retain five tabs and existing Best shots entries, wrap account identity and preserve context when switching.
- `src/components/premium-layout.test.ts`, `src/components/app/nav-items.test.ts`, `src/lib/app-surface-switch-source.test.ts`, `src/lib/clubhouse-theme-contract.test.ts`: align checks with the new adapter and the other agent's documented neutral/white palette.
- `tests/e2e/ui-upgrade-shared.spec.ts`: read-only six-viewport regression matrix, no saves/uploads/payments/invitations/deletes and no auth-state rewriting.
- `scripts/ui-upgrade.py`: read-only inventory validation, status and exact-component prompt extraction. Never resets the tracker.

## Checks and evidence

Evidence directory: `output/playwright/ui-upgrade/` (local, gitignored).

- **59 tests in 10 files passed**, `unit-final.log`.
- **TypeScript passed**, `typecheck-final.log`; scoped **ESLint passed**, `lint-final.log`.
- Browser matrix **3 tests passed (25.3s)**, `browser-final.log`.
- More screenshot readback initially caught an in-progress opening animation; captures now wait for full opacity. Focus/search/empty-state matrix rerun **1 passed (8.0s)**, `browser-menu.log`.
- **18 screenshots**: G01-goals, G05-today-companion, G06-more at each of 1440×900, 1280×800, 390×844, 360×800, 1023×800, 1024×800. Representative desktop/mobile images visually inspected.
- G01 assertions cover one header title, reachable/focusable primary action and header bounds/wrapping. Narrow G01 screenshots are **explicit workbench header checks**, not proof of a complete companion Goals task.
- G05 covers one visible main/content tree at all sizes and companion → workbench → companion query-preserving navigation after hydration.
- G06 covers searchable Billing destination, no-match recovery, Escape focus restoration, viewport-bounded drawer and 44px bottom-tab targets. Unit tests verify player/admin directory membership and no duplicates.
- Initial localhost:3000 saved session was expired; both attempts stopped at login and are not UI evidence. Passing checks used the existing disposable localhost:3116 fixture and local-auth helper.
- No production build was run: avoid overwriting either running server's dist directory. Full repository suite/build, route-wide QA and remote CI remain outstanding.

## Outstanding acceptance and blockers

- G01: 200% zoom, browser long-name/content fixtures, dynamic loading/error/empty caller combinations, full screen-reader/contrast and theme matrix.
- G05: unsaved drafts on routes without DirtyFormBar, long account identity/avatar-error fixtures, complete account action outcomes and screen-reader/zoom/theme checks. Native beforeunload support alone is not draft recovery.
- G06: every documented route/destination and redirect, completion of currently gated mobile tasks, physical keyboard/safe-area, screen-reader/zoom/theme checks. Menu discoverability is only a shared navigation improvement.
- G10 and remaining shared components not implemented. React Aria is not installed; current interactive primitives remain Radix. Do not blindly translate Radix props.
- Paid Simple page-header / section-header examples were unavailable; no entitlement established and no paid code copied. Accessible local composition and exact official references are recorded in `docs/ui-upgrade/untitled-ui-register.md`.
- No real-account live viewport verification, physical Safari/PWA, complete offline recovery, performance benchmark or mutation fixture matrix is claimed.

## Exact resume instructions

1. Read this checkpoint and tracker. Run `git branch --show-current`, `git status --short`, `python3 scripts/ui-upgrade.py status`. Stay on the upgrade branch; preserve all concurrent dirty work.
2. Contact the other thread before editing shared/round files or starting browser work. Localhost:3000 is real data/read-only and its saved auth was expired. Localhost:3116 uses disposable fixtures and `.next-e2e`; never restart either server without coordination.
3. Run `python3 scripts/ui-upgrade.py prompt G01` and finish the outstanding G01 acceptance checks without repeating passed checks unless identifying a regression. Then finish G05/G06 gaps; load G10 next. Read one page/component prompt at a time with the master contract retained.
4. To rerun only this read-only matrix after relevant changes: `PLAYWRIGHT_BASE_URL=http://localhost:3116 PLAYWRIGHT_E2E_AUTH_BYPASS=1 npx playwright test tests/e2e/ui-upgrade-shared.spec.ts --project=chromium --reporter=line --output=output/playwright/ui-upgrade/test-results`. Do not share test credentials or persist live auth into artifacts.
5. Use the exact tracker IDs and update desktop/mobile evidence/blockers after each component. `python3 scripts/ui-upgrade.py validate` checks row coverage; it does not certify UI acceptance.
6. Continue G10 → remaining shared → P01 → P35/P36 → remaining route rows. Do not merge or deploy. Overall completion requires every applicable desktop/mobile acceptance check; 492 rows still lack full sign-off.
