# Connected feature acceptance — 7 September 2026

Current-source audit against brief section 18. Source wiring is not end-to-end browser proof.

| Required feature              | Current source evidence                                                                                                                                                    | Remaining proof or work                                                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Improvement project           | `src/lib/goal-improvement-project.ts` supplies owned baseline, plans, drills, completion, subsequent measured sessions and compare links; Goals action persists references | Current Goals page and goal-project-panel now call loader/save action. Backend owned baseline/practice/evidence and recovery integration passes; visible selection/recovery and full browser journey still pending    |
| Since last comparable session | Today/session comparison implementations plus preserved comparison actions                                                                                                 | Reconcile current UI task evidence with route ledger; verify current populated and insufficient-evidence states                                                                                                       |
| Unified evidence attention    | Analyse Workspace calls `buildDataQualityIssues` for unmapped clubs, suspect distances, stale stock, failed provider/offline records and other issues                      | Workspace now calls the owned helper and renders direction attention. Actual-page browser passes ownership, session links and flag-clear recovery; actual repair click and oldest-record navigation remain unverified |
| Pre-round readiness           | Play selects course/tee and combines trusted bag and saved strategy readiness                                                                                              | Existing round browser checks do not alone prove every readiness transition; reconcile UI task proof                                                                                                                  |
| Weekly review                 | Progress uses weekly evidence and adjacent-window club control comparison with source-session links                                                                        | Verify next-practice handoff and missing/partial evidence on current UI                                                                                                                                               |
| Context-preserving loop       | Disposable practice-upload browser covers source -> plan -> start/pause/resume -> completion -> actual measured upload -> linked result                                    | Additional entry points and goal association remain separate coverage; do not generalize one journey to every route                                                                                                   |

No feature is marked fully accepted by this source-only audit. UI task owns page integration; root owns backend integrity and supporting verification. Full original brief remains active.

## Evidence reconciliation after P51

The improvement-project row above now has browser evidence in `output/playwright/ui-upgrade/goal-project-browser.log` (1 passed, 7.9s). Inspection of `tests/e2e/ui-upgrade-goal-project.spec.ts` confirms one actual save of the owned baseline and practice-plan links, persisted preference readback, drill visibility and the no-subsequent-evidence state across both surfaces at six widths. The test also checks that its original shot fields remain unchanged. It does not exercise a failed save, completed linked practice, subsequent measured evidence or the complete goal-to-practice-to-review loop; those remain separate acceptance requirements.

A fresh source search after P51 still finds `getDirectionAttention` only at its definition in `src/lib/direction-attention.ts`. The unified attention UI integration remains outstanding; passing helper tests cannot close it.

P53 Play evidence: `output/playwright/ui-upgrade/play-browser-label.log` passed in 37.9s. The inspected fixture checks exact selected-course/tee strategy and new-round hrefs, setup search/reset/apply controls, two mapped holes for the selected tee, missing qualified recommendations, and switching an existing round to active so Continue replaces Start and hides setup. It covers both surfaces at six widths and checks stored shot fields remain unchanged. It does not navigate those round/strategy links, select a different course and verify its persisted cookies, or establish positive readiness with a qualified bag. Those transitions remain open, alongside absent-course/tee and error recovery states not asserted by this fixture.

## P63 read-only reconciliation

Current Analyse Workspace issue construction still supplies unmapped clubs, duplicate imports, distance/unit checks, scorecard/rating gaps, low samples, classification, stale stock and failed provider/offline actions. It supplies no session alignment or questionable-direction review counts. `getDirectionAttention` remains definition-only in app source. Thus the direction-attention gap is confirmed against the actual issue inputs, not inferred solely from an unused helper. UI owner notified to retain this in connected-feature integration. P63 runtime is frozen for its browser matrix; no runtime changes made during reconciliation.

## Direction recovery verification — 7 September 12:58

Extended the disposable direction-attention regression to cover an aligned session with a real questionable shot, followed by confirmation removing it entirely from attention. Existing misalignment-only, exact101/visible100, foreign ownership and unchanged carry/speed/raw evidence assertions remain. `output/playwright/redesign/direction-attention-recovery.log`:2tests passed957ms. UI integration remains absent and deferred by UI owner until its page pass completes. This test does not prove the visible review handoff.

Integration contract: use exact `totalSessions` for the overall count, explicitly identify newest100 when truncated, and retain session-specific `href` links. Do not sum returned questionable-shot counts and label them an all-history total. Keep alignment and shot-review reasons distinct; never change shot eligibility solely to clear this attention group.

## Goal evidence recovery — 7 September 13:00

Extended the existing completed-practice regression: after exclusion/nonfinite metrics remove review evidence, restoring finite ball speed with absent carry/total returns review_ready and two eligible measured shots. Goal currentValue remains unchanged. `output/playwright/redesign/goal-evidence-recovery.log`: one targeted test passed842ms; nine other cases intentionally unselected, not newly verified. This exercises real persistence/action/loader transitions, not the complete browser handoff or metric-specific proof of goal improvement.

## Weekly PB confirmed defect — 7 September13:02

New disposable regression `tests/integration/weekly-personal-bests.test.ts` checks intermediate counts after100yd then NaN/Infinity/nonpositive values, before later120yd. Current query reports2 instead of1 at intermediate checkpoint: nonfinite data qualifies as a PB. Final count alone coincidentally matched2 because invalid maxima suppress the later valid PB. Initial fixture required source_raw_json; fixed test fixture and cleaned synthetic data each run. `weekly-pb-before.log` is an intentional failing regression. Proposed fix is positive finite carry filtering before window ranking. Runtime fix explicitly deferred by UI owner until UI pass complete; do not mark corrected.

## Weekly handoff trace refinement — 7 September13:04

The weekly strip itself provides source-session links and next-action text but no practice action. The adjacent Main blocker callout does have a working source-level contract: progressRecommendation builds /practice?source=progress&club=<normalized club type>, and both practice surfaces parse that club into focusClub. Therefore a claim that Progress has no practice handoff would be incorrect. The remaining distinction is weekly-specific source-session/window context: the adjacent recommendation derives from overall summary and its URL contains no sourceSessionId. Browser arrival and weekly-specific continuity remain unverified.

Prepared /tmp/fkh-weekly-pb-finite.patch with positive finite carry filtering before PB window aggregation. Patch remains unapplied during UI runtime freeze; failing regression remains authoritative.

## Onboarding trust source gap — 7 September13:12

getActivationJourney counts eligible shots by review/category status only; no finite positive measurement or association with an active mapped club is required. hasTrust combines any active club with12 eligible rows, and firstTrustedResult calls them usable measured shots. This source condition can establish trust from measurement-empty rows. Runtime reproduction and correction remain pending coordination. dismissWelcomeAction records dismissal, not checklist completion; UI must retain that distinction.

Onboarding defect reproduced: activation-measured-evidence.test.ts inserts12 included rows with no measurement values and one active mapped club; trust reports true instead of false. activation-evidence-before.log intentional failure575ms. Synthetic fixture cleaned. UI freeze respected; correction remains pending.

Activation correction draft prepared at /tmp/fkh-activation-measured.patch: require at least one positive finite carry/total/ball-speed/club-speed measurement and a current-user active mapped club within the eligible-count predicate. Existing review rules and12-row threshold unchanged. Draft not applied or validated, pending UI-pass completion; source/manual/future eligibility needs consideration before final implementation.

## Shared-round partial scorecard source gap

share/[token] getSharedRound currently sums present scores and passes total hole-entry count to differential calculation. A card with18 entries but missing scores can represent a partial sum as total. Before P88 acceptance, verify complete-score count, partial labelling and differential suppression. Token expiry/revocation/resource owner predicates are present; browser proof remains separate. UI owner notified; runtime unchanged.

Shared-round defect reproduced with actual page loader:18hole entries, one recorded score5, remaining scoresnull => handicapDifferential -67 instead ofnull. shared-round-partial-before.log intentional failing regression513ms; tests/integration/shared-round-partial.test.ts. Synthetic account/share/session cleaned. No runtime correction yet.

Shared-round fix contract: reuse roundCompletionIssue from src/lib/round-context.ts to reject missing/noninteger/nonpositive scores, duplicate/invalid hole numbers; differential additionally requires supported9/18-hole length via existing handicap normalization. Keep partial recorded score separately labelled. Current shared-account scorecardTotal checks only finite presence and is weaker than completion validator; do not copy it blindly. P88 UI owner will suppress incomplete differential presentation first; backend regression remains open until loader corrected.

## Three coordinated backend corrections — 7 September14:45

UI owner released the three runtime files after its shared UI pass. Applied positive finite carry filtering before weekly PB ranking; activation usable-shot count now requires a positive finite carry/total/ball-speed/club-speed value and an active club owned by the same golfer; shared round differential now requires the existing roundCompletionIssue validator to pass. Existing eligibility review rules, raw values, twelve-shot onboarding threshold and handicap normalization remain unchanged.

`three-backend-fixes.log`:3files/4tests PASS2.15s against disposable database. Covers invalid PB values without poisoning later PBs; measurement-empty onboarding rejection, measured recovery, inactive club and unrelated active club; partial scorecard and share access gating. Extended `shared-round-completion-final.log`:2PASS9.67s, complete18-hole par card produces0 and duplicate hole numbers produce null. Synthetic records cleaned. Full tsc exit0/empty three-backend-types.log and scoped lint exit0/empty three-backend-lint.log (before final test-only scorecard assertions). Previously recorded failing regressions are now corrected; connected UI handoffs and broad final acceptance remain outstanding.

## Direction workspace integration — 7 September 14:58

Verified current workspace calls getDirectionAttention and renders DirectionAttention. UI owner reports commit db78c91b. Read terminal direction-workspace-browser.log: 1 passed51.5s; peer reports both surfaces/six widths, owned/foreign isolation, exact session href and DB flag-clear recovery. This closes the previously definition-only integration gap. Actual session repair click and navigation beyond the newest100 remain outstanding; retain raw evidence and full counts.

## Comparison practice handoff — 7 September16:32

Current src/app/(app)/analyse/compare/page.tsx Build practice plan action links to bare /practice despite the selected sessionId/baselineSessionId/clubId/condition/period. The nearby copy promises turning this exact evidence set into a practice job. Selected club and source session are therefore lost at this entry point; existing source assertion requiring href=/practice is insufficient acceptance. UI owner should preserve supported destination context and verify arrival; period comparisons must not silently pretend to represent one session.

## Course records workspace controls — 7 September16:43

Current hub renders CourseRecordBoard from src/app/course-records/course-record-board.tsx. It provides query/proof filters, sorting, native table and phone details, but no saved views, column controls or CSV export were found in the route or board. Existing course-records/page-source.test.ts requires these previous capabilities, consistent with brief4 preserving saved views/column controls/exports. Do not remove those expectations merely to reconcile extracted markup. UI owner review/restoration needed; source absence is not a browser test.

Course-records follow-up16:45: the course-specific /courses/[courseId]/records route now renders CourseCategoryList, which likewise exposes search/sort/native table but no saved views, column controls or export. Preserve the existing course-specific source-test requirements pending restoration across both record boards. No runtime or test changes made for this family.

## Import preview controls — 7 September16:47

ShotPreview currently preserves filtered CSV export (exportFilteredShots), pagination, keyboard-focusable table and row correction. Existing saved-view and column controls (importShotPreviewSuggestedViews/DesktopTableWorkbenchControls) are absent from its replacement. Unlike course records, export itself is present. Keep shot-preview-source requirements open for UI review against brief4; do not claim accessibility loss simply from changed component names.

## Goals weekly commitment evidence — 7 September16:49

Current Goals page weekly query restricts owned sessions/shots and past7days plus review/category predicate, but its measurement gate is only OR isNotNull(carryYd,totalYd,ballSpeedMph). Zero, negative, NaN or Infinity measurements can therefore satisfy the source predicate and count toward qualifying measured sessions/rhythm. Requires disposable regression and positive finite measurement correction; not runtime-reproduced yet. Keep count validity separate from manual goal currentValue.

Goals weekly correction verified: goal-weekly-before.log actual page/DB returned1qualifying session4shots for0,-1,NaN,Infinity. Query now accepts only positive finite carry/total/ball speed. goal-weekly-fixed.log1passed1.17s verifies invalid0/0 then valid ball-speed1/1. Ownership/date/review predicates unchanged; original metric scope retained. Synthetic user cascade cleaned. Scoped lint and full TypeScript exit0. This is server-rendered page evidence, not full browser goal workflow proof.

## Comparison and record controls browser readback

Inspected comparison-practice-handoff-recovered.log terminal1passed49.8s and test source: actual click/arrival with source marker across2surfaces6widths; period/condition links omit sourceSessionId; no pageerrors, original shot rows unchanged. This closes this specific handoff gap, not every insight entry point. record-controls-browser-hydrated.log1passed1.5m; source checks both boards/surfaces6widths, real CSV download without hidden column, saved view restore at1440, reload column persistence and overflow/pageerrors. This supplies targeted restoration evidence; broader course journey remains separate.

### Dashboard aggregate recommendation attaches unverified session — 7 September17:16

Current dashboard page derives focus from coachPreview and club from bagPreview, then sets sourceSessionId to the latest range/practice session without club/supporting-evidence validation. A latest session for another club can therefore accompany an aggregate club recommendation. Existing ui-upgrade-dashboard.spec.ts covers responsive availability/readiness/comparison, not this handoff. Sent exact source locations and suggested aggregate-context handling to UI owner; no runtime edit or browser reproduction yet. Remains open pending correction and targeted mismatch coverage.

### Shared-account invalid longest-drive total corrected

Disposable DB regression reproduced longestDriveYd NaN from included Driver totals NaN/Infinity/-Infinity/0/-1 (shared-finite-before.log). Loader now limits maximum to positive finite totals; evidence eligibility and shot counts remain unchanged. shared-finite-fixed.log2passed2.69s verifies invalid-only maximum null, valid215.4yd wins when added, counts5then6, and existing owner/viewer/editor/coach membership isolation and revocation test. Scoped lint exit0. No UI acceptance claimed; shared ledger export/view controls restoration remains with UI owner.

### Shared-round companion boundary remains unresolved

Current shared-round-companion.tsx forwards directly to SharedRoundWorkbench, bringing desktop table controls into the companion graph and replacing the previous compact scorecard/disclosure. Source boundary test retained rather than waived. UI owner notified to restore focused companion behavior or provide explicit measured justification. Token expiry/revocation, resource/owner binding and incomplete-round differential gate remain present; this inspection is not fresh authorization runtime proof.

### Dashboard aggregate handoff correction verified

Read current route and ui-upgrade-dashboard-practice-handoff.spec.ts plus terminal dashboard-practice-handoff.log1passed37.7s. Older iron/newer Driver disposable fixture: two surfaces/six widths, actual Build focused practice click reaches Practice, source=dashboard/time=15 retained and no sourceSessionId, no pageerrors/overflow, original iron rows unchanged. Source guard additionally checks club and exact saved plan path (dashboard-handoff-contract.log1passed211ms,9unselected; lint0). Browser test does not assert selected club or exercise existing saved plan. The reported unrelated-session attachment is closed; broader dashboard acceptance remains open.

### Shared ledger controls restoration readback

Read current SharedSessionLedger, ui-upgrade-shared-account.spec.ts and shared-ledger-controls-final.log1passed1.4m (older shared-account-browser-final.log is failed, not the accepted run). Actual filtered CSV excludes hidden Type column, partial/foreign rows; saved query restores and persists reload; all selected session fields and incomplete score shown; revocation hides data; both surfaces/six widths. Reconciled shared source4tests, scoped formatting/lint0. Browser title-bound check is conditional when bounds exist; not a general header/accessibility proof. Missing shared controls gap closed for this tested scope.

### Best-shots selection regression exposed by expanded browser check

Expanded ui-upgrade-longest.spec.ts starts from Bag and checks every displayed club/metric, aria-pressed, selected evidence heading, unique club UUID and ledger metric across planned12contexts. Actual longest-all-clubs.log failed on first total selection: Driver235yd button stayed aria-pressed=false for10s. Inspected screenshot shows second Driver carry selected. Potential cause: BestShotsBoard carousel onSelected writes closed-over metric/params on select; HighlightCarousel scrollTo synchronization also emits select. This is a traced hypothesis, not fixed/root-cause proof. UI owner notified, no runtime edit; test remains failing. Test lint0. Fixture login health returned200; browser process terminal and released.

### Shared-round companion evidence readback

Reviewed current independent companion composition and the actual browser test. shared-round-companion-native.log terminates1passed6.2s; earlier visible.log failed and is not accepted evidence. Coverage spans both surfaces and six widths: partial-score warning, missing differential, all18hole identities, manual-putt provenance, disclosed equipment note, read-only controls, noindex, overflow and revocation. Source composition4passed151ms. This closes the restored companion composition gap within that scope; expiry and foreign resource ownership are not newly browser-tested by this case.

### Open extracted-register controls audit

Current AdminSystemRegister (`src/app/admin/admin-system-register.tsx`), AdminBillingLedger (`src/app/admin/admin-billing-ledger.tsx`) and AdminChallengeBoardRegister (`src/app/admin/admin-challenge-board-register.tsx`) preserve search/sort and row details but lack previous export, saved-view and column controls. Root inspected current component implementations; respective source table/export assertions remain failing. UI owner retains runtime work. Restore controls with real filtered dataset and test export contents, saved-view reload and column persistence before acceptance. Session HistoryToolbar (`src/app/sessions/history-toolbar.tsx`) similarly lacks focus selection while existing URL focus/highlight remains. BestShots selection race and TrainingLoad mobile deferral remain separately open.

### Import companion startup dependency gap

`src/app/(app)/import/import-companion-csv-page.tsx` now mounts `ImportWorkspaceChoice`. `src/app/import/import-workspace-choice.tsx` statically imports both CompanionRangeImport and ImportForm and mounts both behind hidden attributes on first render. Full mobile workflow access is retained, but prior isolated/light companion startup no longer holds. Source failures remain open. Measure production cost; consider loading full workflow on first explicit selection and retaining it afterward so draft preservation does not require eager mounting both. Do not remove mobile workflow capabilities to satisfy the former assertion.

### Best-shots selection regression retest

longest-all-clubs-retest.log1passed18.6s on3116 after UI callback/current-URL fix. Expanded test starts from Bag entry, loops every fixture club for carry and total across two surfaces/six widths, checks aria-pressed, club-specific evidence heading, URLclub UUID/metric, unique club IDs, ledger metric, source tab and carry reload. Original failing selection reproduction now passes. Root viewed390pxcompanion screenshot: captured carousel in transition; this image is not settled-animation visual acceptance. Current evidence closes explicit record-selection race within tested interactions; continuous autoplay/drag/motion stability requires its own acceptance.

### Partners register retained controls missing

Current src/app/partners/partner-register.tsx retains search/ownership/order/details but has no export, saved views or column controls. Brief line123 requires retained capabilities; prior sponsor pipeline contract specified them. Source regression now follows extracted register and fails at absent DesktopTableWorkbenchControls (partners-controls-current.log). Restore equivalent working export of filtered rows, persisted views and columns with browser readback; do not invent commercial approval/plan data absent from source. Sent to UI owner. Root made no component edits.

### Consolidated current verification gates (18:49 local)

- Retained table controls missing in admin system, billing, challenge registers; Partners sponsor register; and both ModerationQueue instances (report/event). Restore exports, saved views and columns with filtered-row export and persisted selection readback. Moderation must preserve exact reviewed record IDs, open-only selection, pending close lock, result count and audit history. UI owner acknowledged all.
- Production snapshot /private/tmp/fkh-budget-20260907-183257 build passed; budgets-refresh.log fails13 unchanged route budgets. Largest overruns: session detail1202/913KiB, Sessions1189/938, Bag1352/1104, Today1214/1035. Analyzer includes deferred modules, so graph size is not per-surface first-download evidence. Authenticated production waterfall awaits disposable authenticated setup; production E2E bypass deliberately disabled.
- Latest full unit snapshot full-unit-third-recheck.json:2695pass88fail149pending. Later targeted reconciliation logs supersede individual assertions only, not full count. UNIT_FAILURE_QUEUE is generated from that exact snapshot.
- Import eager dual-workspace mounting and TrainingLoad mobile history mounting remain open. Challenges/Tournaments status navigation needs draft-preservation readback. Handicap mobile hierarchy/request-surface loading assertions remain unresolved.
- Best Shots explicit club/metric selection and History Focus selection/reload/clear now pass scoped browser matrices. Hosted preview predates those fixes; hosted acceptance is separate.

### System register control gap closed in fixture scope

Expanded admin-system-restored-retry.log terminalPASS1.4m: both surfaces/six sizes verify filtered CSV, optional column hiding, saved view restoration and reload. Existing provider-unknown and dated audit evidence checks retained. Admin system is removed from missing-controls list; billing/challenge registers, Partners and moderation queues remain outstanding. No hosted deployment claim.
