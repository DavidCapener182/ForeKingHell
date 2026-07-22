# Personal data export contract

The personal account export is JSON with schema version `2026-07-21`. It is a portability export for the authenticated requester, not an administrative group export.

## Top-level fields

| Field           | Type     | Meaning                                                              |
| --------------- | -------- | -------------------------------------------------------------------- |
| `schemaVersion` | string   | Version of this documented contract.                                 |
| `scope`         | string   | Always `personal`.                                                   |
| `exportedAt`    | ISO date | UTC time at which the export was assembled.                          |
| `userId`        | UUID     | Authenticated requester.                                             |
| `profile`       | object   | Requester's account row, when available.                             |
| `data`          | object   | Named datasets listed below. Empty datasets are represented as `[]`. |
| `manifest`      | array    | Dataset row counts and sensitivity classifications.                  |
| `checksum`      | object   | SHA-256 checksum of the export document before the checksum field.   |
| `pagination`    | object   | Cursor metadata for datasets that are returned in bounded pages.     |

## Dataset scope

Personal golf datasets include clubs, sessions, import rows/files, shots, stock yardages, ball models, equipment history/snapshots, strokes-gained events, achievements, XP, Rapsodo sync rows, weather, providers and the requester's AI usage/cache rows.

Personal social and competition datasets include rows authored by the requester, the requester's own memberships/entries/attempts/results/comments, bilateral invitation/friendship rows where the requester is a party, groups/challenges/courses created by the requester and requester-authored feed/group content.

Billing datasets include only rows whose `userId` is the requester. Partner datasets include only sponsors owned by the requester and their dependent offers/rewards.

The following datasets are intentionally absent from a personal export because they contain another person's or an operator's private record:

- account invitations;
- group leaderboard snapshots;
- moderation events;
- rivalry pairings and rivalry windows;
- social reports submitted by another user;
- block rows where the requester is the blocked party;
- group memberships, invites or posts belonging to other members merely because the requester owns the group.

## Redaction rules

The default export removes operational identifiers and storage details that are not portable user content:

| Dataset             | Fields removed                                              |
| ------------------- | ----------------------------------------------------------- |
| `billingCustomers`  | `stripeCustomerId`                                          |
| `subscriptions`     | `billingCustomerId`, `stripeSubscriptionId`, `metadataJson` |
| `shareLinks`        | `tokenHash`                                                 |
| `contentExports`    | `storagePath`                                               |
| `importSourceFiles` | `storagePath`, `metadataJson`                               |
| `providerAccounts`  | `providerAccountId`, `metadataJson`                         |
| `providerSessions`  | `providerAccountId`, `providerSessionId`, `rawMetadataJson` |

## Dates, numbers and units

- Export timestamps are ISO-8601 UTC strings.
- Database date-only and timestamp fields retain their JSON serialization from the application data layer.
- Stored golf measurements remain in their canonical storage units; the export does not silently convert them to the current display preference.
- Null measurements remain `null`; zero is not treated as missing.

## Large-account pagination

Shot rows are returned in stable UUID order with a maximum of 5,000 rows per response. When `pagination.shots.hasMore` is true, request the relative `nextPath` to retrieve the next authorised page. Each page repeats the smaller account datasets so it remains independently understandable. Other datasets remain assembled in memory; future schema versions may extend cursor pagination to them if operational account sizes require it.

Coach Workspace interactions use conditional export ownership: a coach receives the interaction rows
they authored, including their private notes; a player receives only interactions marked
`player_visible`. A coach-only note is never included in the player's export.
