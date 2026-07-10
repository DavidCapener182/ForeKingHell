# Product route map

The central loop is **Today -> Latest session -> Analyse -> Practice plan**. The mobile shell exposes only Today, Sessions, Analyse, Bag and Profile; every existing feature remains reachable through the grouped secondary navigation below.

## Primary personal analysis

| Destination | Routes                                                             | Purpose                                                                                              |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Today       | `/today`, `/dashboard`                                             | Latest evidence, main insight, data health and next action. Dashboard remains an extended overview.  |
| Sessions    | `/sessions`, `/rounds`, `/rounds/[sessionId]`, `/rounds/new`       | Chronological practice/round history, round review and round entry.                                  |
| Import      | `/import`, `/import/result`, `/rapsodo`, `/providers`              | Contextual primary action for CSV/provider data and import results.                                  |
| Analyse     | `/analyse`, `/analyse/session-impact`, `/analyse/workspace`        | Evidence hub, reversible session impact, data quality, annotations, equipment periods and snapshots. |
| Shots       | `/shots`                                                           | Filterable row-level shot evidence and patterns.                                                     |
| Bag         | `/bag`, `/bag/[clubId]`, `/bag/[clubId]/analytics`, `/bag/longest` | Stock/dependable carry, confidence, gapping, club evidence and raw/trusted records.                  |

## Improve

| Feature                 | Routes                                  | Where users find it                                   |
| ----------------------- | --------------------------------------- | ----------------------------------------------------- |
| Progress and comparison | `/progress`, `/compare`                 | Analyse hub and Improve navigation.                   |
| Coach                   | `/coach`, `/coach/diagnosis`            | Analyse hub and Improve navigation.                   |
| Practice                | `/practice`                             | Recommended next action from Today, Analyse or Coach. |
| Performance Lab         | `/simulator-lab`                        | Improve navigation.                                   |
| Strokes gained          | `/strokes-gained`                       | Analyse hub / Improve navigation.                     |
| Speed                   | `/speed`, `/speed/sessions/[sessionId]` | Improve navigation.                                   |
| Training load           | `/stats/training-over-time`             | Improve navigation.                                   |
| Handicap                | `/handicap`                             | Analyse hub / Review navigation.                      |
| Data Chat               | `/data-chat`                            | Secondary evidence-explanation tool under Improve.    |

## Courses, records and equipment

| Feature            | Routes                                                                                                                   | Where users find it             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Courses            | `/courses`, `/courses/new`, `/courses/[courseId]/holes`, `/courses/[courseId]/shot-pattern`                              | Manage secondary navigation.    |
| Course records     | `/course-records`, `/course-records/[recordId]`, `/courses/[courseId]/records`, `/courses/[courseId]/records/[recordId]` | Courses and records group.      |
| Course competition | `/courses/[courseId]/tournaments`                                                                                        | Compete navigation.             |
| Equipment          | `/equipment`                                                                                                             | Bag and Manage navigation.      |
| Achievements       | `/achievements`                                                                                                          | Profile and Compete navigation. |

## Social and competition

| Feature             | Routes                                                                                                                                                                                                    | Where users find it                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Challenges          | `/challenges`, `/challenges/[challengeId]`                                                                                                                                                                | Compete navigation.                                                  |
| Tournaments         | `/tournaments`, `/tournaments/[tournamentId]`, `/tournaments/[tournamentId]/leaderboard`, `/tournaments/[tournamentId]/rounds`, `/tournaments/[tournamentId]/rules`, `/tournaments/[tournamentId]/submit` | Compete navigation.                                                  |
| Leaderboards        | `/leaderboard`                                                                                                                                                                                            | Compete navigation.                                                  |
| Feed and friends    | `/feed`, `/friends`                                                                                                                                                                                       | Profile secondary navigation.                                        |
| Groups              | `/groups`, `/groups/[groupSlug]`                                                                                                                                                                          | Compete/Profile secondary navigation.                                |
| Social intelligence | `/social-intelligence`                                                                                                                                                                                    | Manage/Profile secondary navigation.                                 |
| Public profile      | `/profile/[username]`                                                                                                                                                                                     | Privacy-aware public projection.                                     |
| Shared access       | `/shared/[userId]`, `/share/[token]`                                                                                                                                                                      | Explicit collaborator or bearer-token route, not primary navigation. |

## Profile, settings and platform

| Feature                  | Routes                                       | Where users find it                        |
| ------------------------ | -------------------------------------------- | ------------------------------------------ |
| Profile                  | `/profile`                                   | Fifth mobile tab and desktop user control. |
| Settings and invitations | `/settings`, `/settings/invitations/[token]` | Profile / Manage.                          |
| Privacy and offline      | `/privacy`, `/offline`                       | Public/support and Profile settings.       |
| Billing                  | `/billing`                                   | Manage.                                    |
| Partners                 | `/partners`                                  | Manage for authorised users.               |
| Authentication and root  | `/login`, `/`                                | Public entry and authenticated redirect.   |

## Administration

Administration is never inferred from navigation visibility. Every route must validate an active server-side role.

| Feature              | Routes                 |
| -------------------- | ---------------------- |
| Admin overview       | `/admin`               |
| Users and roles      | `/admin/users`         |
| Billing operations   | `/admin/billing`       |
| Challenge operations | `/admin/challenges`    |
| Moderation           | `/admin/moderation`    |
| System checks        | `/admin/system-checks` |
