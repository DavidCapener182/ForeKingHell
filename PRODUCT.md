# LM World Tour Product Context

## Register

product

## Product Purpose

LM World Tour is a golf performance workspace for launch-monitor data, bag mapping, rounds, courses, achievements, social play, tournaments, and coaching. The app should help a golfer decide what to do next: import data, review a round, fix a club gap, start a drill, compare progress, or act on a coaching signal.

## Users

- Golfers using launch-monitor sessions, simulated rounds, and real rounds to understand their game.
- Players who need dense, trusted performance readouts rather than marketing pages.
- Admins managing users, billing, challenges, providers, and partner workflows.

## Product Tone

- Operational, confident, and direct.
- Golf-performance focused: use language around rounds, shots, clubs, bag trust, form, scoring, and practice.
- Premium sports-tool feel: calm surfaces, strong data hierarchy, deliberate accents, no decorative UI tricks.

## Design Principles

- Pages should feel like working surfaces, not landing pages.
- The first viewport should expose the next useful action.
- Dense information is acceptable when it improves scanability.
- Shared primitives should carry most visual polish so every route feels related.
- Use visuals when they show golf context, course context, bag context, or performance state.

## Anti-References

- Generic SaaS dashboards with repeated metric cards.
- Decorative glassmorphism, gradient text, and side-stripe cards.
- Marketing hero layouts inside authenticated product routes.
- Equal-height card rows that force unrelated content into matched boxes.
- Artificial motion that does not communicate state.

## Protected Product Rules

- App content pages fill the available content window. Do not add capped app wrappers such as `max-w-6xl`, `max-w-7xl`, or `max-w-[1500px]`.
- The `/bag` benchmark comparison must not include Attack or Launch until reliable comparison data exists.
- Current ForeKingHell conventions are authoritative unless this document is updated.
