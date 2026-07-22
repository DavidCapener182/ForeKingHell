# Codex production pass completion report

Completed locally on 10 July 2026 against the checkout that began at `7c8242141e3ad84c03f57ca3e40237d0848645ae`.

> **Historical report:** this document preserves the evidence from the 10 July production pass.
> The current 21 July v0.2 hardening status, including the completed rollback-only live RLS persona
> matrix, is recorded in [PUBLIC_BETA_V0.2_RELEASE.md](./PUBLIC_BETA_V0.2_RELEASE.md),
> [LIVE_DATABASE_BASELINE.md](./LIVE_DATABASE_BASELINE.md) and
> [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md). Current release decisions must use those documents
> rather than the older totals and remaining-work list below.

This report distinguishes locally verified work from production checks that still require valid credentials, live Supabase access or a physical installed iPhone PWA.

## Outcome

The verified product loop is now **Today -> latest session -> Analyse -> practice plan**. Desktop retains the existing information-dense workbench. Below 1024 px, the application uses a separate Apple-inspired platform layer with a translucent app bar, five-item tab bar, large titles, grouped surfaces, segmented controls, bottom-sheet secondary navigation, safe-area spacing and light/dark materials.

The installed `apple-design` skill was the primary mobile design authority. The requested `emil-design-eng` skill from `emilkowalski/skills` was installed and used only for interaction craft, press feedback and motion restraint. The ForeKingHell page-polish skill was not used for the mobile redesign.

## Phase closure

| Phase                       | Local status     | Closure evidence                                                                                                                                |
| --------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Verified baseline        | Complete         | Initial audit, route/config inventory and baseline commands recorded.                                                                           |
| 2. Functional correctness   | Complete locally | Theme, tenant boundaries, exports, records, offline truth, units and integrity tests added. Live RLS remains a deployment gate.                 |
| 3. Information architecture | Complete         | Five mobile tabs, grouped desktop navigation, Analyse hub and recursive route map.                                                              |
| 4. Apple mobile layer       | Complete         | Separate mobile-only theme, safe areas, native titles/sheets/materials and portrait/landscape checks.                                           |
| 5. Page hierarchy           | Complete         | Today, latest session, Shots, Bag, Coach, Progress, Handicap and secondary social hierarchy updated.                                            |
| 6. Analysis features        | Complete         | All twelve requested data/UI foundations implemented.                                                                                           |
| 7. Design system            | Complete         | Focused primitives and semantic token contract documented and tested.                                                                           |
| 8. Accessibility            | Complete locally | WCAG A/AA axe coverage, focus, reduced motion, chart alternatives and target-size checks.                                                       |
| 9. Performance              | Complete locally | Query reductions, deferred mobile chrome and final public Lighthouse evidence. Protected-route production measurement remains credential-gated. |
| 10. Final verification      | Complete locally | Full static/unit/build checks, public E2E matrix, focused local-auth browser suites, screenshots and completion documents.                      |

## Confirmed bugs fixed

- Restored one authoritative `light` / `dark` / `system` theme pipeline, including pre-paint resolution, stored preference, system changes, metadata colour and hydration-safe updates.
- Restricted personal export data to the authenticated requester's authorised rows and removed other members' private data, token hashes and operational fields.
- Centralised CSV escaping and neutralised spreadsheet-formula prefixes.
- Replaced recent-window personal-best semantics with shared all-time trusted-record eligibility and provenance.
- Bound offline queues and cached private client state to the active account; corrected over-claimed offline messaging and partial-retry status.
- Added central unit, sign, null and formatting utilities for analysis calculations and display.
- Hardened redirect targets, invitation claiming, destructive-action evidence, exact Stripe webhook routing, payment/price authority, AI/provider request limits, remote URL validation and course-import ownership.
- Added an RLS/security repair migration for the statically confirmed policy, grant and ownership gaps.
- Restored native closed-disclosure behaviour after Tailwind display utilities caused hidden `<details>` content to escape its container and sit beneath the mobile tab bar.
- Removed the stacked mobile app bar + page bar + route carousel from the primary product loop.
- Kept iPhone landscape in the mobile shell instead of switching to the desktop sidebar.

## Mobile platform files

- `src/app/mobile-apple.css`
- `src/app/layout.tsx`
- `src/components/app/app-shell.tsx`
- `src/components/app/mobile-nav.tsx`
- `src/components/app/desktop-workbench-chrome.tsx`
- `src/components/mobile-sports.tsx`
- `src/components/mobile-tab-bar.tsx`
- `src/components/premium.tsx`
- `src/components/product-polish.tsx`
- `src/components/visuals/mobile-metric-strip.tsx`
- `src/components/ui/sidebar.tsx`
- `src/hooks/use-mobile.ts`
- `src/app/today/page.tsx`
- `src/app/sessions/page.tsx`
- `src/app/analyse/page.tsx`
- `src/app/bag/page.tsx`
- `src/app/coach/page.tsx`
- `src/app/profile/page.tsx`

The wider pass currently changes 228 repository files: 141 tracked files modified and 87 new source, migration, test and documentation files. The exhaustive inventory is in [CODEX_CHANGED_FILES.md](./CODEX_CHANGED_FILES.md). The security/correctness inventory is recorded in [CODEX_SECURITY_AUDIT.md](./CODEX_SECURITY_AUDIT.md); the pre-change evidence is in [CODEX_PRODUCT_AUDIT.md](./CODEX_PRODUCT_AUDIT.md).

## Database migrations

- `drizzle/0038_restore_theme_preferences.sql` — restores the typed theme preference without destructive data changes.
- `drizzle/0039_security_boundary_repairs.sql` — repairs confirmed RLS, grant and ownership boundaries.
- `drizzle/0040_security_integrity_lockdown.sql` — locks server-maintained identity, quota, reward, competition and provenance rows and adds integrity constraints.
- `drizzle/0041_analysis_workspace.sql` — adds owner-scoped analysis annotations and immutable point-in-time snapshots.

All four migrations were applied to the active `ForeKingHell` Supabase project
`wngqphzpxhderwfjjzla` on 10 July 2026 and verified by remote history and object
readback:

- `20260710194823` — `restore_theme_preferences`
- `20260710194841` — `security_boundary_repairs`
- `20260710195053` — `security_integrity_lockdown`
- `20260710195115` — `analysis_workspace`

The first `0040` attempt rolled back transactionally because the new identity-link
trigger blocked its own quarantine update. The trigger was corrected to enforce
same-email identity links only when `NEW.status = 'active'`; the regression test
failed before the correction, passed afterwards, and the corrected migration then
applied successfully. One mismatched active link was preserved and marked
`invalid_email`.

## Analysis foundation added

- `/analyse` evidence hub and `/analyse/session-impact` reversible filtering UI.
- Confidence engine with explainable labels.
- Personal rolling baselines.
- Repeatability scoring.
- Shot-pattern classification with inferred/measured distinction.
- Practice-prescription builder.
- Trend-change detection.
- Shared robust analysis statistics and record eligibility.
- Equipment before/after analysis with all requested metric controls and observational-causation caveats.
- Session/date-range annotations, data-quality inbox and direct repair links.
- Durable point-in-time analysis snapshots containing filters, chart state, selected metrics, notes and calculated summaries.

## Tests added or updated

- Theme parsing, first-paint contract and settings behaviour.
- Personal export isolation/redaction and no-store response.
- CSV formula injection.
- Record eligibility and all-time personal-best regression.
- Unit conversion and numeric edge cases.
- Session impact, confidence, baseline, repeatability, shot classifier, prescription and trend changes.
- API protection, remote-resource safety, course-import tenant safety and Stripe webhook authority.
- Offline account isolation and PWA source behaviour.
- Auth redirect and invitation safety.
- RLS policy/source regression.
- Mobile five-tab semantics, safe clearance, overflow and iPhone landscape shell.
- Expanded route accessibility, authenticated-flow and desktop/mobile regression coverage.

## Commands and exact results

| Command or check            | Result                                                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`               | Completed; npm reported engine/advisory warnings documented in the audit.                                                                                                                                   |
| `npm run format:check`      | Pass.                                                                                                                                                                                                       |
| `npm run lint`              | Pass.                                                                                                                                                                                                       |
| `npx tsc --noEmit`          | Pass.                                                                                                                                                                                                       |
| `npm run test`              | Pass: 227 files, 846 tests.                                                                                                                                                                                 |
| `npm run build`             | Pass: Next.js 16.2.6 production build and all route generation completed.                                                                                                                                   |
| Focused accessibility suite | Pass: 20 desktop route checks, 6 mobile WCAG A/AA central-loop checks and 3 interaction checks.                                                                                                             |
| Focused app-flow suite      | Pass: 13/13.                                                                                                                                                                                                |
| Focused auth suite          | Pass: 5/5 local checks.                                                                                                                                                                                     |
| Mobile launch-monitor suite | Pass: 8/8, including 844x390 landscape.                                                                                                                                                                     |
| Requested portrait sweep    | Pass across 320x568, 375x667, 390x844, 393x852 and 430x932 on Today, Sessions, Analyse, Bag and Profile: zero horizontal overflow, five tabs, 56 px tab targets and correct app-bar clearance.              |
| Objective spacing suite     | Pass: 2/2 across all target routes plus phone, tablet, laptop and ultrawide route-family matrices.                                                                                                          |
| Mobile density suite        | Pass: 1/1 in 7.5 minutes across 89 core, secondary, desktop and real-detail captures.                                                                                                                       |
| `npm run test:e2e`          | Pass for configured public coverage: 96 passed, 1,392 authenticated tests explicitly skipped, 0 failed in 6.3 minutes. Focused localhost-auth suites are not represented as live Supabase persona evidence. |
| `npm run test:lighthouse`   | Pass: 18 reports written. `/login` is valid public evidence; all 17 protected route reports resolved to `/login` and are explicitly excluded from authenticated performance claims.                         |
| `npm audit --omit=dev`      | Non-zero: two moderate transitive PostCSS advisories under Next. The proposed `--force` remediation would install Next 9.3.3, so no breaking downgrade was applied.                                         |

## Performance evidence

- Public `/login` final Lighthouse: performance 85, accessibility 100, best practices 100, FCP 1.364 seconds, LCP 4.243 seconds, TBT 21 ms, CLS 0, 587,292 transferred bytes and 74,427 bytes of unused JavaScript.
- Against the initial public baseline, performance improved 83 -> 85, LCP improved 4.672 -> 4.243 seconds (429 ms), and unused JavaScript fell 97,175 -> 74,427 bytes (22,748 bytes). Transfer weight increased 582,364 -> 587,292 bytes (4,928 bytes), so no blanket bundle-size reduction is claimed.
- The `/rounds/new` request path measured roughly 70 seconds before its query refactor and 1.7-2.3 seconds in the local post-change checks.
- Protected-route Lighthouse reports are not valid before/after evidence because the exact command has no authenticated cookie and every protected report redirects to `/login`.

## Screenshots

- [Today mobile](../output/codex-product-audit/today-mobile.png)
- [Latest session mobile](../output/codex-product-audit/latest-session-mobile.png)
- [Analyse mobile](../output/codex-product-audit/analyse-mobile.png)
- [Bag mobile](../output/codex-product-audit/bag-mobile.png)
- [Coach mobile](../output/codex-product-audit/coach-mobile.png)
- [Desktop dashboard](../output/codex-product-audit/desktop-dashboard.png)
- [Dark mode](../output/codex-product-audit/dark-mode.png)
- [Empty state](../output/codex-product-audit/empty-state.png)
- [Error state](../output/codex-product-audit/error-state.png)

## Route map

Every existing feature and its new navigation location is recorded in [ROUTE_MAP.md](./ROUTE_MAP.md).

## Remaining limitations and ranked backlog

### P0

- Verify owner, coach/viewer/editor, stranger, revoked collaborator, removed member and anonymous personas against live RLS using real test accounts.
- Refresh `PLAYWRIGHT_AUTH_STATE` and run the complete authenticated E2E and Lighthouse commands against the intended preview/production deployment.
- Validate Rapsodo, OpenAI, Google and Stripe with configured production credentials and real provider responses.
- Add a durable Stripe event ledger and make AI credit decrement atomic.

### P1

- Stream or chunk very large personal exports.
- Add server row versions, idempotency keys and explicit multi-client conflict handling for offline edits.
- Complete physical iPhone standalone, status-bar, service-worker update and reduced-transparency testing.
- Move CLI-only dependencies out of the production dependency tree after a separately verified upgrade pass.
- Upgrade the Next/PostCSS dependency path when a non-breaking patched Next release is available; do not use npm's current forced downgrade to Next 9.3.3.
- Enable Supabase leaked-password protection and schedule the available managed Postgres security update through the project dashboard.

### P2

- Continue the grouped-list/segmented-control treatment through lower-priority social, course, tournament, billing and admin pages.
- Extract the largest Today, Bag, Dashboard, Practice and Progress modules into focused server/data/view sections.
- Add authenticated protected-route performance budgets and bundle reports.
- Resolve the remaining above-fold image-priority advisories for `hole-350-aerial.jpg`, `strokes-leak-tee-v3.png` and `page-achievements.png` after confirming which variants are genuinely the LCP element.

### P3

- More advanced change-point detection, environmental normalisation and measured-versus-estimated trajectory coverage.
- Longitudinal snapshot comparison and richer annotation overlays after the live workspace migration is deployed.
