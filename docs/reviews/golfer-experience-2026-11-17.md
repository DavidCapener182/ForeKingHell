# ForeKingHell website experience review

17 November 2026 · LM World Tour · [Live branch preview](https://lm-world-tour-git-ux-golfe-b1c257-capener182-gmailcoms-projects.vercel.app) · [Implementation](https://github.com/DavidCapener182/ForeKingHell/pull/120)

## What the website should help a golfer do

A new golfer should be able to inspect an example, start free, import a session and see a usable club distance. A returning golfer should be able to tell what changed, choose one practice task and take a reliable number to the course. A coach or competition organiser needs access to players, groups, rules and results without filling every golfer’s home screen with administration.

The strongest parts of the existing product are the links between actual shots, bag confidence, practice and course strategy. The largest usability cost in the screens reviewed was the number of decisions presented before the golfer had picked a task.

## Changes available in the preview

| Journey                | Evidence from the review                                                                                                                                                                  | Implemented change                                                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explore the product    | The first viewport used a full-screen photograph, a general promise and a passive evidence card. The actual Bag preview was several sections down.                                        | The introduction names carry distance, practice and club selection. On larger screens a thumbnail opens the Bag example in the same page.                                                                                                                                     |
| Start an account       | All four pricing buttons used the same create-account link to Billing. The three paid buttons said “Sign in”.                                                                             | Start free opens the welcome journey. Paid comparisons open sign-in with Billing as the return destination.                                                                                                                                                                   |
| Find a tool            | The signed-in sidebar expanded every category, including administration. Friends and Groups were under Settings.                                                                          | Home and the current group open initially. Other groups can be expanded on demand. Community collects social destinations, and icon mode retains all available links.                                                                                                         |
| Use a phone            | The companion’s main menu trigger displayed a profile name. Its Import shortcut used small type. Multi-word searches depended on an exact phrase.                                         | An explicit More tools label, larger Import target and word-by-word matching make discovery easier. Closing the menu clears the previous search.                                                                                                                              |
| Understand progress    | Today and Dashboard both opened with the same large club comparison. Pinned figures and shortcuts were further down. The scoring handicap tile opened Rounds.                             | Dashboard opens with the next practice or round action and a measured carry ladder. Direct section links and pinned figures follow. The handicap tile opens Handicap. Today now opens with a dated recap and next steps. Club trends retains the selected session comparison. |
| Import a session       | Before file selection, the screen displayed settings, a zero-row shot table, export controls and a save checklist. At desktop width the selected radio indicator wrapped below its title. | Settings, preview and save appear once there is a file. Future steps are readable without linking to absent controls. The source cards align title, check mark and badge consistently.                                                                                        |
| Import offline         | Offline queueing reused the successful-save state, including the “Import saved” title and achievement action.                                                                             | A queued batch gets its own receipt. It tells the golfer the upload is on the device and will retry when connected.                                                                                                                                                           |
| Follow a practice plan | The mobile planner linked to /training-load, which had no matching page.                                                                                                                  | The shortcut opens the existing Training Load page at /stats/training-over-time.                                                                                                                                                                                              |

## Today and the return to practice

The original Today layout opened with club selectors, metric tabs and comparison uploads. The golfer had to scroll through a chart and an automatic carousel to reach the latest result, then through dispersion and trajectory before finding the saved practice plan.

| Area              | Change in the branch                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop Today     | A dated recap presents the measured takeaway, imported and included shot counts, and links to the longest eligible carry and closest eligible shot to the target line when available. The next practice plan, course and goal sit alongside it on wider screens. |
| Phone Today       | A stationary practice card leads into a next action. The evidence drawer, offline queue status and retry remain accessible.                                                                                                                                      |
| Detailed analysis | Dispersion and ball flight appear beneath the recap. Chart controls open on demand. Club trends and Practice review have dedicated views. Links retain the date, club and session selection. Historical club comparisons are requested when Club trends opens.   |
| Rounds            | An in-progress round can be resumed. When the latest activity is a scored round, its score comes first. The golfer can expand the scorecard and round statistics.                                                                                                |
| Finding answers   | Search recognises questions such as “am I improving”, “what changed between sessions” and “how far do I hit each club”. Mobile Quick Bag gives a next step when full-swing evidence is limited and presents one offline snapshot notice.                         |

## Product areas reviewed

| Product area                    | What already helps                                                                                                                                               | Priority for the next iteration                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bag and equipment               | Distance ladder, club confidence and individual club records allow the golfer to inspect the basis for a yardage. Quick Bag offers a short route to the numbers. | Test a first-time golfer at the range. Can they find carry, identify the least reliable club and understand what evidence would improve it without opening analytics?                         |
| Practice, speed and coaching    | The planner presents conditions, warm-up and a main priority. Goals, Speed and Coach surface different evidence for training.                                    | Trace a saved drill through its next measured upload. Establish whether the golfer can recognise what counted towards the drill and decide whether to repeat it.                              |
| Rounds and course planning      | The Play landing view gives an opening club and target. Course strategy, mapped course details and round history offer supporting detail.                        | Verify the specific-course Play view on a phone outdoors, including cold load, loss of connection and return to the previous hole. Its heading could not be confirmed in the live sweep.      |
| Analysis and progress           | Compare, Conditions, Session Impact, Performance Lab, Strokes Gained and Progress answer different questions.                                                    | Test whether users can choose between Compare sessions, Analyse and Progress from a plain-language question. Use the findings to refine search aliases and cross-links.                       |
| Competitions and community      | Tournament lists and details, challenges, leaderboards, groups and records rendered in the live account.                                                         | Walk a separate organiser and player through entry, submission and result confirmation using a test competition. Check their actions and statuses independently.                              |
| Coaching and administration     | Coach workspace, reports, account management, moderation and system checks have distinct destinations. The admin overview rendered on a repeat visit.            | Verify restricted and empty states with dedicated Free and Coach accounts. The reviewed account could see administrative tools.                                                               |
| Accessibility and small screens | The live desktop app exposed skip links, named navigation and expanded states. The companion has four labelled primary destinations.                             | Recheck keyboard focus after choosing a CSV, opening a collapsed group and jumping to the Bag preview. Verify large text, VoiceOver and a physical iPhone before making accessibility claims. |

## Coverage and limits

The repository contains 104 page entry files, including 87 signed-in application pages, six administration pages and 11 other entries. Some are internal companion routes or token-based views. The production review followed the 45 distinct desktop sidebar destinations, additional public and secondary pages, and representative records opened from real lists. This was a read-only walkthrough. A rendered page establishes reachability only.

Detail pages rendered for a club, session, round, speed session, group, tournament, course, course records list and record. Challenges and the admin overview both completed on a second visit. Paid checkout, invite acceptance, private share tokens, competition submissions, provider reconnection, administrative writes and an actual offline replay were outside the verified live paths. A completed golfer’s welcome route redirected to Today, so the first-run experience requires a fresh account.

## Reviewing the preview

1. On the homepage, open the sample Bag card at desktop width. Use Pricing to compare the Free and paid entry destinations.
2. Sign in to the preview and open Dashboard. Open a stock-carry bar, change the comparison club, and inspect the signed path and face readings.
3. Open Import before selecting a file. Choose a sample to inspect its review state, then return to the CSV source.
4. On the companion, open More tools, search using two terms and reopen the menu. Follow the practice planner’s Training Load link.

The hosted preview follows the pull-request branch. Production uses main. The branch was checked locally with generated route types, TypeScript, the project unit suite and change-scoped linting. A local browser server could not bind a port in the available execution environment.

## Page-by-page implementation

Each row records the change at the route or in the component it renders. Redirect entries name the screen that actually owns the interface. These are source-level checks. The earlier walkthrough and its account limits are described above.

| Page                                      | Update                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                       | The product tour now describes the journey from shot pattern to course plan.                                                       |
| `/404`                                    | The missing-page message points signed-in golfers to their history and public visitors to home or sign-in.                         |
| `/achievements`                           | The header shows unlocked achievements, total available and current level.                                                         |
| `/admin`                                  | Shortened the owner and operator audit-history description.                                                                        |
| `/admin/billing`                          | Explained that subscription status comes from stored records and can be compared with actual access.                               |
| `/admin/challenges`                       | Clarified the tasks of reviewing participation and managing templates.                                                             |
| `/admin/moderation`                       | Clarified what resolving a case does to its underlying content.                                                                    |
| `/admin/system-checks`                    | Distinguished latest service checks from checks still outstanding.                                                                 |
| `/admin/users`                            | Clarified which access changes require the account owner.                                                                          |
| `/analyse`                                | Clarified how to choose between session comparison, landing patterns and data quality.                                             |
| `/analyse/compare`                        | Added paired median carry bars for selected and baseline samples with shot counts and yards.                                       |
| `/analyse/conditions`                     | Clarified condition groups and relabelled the link to contributing shots.                                                          |
| `/analyse/session-impact`                 | Explained the before-and-after filter comparison and retention of readings.                                                        |
| `/analyse/workspace`                      | Named the tasks of reviewing flags, recording changes and saving comparisons.                                                      |
| `/bag`                                    | Rewrote four section and empty-state descriptions around choosing distances, finding records and checking wedge swings.            |
| `/bag/[clubId]`                           | Added a direct desktop action from the club profile to its trends.                                                                 |
| `/bag/[clubId]/analytics`                 | Renamed the assistant panel and identified the club-specific questions it can answer.                                              |
| `/bag/longest`                            | Clarified how to open the exact shot behind a carry or total-distance record.                                                      |
| `/billing`                                | Named the three billing tasks in the introduction.                                                                                 |
| `/challenges`                             | Made targets, qualifying shots and current leaders explicit.                                                                       |
| `/challenges/[challengeId]`               | Renamed the progress and qualifying-attempt sections.                                                                              |
| `/coach`                                  | Gave the supporting evidence sections question-based headings.                                                                     |
| `/coach/diagnosis`                        | Explained the club–drill–retest sequence.                                                                                          |
| `/coach/reports`                          | Clarified report scope, date and access withdrawal.                                                                                |
| `/coach/workspace`                        | Made the visibility of notes, feedback and assignments explicit.                                                                   |
| `/companion-runtime/import`               | Uses the updated companion import screen and saved file count.                                                                     |
| `/companion-runtime/import/csv`           | Uses the revised row-warning message in the companion CSV review.                                                                  |
| `/companion-runtime/import/result`        | Uses the companion import receipt and updated shared page header.                                                                  |
| `/companion-runtime/rapsodo`              | Clarified the prompt for checking an upload against a saved practice plan.                                                         |
| `/companion-runtime/today`                | Uses the updated Today takeaway and shared club comparison.                                                                        |
| `/companion/handoff`                      | Clarified the choice between the full workspace and phone tools.                                                                   |
| `/companion/summary`                      | Added a plain-language empty state for a selection with no measurements.                                                           |
| `/compare`                                | Renamed the assistant panel around the comparison being reviewed.                                                                  |
| `/cookies`                                | Added a direct link to the analytics preference control.                                                                           |
| `/course-records`                         | Explained which board to select and where to find qualifying requirements.                                                         |
| `/course-records/[recordId]`              | Made the overall leader and personal best easier to distinguish.                                                                   |
| `/course-twins`                           | Clarified the uses of a mapped course and the Grade B terrain limitation.                                                          |
| `/courses`                                | The directory header counts courses, strategy-ready courses and Course Twins.                                                      |
| `/courses/[courseId]`                     | Named the section for checking setup before a round.                                                                               |
| `/courses/[courseId]/holes`               | Named the map editor after its task of placing tees and greens.                                                                    |
| `/courses/[courseId]/records`             | Explained how to check qualifying tees, dates, format and proof.                                                                   |
| `/courses/[courseId]/records/[recordId]`  | Redirects to the updated course record detail and preserves query parameters.                                                      |
| `/courses/[courseId]/shot-pattern`        | Explained how selecting a club and aim point projects measured landings.                                                           |
| `/courses/[courseId]/tournaments`         | Opens the updated tournament index filtered to the course.                                                                         |
| `/courses/new`                            | Clarified search, manual entry and selecting usual tees.                                                                           |
| `/courses/strategy`                       | Renamed the post-round action to review progress after the round.                                                                  |
| `/dashboard`                              | Added state-aware practice action, stock carry ladder, direct section links, grouped club picker and signed delivery angle scales. |
| `/data-chat`                              | Added a specific golf question to the question field.                                                                              |
| `/equipment`                              | Rewrote active and retired setup descriptions around playing distance, confidence and usual miss.                                  |
| `/equipment/experiments`                  | Added comparable median carry bars to explicitly selected equipment tests.                                                         |
| `/equipment/launch-monitors/calibration`  | Clarified the device and test-condition comparison.                                                                                |
| `/feed`                                   | Identified the newest-first ordering of golf activity.                                                                             |
| `/friends`                                | Shows connection and sent-request counts, with a direct action for incoming requests.                                              |
| `/goals`                                  | Added a weekly measured-session progress bar, target and remaining sessions.                                                       |
| `/groups`                                 | Shows joined groups, discoverable groups and invitations alongside query limits.                                                   |
| `/groups/[groupSlug]`                     | Named the member list explicitly.                                                                                                  |
| `/handicap`                               | Clarified the purpose of the eligible-scorecard section.                                                                           |
| `/import`                                 | Improved file-read errors and validation warnings. The phone entry shows the count of saved import files.                          |
| `/import/result`                          | Renamed the desktop action for inspecting imported shots. The companion receipt uses the shared header update.                     |
| `/leaderboard`                            | Clarified the gross-score and completed-round comparison for event leaders.                                                        |
| `/login`                                  | Made the available sign-in methods explicit.                                                                                       |
| `/offline`                                | Clarified which saved resources can be opened offline.                                                                             |
| `/partners`                               | Clarified where to read offer terms and manage sponsors.                                                                           |
| `/play`                                   | Relabelled first-hole strategy and the longest mapped holes.                                                                       |
| `/play/[courseId]`                        | The desktop hole-map editor link describes its actual destination.                                                                 |
| `/practice`                               | Renamed the plan-versus-upload review and explained the comparison.                                                                |
| `/practice/quick-range`                   | The range setup shows the chosen club, planned balls and focus.                                                                    |
| `/privacy`                                | Added direct links to data controls, privacy contact and the cookie-choice control.                                                |
| `/profile`                                | Renamed the activity section and its empty state.                                                                                  |
| `/profile/[username]`                     | Clarified which activity and club distances the golfer has shared.                                                                 |
| `/progress`                               | Shows the last seven days of logged entries, real rounds and personal bests in the desktop header.                                 |
| `/providers`                              | Explained how to populate an empty provider list.                                                                                  |
| `/quick-bag`                              | Shows the bag size and explains the target-distance lookup.                                                                        |
| `/rapsodo`                                | The remote-session search uses a search input with native clearing where supported.                                                |
| `/rounds`                                 | Provides a direct resume action when a saved round is still in progress.                                                           |
| `/rounds/[sessionId]`                     | Renamed the round assistant panel and clarified map availability.                                                                  |
| `/rounds/new`                             | Clarified how to enter scores and when the round can contribute to handicap.                                                       |
| `/sessions`                               | The desktop and phone headers show matching activities versus saved activities when filtered.                                      |
| `/sessions/[sessionId]`                   | Renamed the section listing the session’s actual shots.                                                                            |
| `/settings`                               | Clarified dashboard pin selection and shared-account access.                                                                       |
| `/settings/invitations/[token]`           | Shows the invited role alongside the inviter before acceptance.                                                                    |
| `/settings/notifications`                 | Clarified delivery preferences and in-app categories.                                                                              |
| `/share/[token]`                          | Displays scored versus scheduled holes in the desktop shared-round heading.                                                        |
| `/share/course-twin/[token]`              | Shows the mapped hole count in the read-only replay.                                                                               |
| `/share/report/[token]`                   | Clarified the report date, shared sections and their scope.                                                                        |
| `/shared/[userId]`                        | Clarified the identity of the signed-in viewer of the read-only overview.                                                          |
| `/shots`                                  | Shows filtered and total shot counts in the heading and a concrete first-import action.                                            |
| `/shots/review`                           | Explains how to find the reason for a suggestion before deciding whether to keep a shot.                                           |
| `/simulator-lab`                          | Clarified club gaps, indoor trends and the partial-data state.                                                                     |
| `/social-intelligence`                    | Clarified how to create a recap and check a report.                                                                                |
| `/speed`                                  | Clarified training speed, ball speed and carry while preserving the no-ball distinction.                                           |
| `/speed/sessions/[sessionId]`             | Explained how individual swing readings populate the session history.                                                              |
| `/stats/training-over-time`               | Shows the number of activities in the loaded training history.                                                                     |
| `/strokes-gained`                         | Renamed the assistant and clarified how to read gains and losses by phase.                                                         |
| `/terms`                                  | Added direct section navigation to all eight topics.                                                                               |
| `/thank-you`                              | Put opening the secure email link first.                                                                                           |
| `/today`                                  | The carry takeaway includes both measured averages and both sample sizes. Club trends uses one grouped club selector.              |
| `/tournaments`                            | Shows the event count for the current selection.                                                                                   |
| `/tournaments/[tournamentId]`             | Fixed a literal template expression in the closed-event status and clarified manual scorecard use.                                 |
| `/tournaments/[tournamentId]/leaderboard` | Redirects to the standings tab of the updated event.                                                                               |
| `/tournaments/[tournamentId]/rounds`      | Redirects to the submission tab of the updated event.                                                                              |
| `/tournaments/[tournamentId]/rules`       | Redirects to the rules tab of the updated event.                                                                                   |
| `/tournaments/[tournamentId]/submit`      | Redirects to the submission tab of the updated event.                                                                              |
| `/welcome`                                | Shows completed setup steps against the total, using the saved checklist.                                                          |

Shared controls also improve the reading experience across routes. Metric bars render all supplied values, long mobile metric text can wrap, and overflowing shared tables offer labelled previous and next column controls.
