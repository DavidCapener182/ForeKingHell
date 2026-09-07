**The biggest improvement would be turning the app’s substantial functionality into one clear golf-improvement journey.** Each page should explain what happened, why it matters, and what to do next.

I reviewed the local checkout linked to your GitHub repository: its **98 page routes**, navigation, shared UI, core workflow code, design documentation and test coverage. I also inspected populated mobile Today and Practice screens. This wasn’t a complete runtime audit: desktop browser inspection timed out, and GitHub authentication prevented checking remote parity. I made no repository changes.

The strongest opportunities are:

- **More useful headlines.** Today shows “Mixed session” despite having specific club improvements and confidence issues available.
- **Clearer activity states.** Practice displays “Recommended for you” above an edited plan with a “Resume Range Mode” action.
- **Better page boundaries.** Today/Dashboard, Analyse/Performance Lab, Coach/Data Chat and Bag/Quick Bag need distinct purposes and stronger handoffs.
- **One visual identity.** The active brand is LM World Tour, while some mobile controls still say ForeKingHell. Several styling layers also need consolidation.
- **Contextual evidence.** The new Driver Development component should support each page’s main task; repeating the full card across pages risks overwhelming it.
- **Broader verification.** The principal visual regression matrix covers six routes. Several major page files contain thousands of lines, which also makes consistent improvements harder.

Paste this complete prompt into Codex:

Create and pursue a goal to redesign and improve the complete desktop and mobile experience of my ForeKingHell repository.

Repository: https://github.com/DavidCapener182/ForeKingHell
Local workspace: /Users/davidcapener/Cursor Apps/ForeKingHell

The application currently uses LM World Tour as its active brand. Verify the current brand configuration before changing customer-facing wording.

I want a substantial product and design overhaul across the entire application. Review the workflows, information architecture, UI, visual design, interactions, reliability and useful feature opportunities. Then implement and verify the improvements.

“100 times better” describes the ambition. Demonstrate the improvement through clearer workflows, stronger visual hierarchy, fewer unnecessary steps, consistent behaviour, better accessibility, faster loading and complete route coverage.

**1. Establish the current baseline**

Read AGENTS.md and follow its instructions. Read the relevant installed Next.js documentation before writing framework code.

Inspect the current branch, working tree, route inventory, shared components, navigation metadata, surface routing, domain services, schema, tests and release scripts.

There were 98 page routes during the preparatory review. Regenerate the inventory; do not assume that count remains current.

The working tree already contains extensive session-confidence and Driver Development changes, plus a nightly workflow change. Identify and preserve existing work. Understand its intent before editing nearby code. Do not reset, overwrite, stash away or silently discard it.

Use current source and browser evidence as the authority. Existing audit and completion documents are useful context, but their previous pass statements are not proof of the current implementation.

Create a route coverage ledger containing:

- Route and meaningful subroutes, tabs or modes.
- Intended user and primary job.
- Desktop experience.
- Mobile experience.
- Entry points and next actions.
- Data dependencies and permissions.
- Existing problems and proposed improvements.
- Implementation status.
- Functional and visual verification evidence.
- Any specific blocker.

Include public, authenticated, shared, account, operational and administrative pages. Include dynamic detail routes, empty states and recovery screens. Resolve aliases and internal companion routes correctly rather than treating them as unrelated products.

**2. Define one coherent product journey**

The core journey is:

Import or record golf → understand the result → identify the priority → practise or prepare → collect evidence → review improvement.

Every major page should answer:

- What am I looking at?
- What is the most useful thing to know?
- How trustworthy and current is the evidence?
- What should I do next?

Define clear ownership between overlapping areas:

- Today: the golfer’s current situation, latest result and next action.
- Dashboard: the broader desktop overview and longer-term priorities.
- Sessions: the history and review of actual activities.
- Analyse: investigation of a specific question using evidence.
- Performance Lab: deeper assessment of launch-monitor performance.
- Coach: prioritised interpretation and an actionable prescription.
- Data Chat: questions about the selected evidence.
- Practice: planning, performing and reviewing practice.
- Progress: whether comparable evidence shows improvement.
- Bag: trusted club numbers, gaps and supporting evidence.
- Quick Bag: a fast club or target-distance decision.
- Play: preparation, starting/resuming a round and course context.

Reuse existing functionality. Weekly reviews, saved views, practice recovery, confidence handling and several other capabilities already exist. Improve and connect them before introducing another implementation.

Preserve useful deep links, filters, selected entities and history behaviour when reorganising navigation.

**3. Establish and implement the visual direction**

Create a recognisable premium golf identity: precise performance graphics, confident typography, restrained golf imagery and calm, purposeful layouts.

Use a coherent palette based on the existing identity: deep golf greens, neutral surfaces, clear text and limited accent colours. Make light, dark and existing supported themes feel intentionally designed.

Implement shared decisions for typography, spacing, radii, borders, elevation, buttons, form controls, tables, charts, navigation and motion.

Desktop should feel like a polished analytical workspace. Mobile should feel like a focused companion designed for use at the range and on the course.

Use different compositions for the two surfaces while sharing the same evidence and business rules.

App content must fill the available content window. Honour the repository’s full-width layout contract. Do not introduce capped widths on PageShell or dashboard-style wrappers.

Establish a clear hierarchy:

- One dominant answer or task.
- A small supporting metric group.
- Evidence and detail revealed at the appropriate depth.
- A clear next action.

Use rows, charts, comparison panels, timelines, lists and open sections where they communicate better than another card.

Make imagery purposeful. On mobile task screens, the golfer should reach the task and primary action without scrolling past a large decorative image. Preserve accurate product visuals and avoid fabricated results, testimonials or provider capabilities.

Inspect existing motion primitives before adding animation. Use restrained transitions for navigation, selection, expansion and feedback. Respect reduced motion and avoid distracting movement during practice or live rounds.

Build the first complete desktop/mobile examples early, inspect them visually, refine the shared system, then apply it throughout the app.

**4. Improve desktop navigation and workspace behaviour**

Review the current sidebar groups and reduce the effort required to find a task.

Keep primary destinations immediately understandable. Put specialist analysis and operational tools in sensible contextual groups.

Improve breadcrumbs, selected states, page titles and the relationship between sidebar navigation, tabs and command search.

Retain useful existing capabilities such as saved views, pinned items, recent items, table density, column controls, exports and keyboard shortcuts.

Make secondary AI panels available when useful. Avoid permanently reducing the main content area on every page.

Use side-by-side comparison and master-detail layouts where they reduce navigation. Ensure panels remain readable at laptop widths and adapt properly on larger displays.

Filters, sorting, selected records and tabs should survive appropriate navigation and browser Back/Forward operations.

**5. Improve the mobile shell and navigation**

The current primary mobile tabs are Today, Practice, Play, Progress and Bag. Preserve this established structure unless the current implementation provides a strong, documented reason for a change.

Keep Sessions, Import, Shots and other useful tools easy to discover through contextual actions and the profile/tools navigation.

Improve navigation labels, active states, back behaviour, saved scroll position, sheet presentation and keyboard interaction.

Audit both the selected application surface and viewport size. Resizing, rotating, opening deep links and explicitly choosing the full site must not produce blank content or contradictory navigation.

Preserve an explicit workbench preference. Verify mobile capability rules and navigation metadata together.

Where a full analytical task remains desktop-oriented, provide a useful mobile summary and a clear continuation path. Preserve the selected object and context during that handoff.

Use reachable primary controls, safe-area-aware navigation, readable text and comfortable touch targets. Keep the keyboard, bottom tabs and sticky actions from covering content.

**6. Redesign Today and Dashboard**

Today should adapt clearly to these states:

- New golfer with no imported evidence.
- Returning golfer with stale evidence.
- Practice ready to start.
- Practice or round in progress.
- Completed activity awaiting measured evidence.
- Newly imported practice ready to review.
- Import or sync requiring attention.

Choose the primary action from the actual state.

Replace broad headlines such as “Mixed session” with concise, supported takeaways when the evidence allows. Explain a useful change, an uncertainty or the next priority.

Make completed practice reviews easy to reach. Avoid placing a large secondary analysis block between the main review action and the review itself.

Integrate Driver Development according to context: a compact relevant signal on Today, deeper evidence in Speed or analysis, and a practice implication in Practice.

Keep broader recommendations available without competing with the current activity.

Dashboard should provide a clear overview of current performance, meaningful changes, priorities and recent activity. Retain useful customisation while giving the default layout a strong editorial hierarchy.

**7. Improve onboarding, import and provider workflows**

Review landing → sign-in → welcome → source selection → import → club matching → first result → first practice.

Make onboarding resumable and based on actual completion. Do not describe a step as completed merely because related data exists if the wording implies the user performed a different action.

Make supported sources and connection status accurate. Clearly distinguish available integrations from beta, unavailable and unconfigured capabilities.

Improve the import experience with:

- Clear source selection.
- File preview and understandable column mapping.
- Club matching and unit confirmation.
- Duplicate detection.
- Validation that preserves user input.
- Clear progress and recoverable failures.
- An explicit result summary.
- Direct navigation to the imported session and any linked practice plan.

Preserve session and practice-plan identity through every handoff.

A retry must not create duplicate sessions, shots, awards or practice results.

Keep technical configuration errors in appropriate operational views. Give golfers useful recovery instructions.

**8. Redesign Sessions, session detail, Shots and shot review**

Make history easy to scan by date, activity type, source, club, result and evidence status.

Distinguish measured range sessions, manually recorded activities, speed sessions and rounds.

Session detail should lead with:

- What happened.
- What changed against a valid comparison.
- What remains uncertain.
- Whether the practice objective was achieved.
- The next useful action.

Desktop should support efficient evidence inspection, selection and comparison. Mobile should offer a concise review with focused charts and expandable detail.

Make shot filters, selection, raw evidence, calculated values and review actions understandable.

Preserve filter context when opening a shot and returning to the list.

Explain exactly what an exclusion or directional-confidence change affects. Keep raw source evidence inspectable and review actions reversible where supported.

Review the full path from a flagged reading to correction, refreshed analytics and visible confirmation.

**9. Improve Analyse, comparisons and Performance Lab**

Cover Analyse, its comparison/conditions/session-impact/workspace pages, Compare and Simulator Performance Lab.

Organise these experiences around questions golfers recognise: consistency, carry changes, dispersion, conditions, equipment effects and scoring limitations.

Make comparison populations explicit. Show dates, sources, club identity, sample sizes, filters and confidence without overwhelming the main result.

Use aligned axes, meaningful reference bands and readable difference views.

Keep important evidence reachable from the headline. A claim about a club should open the relevant club or shot context.

Preserve advanced desktop tables and exports. Add focused mobile summaries or compact comparisons where practical.

Do not imply that changes are statistically significant, causal or technically optimal unless the method supports that claim.

**10. Improve Coach, Data Chat and coach workspaces**

Give Coach a clear structure: observation, significance, confidence and next action.

Make each recommendation actionable through the existing Practice flow, with club, intent and source context preserved.

Avoid duplicating several competing AI summaries on the same screen.

Data Chat should explain the selected evidence and expose its scope, source and limitations. Retain understandable behaviour when the AI service is unavailable.

Improve diagnosis, assigned-player workspaces and reports, including player switching, notes, report creation, preview and access controls.

Keep private coach notes, shared reports and player-visible recommendations clearly differentiated.

**11. Redesign Practice, Range Mode and Quick Range**

Practice must distinguish a new recommendation, a saved plan, an active edited plan, a paused activity, a completed activity and a measured result.

Fix misleading combinations such as “Recommended for you” above an already-started plan with a Resume action.

Present the objective, duration, ball count, focus clubs and success measure clearly.

Make quick adjustments predictable. Failed regeneration must preserve the previous plan and user edits.

On desktop, support efficient plan inspection and editing. On mobile, prioritise starting/resuming and the next drill.

Range Mode should provide large instructions, progress, counters, notes and safe pause/finish controls.

Verify recovery after navigation, refresh, connectivity loss and backgrounding.

Distinguish completing the physical activity from proving the desired performance improvement.

Complete the loop from finishing practice to importing evidence, confirming its match, reviewing Plan versus Actual and selecting the next session.

**12. Improve Bag, club detail, Quick Bag and equipment**

Cover Bag, individual club pages, club analytics, longest shots, Quick Bag, equipment and experiments.

Make stock carry, course recommendation, typical range, capability and personal best visibly distinct.

Desktop should offer a clear bag map, gaps, overlap, comparisons and deeper evidence. Mobile should make trusted club numbers and target-distance lookup quick.

Use shared unit formatting and clear sample/freshness labels.

Make a suspicious or stale number actionable through evidence review or a calibration session.

Keep equipment experiments tied to recorded changes and comparable evidence. Avoid presenting correlation as proof that equipment caused improvement.

**13. Improve Speed, Driver Development and Training Load**

Present speed development as a connected progression:

Training speed → speed with a ball → ball speed and strike → carry → repeatable playable performance.

Keep no-ball training, playing speed, session peaks and verified personal bests separate.

Preserve existing milestone and historical achievement rules.

Give each screen one clear current result and next action. Put deeper transfer, fatigue and comparison evidence behind accessible controls.

Integrate the new session-confidence behaviour throughout these views.

Training Load should explain current load, freshness and the basis of any suggested session adjustment. Avoid medical certainty or unsupported injury predictions.

**14. Improve Progress, Goals, Handicap and Strokes Gained**

Make Progress tell a coherent improvement story using comparable evidence.

Improve weekly review, goal progress, personal bests, practice adherence, bag changes and timelines through existing services.

Separate progress towards a goal from changes in the quantity or quality of evidence.

Handle increasing and decreasing goals correctly. Keep current value, target, timeframe and supporting evidence clear.

Distinguish course handicap, simulator/range estimates and other modelled projections.

Strokes Gained should show coverage, benchmark and the biggest supported scoring priorities before detailed tables.

Use appropriately labelled estimates and missing-data states. Preserve the existing calculation contracts.

**15. Improve Play, Courses, Strategy, rounds and Course Twin**

Cover Play, course library, course creation, course details, holes, shot patterns, strategy, Course Twin catalogue/runtime, round creation and round detail.

Make the journey from choosing a course to preparing, playing and reviewing obvious.

Show readiness based on actual available course, tee, bag and round data.

A golfer should understand what is ready and what requires setup before entering a complex view.

Improve course search, favourites, recent courses and catalogue status.

Mobile live-round entry should make the current hole, score, save status and next action immediately clear. Preserve edits through interruptions and retries.

Connect the post-round review to practice and future strategy.

Preserve Course Twin’s established 3D experience, terrain, shot provenance and round state. Improve loading feedback, touch controls, context-loss recovery and the optional 2D path.

Do not invent missing course geometry or imply that illustrative flight is measured trajectory.

**16. Improve competition, community and sharing**

Cover challenges, tournaments and their subroutes, leaderboards, course records, achievements, groups, friends, feed, social intelligence, profiles and shared views.

Make eligibility, rules, participation, submission, proof, pending review and final result easy to understand.

Every competition screen should explain the user’s position and next valid action.

Improve rankings, tie explanations, filters and empty states.

Keep recognition tied to supported evidence. Preserve distinctions between historical awards and currently trusted analytical evidence.

Make social and competition features discoverable without displacing core practice and play tasks.

Improve public and shared presentations, including expired, revoked, restricted and unavailable states. Keep privacy and ownership boundaries enforced on the server.

**17. Improve account, billing, administration and public pages**

Cover settings, notifications, invitations, profile management, billing, partners and every admin route.

Make settings searchable or clearly grouped, with understandable save states and recovery.

Show notification context and a useful destination.

Show billing status, entitlements, renewal information and available actions accurately for the configured environment.

Admin views should prioritise actionable queues, status, filtering, details and clear consequences. Preserve server-side role enforcement and audit trails.

Apply the visual system to landing, login, welcome, privacy, offline, shared pages, loading, errors and not-found states.

Align brand wording across visible copy, accessible labels, metadata, icons and share previews. Preserve identifiers and compatibility paths that should not be renamed.

Public product claims and screenshots must match the actual application.

**18. Deliver useful connected feature improvements**

Inspect existing implementations first, then complete these capabilities through the appropriate existing areas:

- An improvement-project view connecting a goal, baseline, selected drills, completed practice and subsequent evidence.
- A compact “since your last comparable session” review with a direct comparison action.
- A unified evidence-attention view connecting failed imports, unmapped clubs, questionable direction, stale yardages and other actionable issues.
- A pre-round readiness view combining the selected course, tees, trusted bag numbers and saved strategy.
- A clearer weekly review linking changes to evidence and the next practice decision.
- Context-preserving transitions between insight, practice, import, result and progress.

These must work end to end. Define the inputs, persistence, permissions, empty/error states and completion behaviour for each.

Extend existing models where appropriate. Avoid building duplicate dashboards or adding placeholder features solely to expand the menu.

**19. Preserve data integrity**

The redesign must retain account isolation, ownership checks, entitlements, privacy, raw source data and existing calculation rules.

Pay particular attention to the current session-confidence work:

- Session alignment and per-shot directional confidence are separate.
- Questionable direction must not automatically discard valid carry or speed.
- Confirming one shot must not override a session-level alignment restriction.
- Source-reported, measured, modelled and illustrative values remain distinct.
- Updated evidence must propagate consistently to relevant views.

Do not replace unavailable values with invented numbers or arbitrary confidence percentages.

Keep user data out of test fixtures, public screenshots and diagnostic artifacts unless explicitly appropriate.

Use isolated disposable data for mutation testing. Do not alter my real sessions, practice plans, goals, rounds or sharing settings merely to demonstrate the UI.

**20. Improve maintainability and performance**

Refactor oversized page modules where it directly supports the redesign. Separate data preparation, domain calculations, page composition and interactive components without introducing a parallel business-logic layer.

Consolidate overlapping primitives and styling rules. Preserve necessary compatibility behaviour while reducing unnecessary overrides.

Keep desktop-heavy datasets, charts, editors, maps and 3D dependencies out of initial mobile loads where practical.

Measure requests, rendering, bundles and interaction behaviour before choosing optimisations.

Investigate eager prefetching, duplicate data loading, unnecessary client rendering and broad global asset loading.

Preserve existing route budgets. Do not increase budgets simply to make checks pass.

Measure before and after using consistent routes, data and conditions. Distinguish development observations from production-build measurements.

**21. Verify accessibility and responsive behaviour**

Use WCAG 2.2 AA as the accessibility target, with manual checks as well as automation. Refer to the official [WCAG quick reference](https://www.w3.org/WAI/WCAG22/quickref/).

Verify keyboard navigation, visible focus, semantic headings, labels, contrast, error messages, status announcements, accessible charts and dialog focus behaviour.

Target at least 44×44 CSS pixels for primary mobile controls.

Test enlarged text, reduced motion, light/dark themes, supported additional themes, phone landscape and the onscreen keyboard.

Include representative widths of 320, 390, 430, 768, 1024, 1440 and 1920 pixels.

Test explicit companion/workbench choices independently from width, including resize and rotation.

Prevent document-level horizontal overflow. Allow intentional horizontal scrolling only within clearly designed tables or charts.

Do not claim physical-device, screen-reader or full accessibility verification from screenshots alone.

**22. Verify every workflow and route family**

Use the existing lint, formatting, TypeScript, unit tests, migration checks, production build, route budgets and browser suites.

Add meaningful behavioural tests for changed workflows and regressions. Do not rely solely on source-string assertions.

Run mutation tests only against the designated disposable environment and accounts.

Verify at least:

- First-session onboarding and import.
- Duplicate import and failure recovery.
- Session review and reversible evidence correction.
- Recommendation → practice → pause/resume → completion → measured result.
- Bag lookup → evidence → calibration practice.
- Course selection → preparation → round → review.
- Goal creation/update and evidence-based progress.
- Competition participation and submission.
- Sharing permissions, revocation and unavailable access.
- Relevant account and administrative workflows.
- Offline recovery, retry and account switching.

Capture and inspect before/after screenshots for every meaningful page family on desktop and mobile. Include populated, empty, loading and error states where applicable.

Expand visual coverage beyond the existing six-route matrix. Cover all routes through the ledger and representative dynamic records; test aliases and redirects explicitly.

Keep a record of console errors, failed requests, hydration issues and overflow findings. Fix regressions introduced by this work.

Unavailable authentication, missing data or browser failures are explicit verification gaps. They must not become silent skips reported as passes.

**23. Execution and completion**

Proceed autonomously with routine design and implementation decisions. Complete this as a coherent implementation programme, with checkpoints that preserve progress across goal continuations.

Work in this order:

1. Baseline and route/workflow inventory.
2. Shared design system and complete flagship desktop/mobile examples.
3. Core import, review, practice and play journeys.
4. Remaining analytical, social, account, public and administrative pages.
5. Connected feature completion.
6. Full integration, accessibility, performance and regression verification.

Do not stop after changing shared colours or polishing a few prominent pages.

Every route must be accounted for. Each should adopt the new system and receive the workflow improvements it needs; document any existing design deliberately preserved and why.

Keep concise progress updates explaining completed outcomes, remaining work and concrete blockers.

Do not commit, push, merge or deploy unless I separately request publication. Leave the implementation locally reviewable and preserve unrelated changes.

The goal is complete only when the required implementation is finished and its required checks have evidence. Do not declare completion because the remaining work is inconvenient or the context is nearly full.

Deliver:

- The working redesigned application.
- The complete route and workflow coverage ledger.
- Updated design-system guidance.
- A concise account of the most important fixes and feature improvements.
- Inspected desktop/mobile before-and-after evidence.
- Test and performance results with their limits.
- A precise list of any remaining blockers.
- The final changed-file scope and publication status.

The finished experience should make it easier for a golfer to understand their game, choose a useful action, complete it and see whether it helped.
