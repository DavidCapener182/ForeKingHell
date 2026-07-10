# ForeKingHell interface primitives

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
