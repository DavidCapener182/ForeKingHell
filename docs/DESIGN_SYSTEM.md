# LM World Tour interface system

The product journey is import or record → understand → choose a priority → practise or prepare → collect evidence → review improvement. Each major page leads with one supported answer or current task, a small group of relevant facts, and one primary action. Evidence and specialist controls follow at the depth needed for that task.

## Composition and hierarchy

Desktop is a full-width analytical workspace. Lead with a compact editorial answer, then use an evidence column and contextual actions when laptop width permits. Avoid large decorative headers, repeated AI summaries and permanently open assistant panels. Preserve table tools, exports, saved views, filters, pinned items and keyboard navigation.

The current companion uses Today, Sessions, Practice, Play and Bag. The concurrent 6 September post-practice review commit moved Sessions into the primary tabs; preserve that newer implementation, with Progress reached from Today and session review. Start with the actual activity state and a reachable action. Use grouped rows and focused charts; keep drill instructions, score entry and club lookup above decorative imagery. A viewport change must not override an explicit workbench preference. Internal companion runtime routes implement canonical product routes, not additional destinations.

| Destination               | Owns the answer                                              | Continues to                                 |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| Today                     | Latest result, current activity and next action              | Review, resume or prepare                    |
| Dashboard                 | Broader performance and longer-term priorities               | A specific investigation or practice         |
| Sessions                  | Actual activity history and review                           | Evidence, comparison and next practice       |
| Analyse / Performance Lab | A selected question / deeper launch-monitor assessment       | Supporting shots and Coach                   |
| Coach / Data Chat         | Prioritised prescription / questions about selected evidence | Practice with source and club retained       |
| Practice                  | Recommendation, saved plan, activity and measured result     | Import → Plan versus Actual → next plan      |
| Progress                  | Comparable improvement over time                             | Evidence and a goal-linked practice decision |
| Bag / Quick Bag           | Trusted numbers and gaps / immediate target-distance choice  | Club evidence and calibration                |
| Play                      | Preparation, current round and course context                | Course → round → review                      |

## Evidence and language

Show source, sample size, relevant date and limitations near a claim. A carry increase is a longer average, not automatically an improvement. Completing activity is distinct from proving its objective. Use qualitative confidence with its basis; never map labels to arbitrary percentages or imply statistical significance. Session alignment and per-shot directional confidence remain separate, and neither should erase valid carry or speed evidence.

Use the active constants in `src/lib/brand.ts` for visible and accessible brand wording. Preserve legacy storage keys, database identifiers and compatibility paths.

## Visual decisions

Use existing semantic theme tokens: deep golf greens for identity, quiet neutral surfaces, strong text and restrained state accents. Use the existing sans type stack, tabular numbers for measurements, comfortable body text and concise sentence-case headings. Do not add fonts or global artwork to make a page feel premium.

Use a 4px spacing rhythm, 16–24px between related groups and 24–32px between desktop sections. Distinguish sections with space and hairline borders before adding nested cards. Retain the established mobile radii and semantic card tokens. Charts use explicit units, aligned comparison axes and accessible evidence tables. Colour is supplementary to text and shape.

Retain the existing motion primitives for route steps, selection and disclosure. Respect reduced motion. Primary companion controls should be at least 44×44 CSS pixels, with visible keyboard focus, safe-area spacing and no overlap from keyboards or sticky controls. Existing light, dark, clubhouse, outdoor, range-night, tour-broadcast and high-contrast preferences all require verification.

Implementation and verification status live in `docs/redesign/route-ledger.json`; this guidance is a design contract, not a statement that all routes have passed.

The desktop workbench and mobile Apple theme share semantic tokens, but intentionally use different layout treatments. Mobile-specific material, safe-area, navigation and grouped-list rules live in `src/app/mobile-apple.css`; desktop structure remains in the existing workbench components.

| Purpose                             | Authoritative primitive                              |
| ----------------------------------- | ---------------------------------------------------- |
| Full-width app page shell           | `PageShell` in `src/components/premium.tsx`          |
| Mobile and desktop page heading     | `PageHeader` in `src/components/premium.tsx`         |
| Compact metric                      | `AppMetricCard` or `MetricCard`                      |
| Evidence insight                    | `InsightBlock`                                       |
| Confidence and data health          | `ConfidenceIndicator`, `DataHealthStatus`            |
| Chart frame and accessible fallback | `ChartCard`, `ChartFrame`, `ChartAccessibleFallback` |
| Empty, loading and error states     | `EmptyState`, `RouteLoadingState`, `RouteErrorState` |
| Offline state                       | `OfflineState`                                       |
| Mobile filter sheet                 | `MobileFilterSheet`                                  |
| Two-to-four option selector         | `SegmentedControl`                                   |
| Session and club summaries          | `SessionSummary`, `ClubRow`                          |

## Token contract

Use semantic CSS variables for background, foreground, card, muted, border, input, ring, charts and positive/negative state. Mobile Apple surfaces must derive from these variables so light, dark and system themes remain consistent. Avoid new hard-coded white cards or isolated green values in shared components.

App content remains full-width. Do not add capped `max-w-*` wrappers to dashboard or analysis page shells.

## Shared component refinement and session highlights

The September redesign uses Untitled UI's component examples as a reference for clear hierarchy and control treatment, while retaining the app's golf-green identity and existing Radix primitives. The clubhouse theme uses a quiet neutral canvas, white semantic card surfaces, subtle borders, 12px controls and 16px panels. Card titles use the UI sans-serif. Measurements use aligned numerals; explanatory values must not be forced into the condensed score font. Default desktop buttons and inputs are 40px, large actions 44px; primary phone actions retain at least 44px targets. Tab selection is driven by Radix `data-state="active"`.

`HighlightCarousel` is the shared, Embla-backed session/club highlight primitive. It uses a stable initial index, horizontal travel, a visible position indicator, explicit previous/next and pause controls. The default interval is 8 seconds; hover, focus, user navigation, hidden pages and offscreen placement suspend rotation. Reduced-motion preferences disable automatic rotation and animated travel. Do not rotate an in-progress practice/round task or hide offline recovery inside a rotating slide. Today slides describe the selected review; Best shots slides describe all-time club records. Keep those scopes explicit.

Practice handoffs carry `sourceSessionId` independently from `planId` and the activity type `session`. Old import links with a UUID in `session` remain compatible. Validate source ownership on the server, preserve the source through regeneration and persistence, and expose the source review using `PracticeSourceEvidence`. A saved baseline must not silently become the latest unrelated session.

References: https://www.untitledui.com/react/components and https://reactbits.dev/components/carousel. The implementations use the repository's existing dependencies; no third-party component package was installed.
