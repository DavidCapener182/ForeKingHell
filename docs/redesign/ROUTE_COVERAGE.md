# Route coverage ledger

98 current page files. Generated from the filesystem and active route metadata; internal companion runtime aliases retain their canonical destination. Source extraction is inventory evidence only. No runtime or visual pass is inferred. Detailed jobs, subroutes, source dependencies, permissions, findings, proposed improvements, state evidence and blockers are in [route-ledger.json](route-ledger.json).

Regenerate with `node scripts/generate-redesign-ledger.mjs`; recorded implementation and verification fields are preserved.

| Route                                   | Family              | Mobile capability                        | Implementation                                          | Desktop/mobile evidence entries |
| --------------------------------------- | ------------------- | ---------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| /admin/billing                          | admin-billing       | desktop-only                             | in progress                                             | 0/0                             |
| /admin/challenges                       | admin-challenges    | desktop-only                             | in progress                                             | 0/0                             |
| /admin/moderation                       | admin-moderation    | desktop-only                             | in progress                                             | 0/0                             |
| /admin                                  | admin               | desktop-only                             | in progress                                             | 0/0                             |
| /admin/system-checks                    | admin-system        | desktop-only                             | in progress                                             | 0/0                             |
| /admin/users                            | admin-users         | desktop-only                             | in progress                                             | 0/0                             |
| /achievements                           | achievements        | summary                                  | pending                                                 | 0/0                             |
| /analyse/compare                        | analyse             | desktop-only                             | pending                                                 | 0/0                             |
| /analyse/conditions                     | analyse             | desktop-only                             | pending                                                 | 0/0                             |
| /analyse                                | analyse             | desktop-only                             | pending                                                 | 0/0                             |
| /analyse/session-impact                 | session-impact      | desktop-only                             | pending                                                 | 0/0                             |
| /analyse/workspace                      | analyse             | desktop-only                             | pending                                                 | 0/0                             |
| /bag/[clubId]/analytics                 | bag                 | companion                                | pending                                                 | 0/0                             |
| /bag/[clubId]                           | bag                 | companion                                | pending                                                 | 0/0                             |
| /bag/longest                            | best-shots          | companion                                | implemented; wider theme and permissions checks pending | 1/1                             |
| /bag                                    | bag                 | companion                                | pending                                                 | 0/0                             |
| /billing                                | billing             | desktop-only                             | pending                                                 | 0/0                             |
| /challenges/[challengeId]               | challenges          | companion                                | in progress                                             | 0/0                             |
| /challenges                             | challenges          | companion                                | in progress                                             | 0/0                             |
| /coach/diagnosis                        | coach               | summary                                  | pending                                                 | 0/0                             |
| /coach                                  | coach               | summary                                  | pending                                                 | 0/0                             |
| /coach/reports                          | coach               | summary                                  | pending                                                 | 0/0                             |
| /coach/workspace                        | coach               | summary                                  | pending                                                 | 0/0                             |
| /companion-runtime/import/csv           | import              | companion                                | pending                                                 | 0/0                             |
| /companion-runtime/import               | import              | companion                                | pending                                                 | 0/0                             |
| /companion-runtime/import/result        | import              | companion                                | pending                                                 | 0/0                             |
| /companion-runtime/rapsodo              | rapsodo             | companion                                | pending                                                 | 0/0                             |
| /companion/handoff                      | internal            | Route-specific responsive review pending | pending                                                 | 0/0                             |
| /companion/summary                      | internal            | Route-specific responsive review pending | pending                                                 | 0/0                             |
| /compare                                | compare             | desktop-only                             | pending                                                 | 0/0                             |
| /course-records/[recordId]              | course-records      | desktop-only                             | pending                                                 | 0/0                             |
| /course-records                         | course-records      | desktop-only                             | pending                                                 | 0/0                             |
| /course-twins                           | course-twins        | companion                                | pending                                                 | 0/0                             |
| /courses/[courseId]/holes               | courses             | companion                                | pending                                                 | 0/0                             |
| /courses/[courseId]                     | courses             | companion                                | pending                                                 | 0/0                             |
| /courses/[courseId]/records/[recordId]  | courses             | companion                                | pending                                                 | 0/0                             |
| /courses/[courseId]/records             | courses             | companion                                | pending                                                 | 0/0                             |
| /courses/[courseId]/shot-pattern        | courses             | companion                                | pending                                                 | 0/0                             |
| /courses/[courseId]/tournaments         | courses             | companion                                | pending                                                 | 0/0                             |
| /courses/new                            | courses             | companion                                | pending                                                 | 0/0                             |
| /courses                                | courses             | companion                                | pending                                                 | 0/0                             |
| /courses/strategy                       | course-strategy     | companion                                | in progress                                             | 4/3                             |
| /dashboard                              | dashboard           | companion                                | pending                                                 | 0/0                             |
| /data-chat                              | data-chat           | desktop-only                             | pending                                                 | 0/0                             |
| /equipment/experiments                  | equipment           | desktop-only                             | pending                                                 | 0/0                             |
| /equipment                              | equipment           | desktop-only                             | pending                                                 | 0/0                             |
| /feed                                   | feed                | desktop-only                             | pending                                                 | 0/0                             |
| /friends                                | friends             | desktop-only                             | pending                                                 | 0/0                             |
| /goals                                  | goals               | companion                                | in progress                                             | 0/0                             |
| /groups/[groupSlug]                     | groups              | desktop-only                             | pending                                                 | 0/0                             |
| /groups                                 | groups              | desktop-only                             | pending                                                 | 0/0                             |
| /handicap                               | handicap            | summary                                  | pending                                                 | 0/0                             |
| /import                                 | import              | companion                                | in progress                                             | 1/1                             |
| /import/result                          | import              | companion                                | in progress                                             | 0/0                             |
| /leaderboard                            | leaderboard         | summary                                  | pending                                                 | 0/0                             |
| /partners                               | partners            | desktop-only                             | pending                                                 | 0/0                             |
| /play/[courseId]                        | course-twins        | immersive                                | pending                                                 | 0/0                             |
| /play                                   | play-companion      | companion                                | in progress                                             | 1/1                             |
| /practice                               | practice            | companion                                | in progress                                             | 0/1                             |
| /practice/quick-range                   | quick-range         | companion                                | pending                                                 | 0/0                             |
| /profile/[username]                     | profile             | summary                                  | pending                                                 | 0/0                             |
| /profile                                | profile             | summary                                  | pending                                                 | 0/0                             |
| /progress                               | progress            | companion                                | pending                                                 | 0/0                             |
| /providers                              | providers           | desktop-only                             | pending                                                 | 0/0                             |
| /quick-bag                              | quick-bag           | companion                                | pending                                                 | 0/0                             |
| /rapsodo                                | rapsodo             | companion                                | pending                                                 | 0/0                             |
| /rounds/[sessionId]                     | rounds              | summary                                  | in progress                                             | 2/4                             |
| /rounds/new                             | rounds              | summary                                  | in progress                                             | 3/4                             |
| /rounds                                 | rounds              | summary                                  | pending                                                 | 0/0                             |
| /sessions/[sessionId]                   | sessions            | companion                                | in progress                                             | 0/0                             |
| /sessions                               | sessions            | companion                                | in progress                                             | 1/1                             |
| /settings/invitations/[token]           | settings            | summary                                  | pending                                                 | 0/0                             |
| /settings/notifications                 | notifications       | summary                                  | pending                                                 | 0/0                             |
| /settings                               | settings            | summary                                  | pending                                                 | 0/0                             |
| /shared/[userId]                        | public-sharing      | Route-specific responsive review pending | pending                                                 | 0/0                             |
| /shots                                  | shots               | companion                                | in progress                                             | 0/0                             |
| /shots/review                           | shots               | companion                                | pending                                                 | 0/0                             |
| /simulator-lab                          | simulator-lab       | desktop-only                             | pending                                                 | 0/0                             |
| /social-intelligence                    | social-intelligence | desktop-only                             | pending                                                 | 0/0                             |
| /speed                                  | speed               | companion                                | pending                                                 | 0/0                             |
| /speed/sessions/[sessionId]             | speed               | companion                                | pending                                                 | 0/0                             |
| /stats/training-over-time               | training-load       | companion                                | pending                                                 | 0/0                             |
| /strokes-gained                         | strokes-gained      | desktop-only                             | pending                                                 | 0/0                             |
| /today                                  | today               | companion                                | in progress                                             | 2/1                             |
| /tournaments/[tournamentId]/leaderboard | tournaments         | summary                                  | in progress                                             | 0/0                             |
| /tournaments/[tournamentId]             | tournaments         | summary                                  | in progress                                             | 0/0                             |
| /tournaments/[tournamentId]/rounds      | tournaments         | summary                                  | in progress                                             | 0/0                             |
| /tournaments/[tournamentId]/rules       | tournaments         | summary                                  | in progress                                             | 0/0                             |
| /tournaments/[tournamentId]/submit      | tournaments         | summary                                  | in progress                                             | 0/0                             |
| /tournaments                            | tournaments         | summary                                  | in progress                                             | 0/0                             |
| /welcome                                | internal            | Route-specific responsive review pending | pending                                                 | 0/0                             |
| /login                                  | public              | Route-specific responsive review pending | pending                                                 | 0/0                             |
| /offline                                | public              | Route-specific responsive review pending | pending                                                 | 0/0                             |
| /                                       | public              | Route-specific responsive review pending | pending                                                 | 0/0                             |
| /privacy                                | public              | Route-specific responsive review pending | pending                                                 | 0/0                             |
| /share/[token]                          | public-sharing      | Route-specific responsive review pending | in progress                                             | 0/0                             |
| /share/course-twin/[token]              | public-sharing      | Route-specific responsive review pending | pending                                                 | 0/0                             |
| /share/report/[token]                   | public-sharing      | Route-specific responsive review pending | pending                                                 | 0/0                             |
