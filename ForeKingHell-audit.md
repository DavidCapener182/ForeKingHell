# ForeKingHell / LM World Tour — whole-site audit

Audit window: 6–7 September 2026 (UTC).

This is an audit and implementation handoff, not a deployed redesign. The repository snapshot contains 98 page.tsx route entries: 92 rendering/guarded entries and six redirect-only entries. The pack contains 478 route-specific functional components plus 14 shared components, each with separate desktop and mobile prompts (984 viewport-specific prompts). A functional component means a user-facing section, form, table, chart, drawer or control group; its child labels/inputs/buttons are included in that prompt. Shared primitives and route boundaries are explicitly covered by G01–G14 and inherited in the route matrix.

Evidence: authenticated live inspection of the available account; 84 route patterns have a captured live/guarded/wide-runtime state, and 85 application screenshot states are retained in the evidence archive. The route-import inventory reaches 422 JSX modules; shell, CSS, capability and error-boundary source was also reviewed. The browser viewport was 1363×936. Most captures show the initial visible state rather than every scroll position or tab. The full Progress capture and selected detail pages were also inspected.

Mobile scope: companion/workbench source branches, route capabilities and the actual surface switch were reviewed. A blank wide companion view was reproduced and traced to display:none on an lg:hidden ancestor. The available browser did not expose viewport/device resizing, so no narrow-screen iPhone/Android visual pass is claimed. The prompts explicitly require 390×844, 360×800 and breakpoint verification. Physical Safari/PWA installation, offline network replay, performance benchmarks and a complete assistive-technology pass remain implementation QA tasks.

No production code was changed or deployed. No new upload, social message/invitation, shared report/link, payment, entitlement, deletion or account reset was submitted. Token-specific sharing/invitation success paths and mutation outcomes were source-reviewed and must be exercised with authorised fixtures. Guarded /import/result without an identifier is not counted as a broken successful import.

The checked-out source is main at cf9de4018e0273a7f86a0ae69791af4ff414d29c. The deployed build SHA was not independently established, so source findings and live findings are labelled separately. Current branding in the repository/site is LM World Tour; ForeKingHell is the repository/account identity. No rename is proposed.

## Confirmed findings and recommendations

### F01 · P1 · Progress ignores the supplied comparison scope

**/progress — Confirmed in source + supplied live URL.** The current page does not read searchParams for compareClub or compareMeasure. The supplied link cannot reliably select the requested comparison. Add validated URL-driven club/measure/period controls and preserve them through tabs and surface changes.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/app/%28app%29/progress/page.tsx) · Screenshot in evidence archive: `02-progress-desktop.jpg`.

### F02 · P1 · Progress presents a reconstructed baseline as history

**/progress — Confirmed in source; visible presentation captured.** PerformanceStory derives a baseline from the current composite score minus momentum rather than a dated historical observation. Present genuine comparable history or a current snapshot with a baseline-needed state. The score also includes sample depth, so its movement must not be described as pure golf improvement.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/app/%28app%29/progress/page.tsx) · Screenshot in evidence archive: `02-progress-desktop.jpg`.

### F03 · P1 · Progress recommendations do not use one consistent blocker

**/progress — Confirmed in live screenshot + source selectors.** The captured headline points to GW while the first practice panel points to 5W. Headline rankings and practice-plan selection use different sources; reconcile the primary blocker and distinguish practice priority from a measured weekly decline. Normalise negative zero and describe equal scores as steady.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/app/%28app%29/progress/page.tsx) · Screenshot in evidence archive: `02-progress-desktop.jpg`.

### F04 · P1 · Many mobile tasks are explicitly gated to desktop

**Multiple routes — Confirmed in source.** Analysis, comparisons, equipment, providers, billing, social management, course detail/editor and administration are among routes explicitly marked desktop-only. Mobile completion requires real task surfaces and careful capability migration, not simply smaller cards.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/lib/app-route-capabilities.ts).

### F05 · P1 · Opening the companion on desktop produces a blank main area

**/today after Open companion app — Reproduced live at 1363 × 936 + computed DOM style.** The account menu successfully selects the companion surface, but the Today content ancestor has lg:hidden and computed display:none at the available wide viewport. Fix the mismatch between server surface preference and viewport rendering. This is a wide companion-mode defect, not an iPhone screenshot.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/components/app/private-app-shell.tsx) · Screenshot in evidence archive: `m01-today-companion.jpg`.

### F06 · P1 · Import source-card descriptions collapse into narrow columns

**/import — Confirmed in live screenshot.** The three source cards squeeze text into near one-letter-wide columns because fixed icon/badge layout consumes the content width. Use responsive selectable cards with a full-width description and appropriate min-width/grid constraints.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/app/%28app%29/import/import-workbench-page.tsx) · Screenshot in evidence archive: `26-import-desktop.jpg`.

### F07 · P2 · Oversized app heroes and inconsistent typography compete with tasks

**Today, Dashboard, Bag, session/competition pages — Live visual audit + repository design rules.** Several operational screens use large dark heroes, mixed serif/condensed/sans headings and repeated page/section titles. Reconcile shared tokens and hierarchy first, retaining full-width analytical layouts and golf identity. This is a usability/design finding, not a measured conversion result.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/app/globals.css) · Screenshot in evidence archive: `03-today-desktop.jpg`.

### F08 · P2 · Install prompt overlays operational content

**Shared app chrome — Confirmed across captured first-load views.** A bottom-right install prompt overlaps lower workspace content in many captured tabs. Make the prompt contextual, persist dismissal according to a defined policy and preserve active work during updates. The audit did not measure normal-session prompt frequency.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/components/pwa-register.tsx) · Screenshot in evidence archive: `26-import-desktop.jpg`.

### F09 · P2 · Large achievement counts break small metric layouts

**/achievements — Confirmed in live screenshot.** Large earned/available values wrap awkwardly in fixed compact cards. Use flexible numeric rows or compact notation with exact accessible detail, and avoid fixed heights.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/app/achievements/achievements-client.tsx) · Screenshot in evidence archive: `37-achievements-desktop.jpg`.

### F10 · P2 · Tournament completion visual conflicts with submitted-round count

**/tournaments/[tournamentId] — Confirmed in live DOM/screenshot.** The captured not-entered event shows zero of one round submitted while its stepper looks half complete. Active/next-step emphasis should be separate from completed-round percentage.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/app/%28app%29/tournaments/%5BtournamentId%5D/page.tsx) · Screenshot in evidence archive: `69-detail-1-desktop.jpg`.

### F11 · P2 · Privacy and unavailable-service copy exposes implementation instructions

**/privacy and some unavailable-service states — Confirmed in live copy + source.** Environment variable names and a public-launch infrastructure checklist appear in ordinary product copy. Replace them with accurate user-facing descriptions of data and recovery actions; keep operator diagnostics restricted. This is a content audit, not a legal compliance certification.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/src/app/privacy/page.tsx) · Screenshot in evidence archive: `75-detail-7-desktop.jpg`.

### F12 · P2 · Untitled UI needs an intentional integration layer

**Shared UI — Source compatibility review.** The app currently uses Radix/shadcn with Next 16.3, React 19, Tailwind 4 and Recharts. Untitled UI uses React Aria conventions. Blindly replacing primitives risks form, selection, focus and server-action regressions. Use namespaced adapters and verify current component exports/licensing.

[Source](https://github.com/DavidCapener182/ForeKingHell/blob/cf9de4018e0273a7f86a0ae69791af4ff414d29c/package.json).

## Flow health

| Flow                                      | Assessment                                                          | Evidence and next work                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in → first import                    | Needs repair                                                        | Import source-card readability is visibly broken. Authentication worked in this account; upload/save and first-user completion were not submitted.                    |
| Today → session → shot review             | Useful foundation; hierarchy needs work                             | Real evidence, reversible exclusions and specialist plots should be retained. Oversized/repeated headings and development panels compete with the task.               |
| Progress → compare → practice             | Needs repair                                                        | URL comparison scope, baseline presentation and blocker consistency require correction before visual polish.                                                          |
| Bag → club → equipment                    | Rich capability; simplify controls                                  | Keep true dispersion, carry ranges, benchmark provenance and the repository ban on Attack/Launch benchmark comparisons. Mobile equipment tasks are gated.             |
| Practice → measured result → speed/load   | Strong domain structure; verify state transitions                   | Preserve guidance-versus-measurement and no-ball-versus-with-ball distinctions. Draft, import matching and offline completion require fixture-based execution checks. |
| Course setup → strategy → live round/twin | Specialist UI worth preserving                                      | Wrap maps and 3D with accessible controls; several course administration screens lack a full mobile task.                                                             |
| Challenges → tournaments → records        | Needs consistency work                                              | Preserve qualifying evidence and verification. Tournament stepper completion conflicts with its round count in the captured state.                                    |
| Friends → groups → profile/sharing        | Desktop task surfaces present; mobile incomplete                    | Many social-management routes are explicitly desktop-only. No live invitations, posts or new public shares were sent.                                                 |
| Settings → billing → administration       | Broad surface coverage; protect exact actions                       | Forms, role scope and confirmations need deliberate adapters. No payment, entitlement change, account reset or deletion was performed.                                |
| Offline and surface switching             | Confirmed surface-switch defect; offline runtime needs execution QA | Wide companion mode hides Today main content. Offline page and source were reviewed; this was not a physical-device, offline-network or conflict-replay test.         |

## What to preserve

- Real golf-specific dispersion, course maps, Three.js runtimes and scorecards.
- Source provenance, sample confidence, reversible shot review and clear measured/estimated distinctions.
- Existing role checks, owner scoping, typed destructive confirmations and offline queue safeguards.
- Full-width analytical layouts and the repository’s deep-green/neutral visual identity.

## Untitled UI fit and licensing

Untitled UI is the requested reference. Official pages inspected include the component catalogue, installation, sidebar navigations, tables, metrics, filters, tabs, charts, drawers, file uploaders, radio groups, select, date pickers and command menus. Other family links come from its official catalogue. FREE is explicitly shown on the inspected base tables, tabs, select, date pickers, file uploaders, sidebar navigation and line/bar-chart pages. Several advanced layouts show “Get the code”; access and licensing must be checked at implementation time. Named variants in this pack are documented examples, not invented npm exports. A domain-specific golf table, map toolbar, bottom sheet or profile layout is a custom composition of those components; it is not claimed to be a prebuilt Untitled UI golf module.

| Existing need | Recommended reference                                                                                                              | Application                                                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav           | [Sidebar navigations — Sections subheadings](https://www.untitledui.com/react/components/sidebar-navigations)                      | Keep navigation groups collapsible, active ancestry visible and the account controls reachable without burying the destination.                                                    |
| Header        | [Page headers + Section headers](https://www.untitledui.com/react/components/page-headers)                                         | Use one compact page title, a concise description and a right-aligned primary action; let secondary actions wrap below. Preserve the full-width work area.                         |
| Tabs          | [Tabs — Underline](https://www.untitledui.com/react/components/tabs)                                                               | Use controlled Underline tabs with real panels, visible selected state and URL persistence where the screen already supports shareable views.                                      |
| Filters       | [Filter bars — Dropdowns and date picker; Drawers — Filters menu](https://www.untitledui.com/react/components/filter-bars)         | Place the highest-value filters in a compact toolbar; show active filter chips, result count and Clear all.                                                                        |
| Table         | [Tables + Paginations](https://www.untitledui.com/react/components/tables)                                                         | Use an accessible table with aligned numeric columns, units in headers, semantic sorting, row actions and existing server pagination. Constrain horizontal scrolling to the table. |
| Metrics       | [Metrics — Simple actions](https://www.untitledui.com/react/components/metrics)                                                    | Use a restrained connected metric strip; show value, unit, time window, sample size and evidence link where available.                                                             |
| Chart         | [Line & bar charts — Line chart 01 / Bar chart 01](https://www.untitledui.com/react/components/line-bar-charts)                    | Reuse the existing calculation and Recharts data; restyle axes, grid, legend and tooltip to match the shared tokens and include a tabular alternative.                             |
| Map           | [Section headers + Select + Tooltips around the existing golf visual](https://www.untitledui.com/react/components/section-headers) | Preserve the existing map, SVG, dispersion or Three.js renderer and coordinate model. Apply Untitled UI to the toolbar, legend and detail panel only.                              |
| Radio         | [Radio groups — Icon card](https://www.untitledui.com/react/components/radio-groups)                                               | Use selectable cards with icon, title, badge and full-width description laid out independently; the whole card selects its labelled radio.                                         |
| Upload        | [File uploaders — Progress bar](https://www.untitledui.com/react/components/file-uploaders)                                        | Support click-to-choose and drag-and-drop, show type/size guidance, per-file progress, errors and removal before submission.                                                       |
| Form          | [Inputs + Select + Textarea + Buttons](https://www.untitledui.com/react/components/inputs)                                         | Group labelled fields by task, show inline validation and a clear save/cancel footer, and preserve the existing server action and permission checks.                               |
| Drawer        | [Drawers + Section footers](https://www.untitledui.com/react/components/drawers)                                                   | Use a side drawer with a labelled heading, scrollable body and stable action footer; restore focus on close.                                                                       |
| Chat          | [Messaging + Drawers](https://www.untitledui.com/react/components/messaging)                                                       | Use a conversation pane and evidence side panel with a stable composer, pending/error states and keyboard access.                                                                  |
| Steps         | [Progress steps + Progress indicators](https://www.untitledui.com/react/components/progress-steps)                                 | Show completed, active, pending and failed steps separately, using the current operation rather than historical account totals.                                                    |
| Empty         | [Empty states + Loading indicators + Alerts](https://www.untitledui.com/react/components/empty-states)                             | Distinguish loading, no data, no filter matches, permission denial and service failure; offer the specific recovery action for each.                                               |

## Implementation order and completion rules

1. Start with the audit findings and the master contract. Implement G01, G05, G06 and G10 first, then the remaining shared components.
2. Fix the P1 Progress and Import components, then work through one complete route at a time. Implement both viewport prompts for every component on that route.
3. Copy a whole page pack or an individual component from the searchable HTML. “Include master contract” is enabled by default, so pasted instructions retain the non-negotiable constraints.
4. Use the CSV tracker to record desktop/mobile implementation and evidence separately. A page is complete only when its own components, applicable shared components, state boundaries and destination/redirect checks pass.
5. Treat proposed improvements as implementation specifications, not as proof that every current control is broken. Keep real golf renderers and business logic; change the surrounding UI and fix the specific confirmed defects.
6. Do not bulk-paste all 984 prompts into one coding turn. Complete a route-sized batch, review its screenshots and changed files, then continue with the next route. Record blocked IDs explicitly rather than silently skipping them.

## Source and reference links

- [Repository snapshot](https://github.com/DavidCapener182/ForeKingHell/tree/cf9de4018e0273a7f86a0ae69791af4ff414d29c)
- [Supplied Progress URL](https://forekinghell.vercel.app/progress?compareClub=745445c4-d305-47f0-95a0-f0d02f77421b&compareMeasure=carry)
- [Untitled UI React catalogue](https://www.untitledui.com/react/components)
- [Untitled UI installation](https://www.untitledui.com/react/docs/installation)

## Complete route coverage

| Page ID | Route                                     | Functional components | Live/source evidence                                                    | Current mobile scope                                                            |
| ------- | ----------------------------------------- | --------------------: | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P01     | `/progress`                               |                    10 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P02     | `/today`                                  |                     9 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P03     | `/dashboard`                              |                     7 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P04     | `/sessions`                               |                     5 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P05     | `/sessions/[sessionId]`                   |                     7 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P06     | `/shots`                                  |                     5 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P07     | `/shots/review`                           |                     3 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P08     | `/bag`                                    |                    16 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P09     | `/bag/[clubId]`                           |                     6 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P10     | `/bag/[clubId]/analytics`                 |                     9 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P11     | `/bag/longest`                            |                     3 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P12     | `/quick-bag`                              |                     4 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P13     | `/equipment`                              |                     9 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P14     | `/equipment/experiments`                  |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P15     | `/practice`                               |                     8 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P16     | `/practice/quick-range`                   |                     3 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P17     | `/coach`                                  |                     6 | Live state captured + source reviewed                                   | Summary capability: verify and implement full specified tasks                   |
| P18     | `/coach/diagnosis`                        |                     3 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P19     | `/coach/reports`                          |                     3 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P20     | `/coach/workspace`                        |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P21     | `/data-chat`                              |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P22     | `/analyse`                                |                     5 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P23     | `/analyse/compare`                        |                     5 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P24     | `/analyse/conditions`                     |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P25     | `/analyse/session-impact`                 |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P26     | `/analyse/workspace`                      |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P27     | `/compare`                                |                     6 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P28     | `/strokes-gained`                         |                     7 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P29     | `/simulator-lab`                          |                     9 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P30     | `/speed`                                  |                     9 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P31     | `/speed/sessions/[sessionId]`             |                     6 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P32     | `/stats/training-over-time`               |                     6 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P33     | `/goals`                                  |                     6 | Live state captured + source reviewed                                   | Summary capability: verify and implement full specified tasks                   |
| P34     | `/handicap`                               |                     5 | Live state captured + source reviewed                                   | Summary capability: verify and implement full specified tasks                   |
| P35     | `/import`                                 |                    10 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P36     | `/import/result`                          |                     4 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P37     | `/rapsodo`                                |                     4 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P38     | `/providers`                              |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P39     | `/companion-runtime/import`               |                     2 | Runtime DOM/source reviewed; captured wide state is hidden or guarded   | Dedicated companion route; wide content hidden in captured runtime views        |
| P40     | `/companion-runtime/import/csv`           |                     3 | Runtime DOM/source reviewed; captured wide state is hidden or guarded   | Dedicated companion route; wide content hidden in captured runtime views        |
| P41     | `/companion-runtime/import/result`        |                     2 | Runtime DOM/source reviewed; captured wide state is hidden or guarded   | Dedicated companion route; wide content hidden in captured runtime views        |
| P42     | `/companion-runtime/rapsodo`              |                     3 | Runtime DOM/source reviewed; captured wide state is hidden or guarded   | Dedicated companion route; wide content hidden in captured runtime views        |
| P43     | `/rounds`                                 |                     4 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P44     | `/rounds/new`                             |                     3 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P45     | `/rounds/[sessionId]`                     |                     9 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P46     | `/courses`                                |                     3 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P47     | `/courses/new`                            |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P48     | `/courses/[courseId]`                     |                     5 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P49     | `/courses/[courseId]/holes`               |                     7 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P50     | `/courses/[courseId]/shot-pattern`        |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P51     | `/courses/strategy`                       |                     5 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P52     | `/course-twins`                           |                     2 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P53     | `/play`                                   |                     5 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P54     | `/play/[courseId]`                        |                     4 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P55     | `/course-records`                         |                     3 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P56     | `/courses/[courseId]/records`             |                     3 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P57     | `/course-records/[recordId]`              |                     5 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P58     | `/challenges`                             |                     6 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P59     | `/challenges/[challengeId]`               |                     7 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P60     | `/tournaments`                            |                     3 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P61     | `/tournaments/[tournamentId]`             |                     8 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P62     | `/leaderboard`                            |                     5 | Live state captured + source reviewed                                   | Summary capability: verify and implement full specified tasks                   |
| P63     | `/achievements`                           |                     6 | Live state captured + source reviewed                                   | Summary capability: verify and implement full specified tasks                   |
| P64     | `/friends`                                |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P65     | `/groups`                                 |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P66     | `/groups/[groupSlug]`                     |                     6 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P67     | `/feed`                                   |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P68     | `/social-intelligence`                    |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P69     | `/profile`                                |                     9 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P70     | `/profile/[username]`                     |                     4 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P71     | `/settings`                               |                    14 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P72     | `/settings/notifications`                 |                     3 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P73     | `/settings/invitations/[token]`           |                     2 | Source reviewed; token/special state not exercised live                 | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P74     | `/shared/[userId]`                        |                     3 | Source reviewed; token/special state not exercised live                 | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P75     | `/billing`                                |                     6 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P76     | `/admin`                                  |                     5 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P77     | `/admin/users`                            |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P78     | `/admin/moderation`                       |                     5 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P79     | `/admin/billing`                          |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P80     | `/admin/challenges`                       |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P81     | `/admin/system-checks`                    |                     4 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P82     | `/partners`                               |                     5 | Live state captured + source reviewed                                   | Explicit desktop-only capability: mobile task must be implemented               |
| P83     | `/`                                       |                    13 | Live state captured + source reviewed                                   | Public responsive/source branch reviewed                                        |
| P84     | `/login`                                  |                     4 | Live authentication exercised + source reviewed; no retained screenshot | Public responsive/source branch reviewed                                        |
| P85     | `/welcome`                                |                     3 | Live state captured + source reviewed                                   | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P86     | `/privacy`                                |                     3 | Live state captured + source reviewed                                   | Public responsive/source branch reviewed                                        |
| P87     | `/offline`                                |                     5 | Live state captured + source reviewed                                   | Offline companion source reviewed; network/device execution not tested          |
| P88     | `/share/[token]`                          |                     3 | Source reviewed; token/special state not exercised live                 | Public responsive/source branch reviewed                                        |
| P89     | `/share/course-twin/[token]`              |                     3 | Source reviewed; token/special state not exercised live                 | Public responsive/source branch reviewed                                        |
| P90     | `/share/report/[token]`                   |                     3 | Source reviewed; token/special state not exercised live                 | Public responsive/source branch reviewed                                        |
| P91     | `/companion/handoff`                      |                     2 | Source reviewed; token/special state not exercised live                 | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P92     | `/companion/summary`                      |                     2 | Source reviewed; token/special state not exercised live                 | Companion/summary branch source reviewed; narrow viewport visual QA outstanding |
| P93     | `/courses/[courseId]/records/[recordId]`  |                     1 | Redirect contract source-reviewed                                       | Redirect; verify the destination mobile task                                    |
| P94     | `/courses/[courseId]/tournaments`         |                     1 | Redirect contract source-reviewed                                       | Redirect; verify the destination mobile task                                    |
| P95     | `/tournaments/[tournamentId]/leaderboard` |                     1 | Redirect contract source-reviewed                                       | Redirect; verify the destination mobile task                                    |
| P96     | `/tournaments/[tournamentId]/rounds`      |                     1 | Redirect contract source-reviewed                                       | Redirect; verify the destination mobile task                                    |
| P97     | `/tournaments/[tournamentId]/rules`       |                     1 | Redirect contract source-reviewed                                       | Redirect; verify the destination mobile task                                    |
| P98     | `/tournaments/[tournamentId]/submit`      |                     1 | Redirect contract source-reviewed                                       | Redirect; verify the destination mobile task                                    |
