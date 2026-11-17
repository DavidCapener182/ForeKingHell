# ForeKingHell website experience review

17 November 2026 · LM World Tour · [Live branch preview](https://lm-world-tour-git-ux-golfe-b1c257-capener182-gmailcoms-projects.vercel.app) · [Implementation](https://github.com/DavidCapener182/ForeKingHell/pull/120)

## What the website should help a golfer do

A new golfer should be able to inspect an example, start free, import a session and see a usable club distance. A returning golfer should be able to tell what changed, choose one practice task and take a reliable number to the course. A coach or competition organiser needs access to players, groups, rules and results without filling every golfer’s home screen with administration.

The strongest parts of the existing product are the links between actual shots, bag confidence, practice and course strategy. The largest usability cost in the screens reviewed was the number of decisions presented before the golfer had picked a task.

## Changes available in the preview

| Journey                | Evidence from the review                                                                                                                                                                  | Implemented change                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explore the product    | The first viewport used a full-screen photograph, a general promise and a passive evidence card. The actual Bag preview was several sections down.                                        | The introduction names carry distance, practice and club selection. On larger screens a thumbnail opens the Bag example in the same page.                                              |
| Start an account       | All four pricing buttons used the same create-account link to Billing. The three paid buttons said “Sign in”.                                                                             | Start free opens the welcome journey. Paid comparisons open sign-in with Billing as the return destination.                                                                            |
| Find a tool            | The signed-in sidebar expanded every category, including administration. Friends and Groups were under Settings.                                                                          | Home and the current group open initially. Other groups can be expanded on demand. Community collects social destinations, and icon mode retains all available links.                  |
| Use a phone            | The companion’s main menu trigger displayed a profile name. Its Import shortcut used small type. Multi-word searches depended on an exact phrase.                                         | An explicit More tools label, larger Import target and word-by-word matching make discovery easier. Closing the menu clears the previous search.                                       |
| Understand progress    | Today and Dashboard both opened with the same large club comparison. Pinned figures and shortcuts were further down. The scoring handicap tile opened Rounds.                             | Dashboard opens with a section jump menu and whichever figures the golfer has pinned. The handicap tile opens Handicap. Today now opens with a dated recap and next steps. Club trends retains the selected session comparison.                 |
| Import a session       | Before file selection, the screen displayed settings, a zero-row shot table, export controls and a save checklist. At desktop width the selected radio indicator wrapped below its title. | Settings, preview and save appear once there is a file. Future steps are readable without linking to absent controls. The source cards align title, check mark and badge consistently. |
| Import offline         | Offline queueing reused the successful-save state, including the “Import saved” title and achievement action.                                                                             | A queued batch gets its own receipt. It tells the golfer the upload is on the device and will retry when connected.                                                                    |
| Follow a practice plan | The mobile planner linked to /training-load, which had no matching page.                                                                                                                  | The shortcut opens the existing Training Load page at /stats/training-over-time.                                                                                                       |

## Today and the return to practice

The original Today layout opened with club selectors, metric tabs and comparison uploads. The golfer had to scroll through a chart and an automatic carousel to reach the latest result, then through dispersion and trajectory before finding the saved practice plan.

| Area | Change in the branch |
| --- | --- |
| Desktop Today | A dated recap presents the measured takeaway, imported and included shot counts, and links to the longest eligible carry and closest eligible shot to the target line when available. The next practice plan, course and goal sit alongside it on wider screens. |
| Phone Today | A stationary practice card leads into a next action. The evidence drawer, offline queue status and retry remain accessible. |
| Detailed analysis | Club trends, Shot patterns and Practice review open independently. Links retain the date, club and session selection. History and shot-detail queries run for the relevant views. |
| Rounds | An in-progress round can be resumed. When the latest activity is a scored round, its score comes first. The golfer can expand the scorecard and round statistics. |
| Finding answers | Search recognises questions such as “am I improving”, “what changed between sessions” and “how far do I hit each club”. Mobile Quick Bag gives a next step when full-swing evidence is limited and presents one offline snapshot notice. |

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
2. Sign in to the preview and open Dashboard. Check the pinned figures, section menu and current navigation group.
3. Open Import before selecting a file. Choose a sample to inspect its review state, then return to the CSV source.
4. On the companion, open More tools, search using two terms and reopen the menu. Follow the practice planner’s Training Load link.

The hosted preview follows the pull-request branch. Production uses main. The branch was checked locally with generated route types, TypeScript, the project unit suite and change-scoped linting. A local browser server could not bind a port in the available execution environment.
