# LM World Tour Design System Notes

## Visual Direction

Product-first golf analytics: quiet, dense, confident, and tactile. The UI should feel like a premium course book crossed with an operations console: tinted paper surfaces, crisp borders, readable data, and a restrained green accent used for action and state.

## Color

- Background: tinted fairway-neutral, not pure white or pure gray.
- Surfaces: warm white and pale green-gray layers.
- Primary accent: deep green for current state, primary action, success, and selection.
- Secondary accents: sky, amber, pink, and slate only for semantic data variety.
- Avoid one-note green dominance by preserving neutral structure and using secondary accents in readouts.

## Typography

- Use the existing Geist/system stack.
- Keep app headings compact and confident.
- Use uppercase micro-labels sparingly for data labels.
- Use tabular numerals for tables, metrics, and comparisons.
- Avoid fluid viewport typography.

## Layout

- Full-width app shell. No capped dashboard-style content wrappers.
- Prefer asymmetric main column plus side rail for command surfaces.
- Use compact panels, rails, tables, and bento summaries instead of generic metric grids.
- Cards may be used for individual repeated items and tool panels. Avoid nested card stacks.
- Mobile pages should reveal the route header, active tab, primary signal, and first action without clipping.

## Components

- `PageShell` owns app spacing and full-width behavior.
- `PageHeader`, `DataPanel`, `SectionHeader`, `MetricCard`, `NativeListSection`, `MobileRouteHeader`, and `MobileTabBar` are the primary route primitives.
- `premium-card`, `apple-panel`, and `apple-panel-strong` are shared surface classes. Improve these before adding one-off route styling.
- Buttons, tabs, scroll rails, tables, and form controls need visible focus states and stable touch targets.

## Motion

- Motion should be limited to hover, focus, active, disclosure, and state feedback.
- Use short color, shadow, opacity, and transform transitions.
- Do not animate layout properties.
- Respect `prefers-reduced-motion`.

## Copy

- Product copy should be concise and action-led.
- Use golfer-facing verbs: Review, Import, Start, Compare, Open, Save, Join.
- Avoid first-person narration and filler.
