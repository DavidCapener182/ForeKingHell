# UI upgrade progress

## Scope and branch

All four root specifications are accessible. Inventory validated: **492 component entries,98routes** with separate desktop/mobile status. Stay on `upgrade/untitled-ui-migration`. No main merge or production deployment.

Fully accepted component IDs: **none yet**. The CSV is authoritative; `ForeKingHell-completion-tracker.xlsx` is its generated review view. Partial verification is not completion. Existing completed work and IDs have been preserved.

## Work order update

User direction: implement the remaining UI changes first; defer broader integration, full acceptance matrices and non-UI work until that pass is delivered. Keep quick changed-scope checks and truthful separate implementation/verification statuses. Do not repeatedly rerun unchanged shared checks.

## Current component and next component

Current: **P35 Import C01–C10 and P36 result C01–C04 UI pass implemented**, with verification gaps tracked. Next: **P02-C01 Today**, then P02-C02–C09 and remaining route order. User explicitly prioritises completing UI implementation before broad verification/non-UI follow-up. Progress commit **891672ea** contains19owned files; shared commit **8a970995** contains49owned files.

G01–G14 inherited acceptance remains incomplete. G01/G02/G03/G05/G06/G07/G10 and Progress have narrower passing evidence; G04/G08/G09/G11/G12/G13/G14 still need broader consumer/state checks recorded per row. Do not reset or mark them Passed based on route-level screenshots.

## Implemented changes

- G01/G05/G06 earlier commits `65cea2ac`: single semantic header adapter, wide companion rendering, role-aware searchable More and preserved surface-switch context. Specification checkpoint `ab8ca3f9`.
- Shared commit **8a970995**: unified command catalogue/entry points, collapsible navigation, native confirmation/form recovery, React Aria1.21.1 form adapters, bounded dialogs, server-confirmed notification reads, responsive saved-view toolbar, chart table/CSV semantics, visible detail close, error/loading recovery, truthful offline status and PWA update guards, normal-flow notices. Staged49owned paths using baseline-to-current patches; other agent's changes excluded.
- P01: compact Progress header/current composite explanation, no reconstructed historical score; four URL-controlled tabs on both surfaces; scored-round information preserved under Performance. Owner-filtered dated carry/total/control evidence with search, filters, explicit unavailable club/date/measure states, source counts, selectable sessions and table. Weekly direction ranks measured control across adjacent seven-day windows with source links. One existing practice priority supplies both surfaces' recommendation. All goals retain saved figures/evidence. Existing training calculations/renderers gain URL range/date inspection/table. Chronological timeline preserves repeated names by event ID, supports filter/load-more, labels loaded coverage and unknown goal edit dates.

Progress source changes: `src/app/(app)/progress/page.tsx`, `src/app/progress/progress-companion.tsx`, new `src/app/progress/progress-{navigation,tabs,snapshot,comparison,comparison-data,recommendation,timeline,load-history}.ts(x)`, namespaced `src/components/untitled-ui/tabs.tsx` and CSS, `src/lib/progress-data.ts`, `src/lib/weekly-change-review-data.ts`. Existing golf calculation functions remain unchanged.

## Checks and evidence

Evidence under `output/playwright/ui-upgrade/` is local/gitignored.

- **151shared tests in31files** pass in an isolated snapshot of the shared commit. Isolated `next typegen` then `tsc --noEmit` passed; initial missing PageProps/RouteContext was absent generated metadata, not a source defect. Logs `staged-shared-unit.log`, `staged-shared-types.log`.
- Integrated **157tests/32files** passed. Final Progress Tabs extraction TypeScript and scoped lint passed; no repeat full browser matrix was requested after extraction. Logs `shared-wide-unit.log`, `progress-types.log`, `shared-lint-final.log`, `progress-lint.log`.
- Standards-mode form/notification/Progress controls: **3tests passed26.5s**, `fixtures-final-browser.log`, all six required sizes. Covers confirmed submitter semantics, invalid/pending/failure/cancel/focus, final-field footer clearance, Aria values, notification read failure/retry/server confirmation, zero/steady,carry versus total,date drawer/source table/long names. Representative screenshots inspected.
- Progress actual app **1test passed49.2s**, `progress-final-browser.log`: both surfaces×six sizes, all four tabs, query preservation, Back/Forward/reload, keyboard Arrow/Home, one Progress h1, no horizontal page overflow. **16scoped axe scans with0violations** at1440/360.48tab captures plus12overview captures in `progress-final/`; representative desktop/mobile/Load/Timeline images inspected. Axe found invalid detail markup in a definition list; fixed to semantic dd and rerun passed.
- Timeline final fixture **1test passed7.7s**, `progress-controls-final-browser.log`:6sizes, duplicate titles retained by ID,12→15load-more,8filteredPractice events, long content; dark CSS200%zoom layout checked at1440/360. Native browser zoom remains outstanding.
- Fixture diagnosis: missing doctype caused quirks-mode Select displacement by scroll offset. Corrected fixture HTML and reran. No speculative placement workaround retained. App Next pages already use standards mode.
- Screenshot review found the PWA notice outside shell content behind chrome; moved inside shell. Initial unknown queue check no longer appears as a storage failure. Later app screenshots reflect this fix.
- No full production build, remote CI, real-account mutations, physical Safari/software keyboard/offline replay/payment/invitation checks claimed.

## Outstanding defects and blockers

- Component-specific blockers and separate viewport evidence are in the CSV. Every row still needs full acceptance; **none is Passed**.
- Native browser200%zoom, physical keyboard/safe-area and screen-reader interaction, comprehensive themes and complete empty/loading/service-error/permission combinations remain outstanding. Automated accessible names/axe are narrower evidence.
- P01 composite history does not exist: the permitted current-snapshot/baseline-needed alternative is implemented. Goal-specific edit timestamps do not exist; unrelated preference update dates are no longer presented as goal history. Timeline exposes the loaded year and latest six saved bag snapshots rather than claiming complete lifetime history.
- G08 all consuming table/export scopes; G09 all specialist selection/failure/reduced-motion flows; G11 all91boundary states; G12/G13 real offline owner/replay/update matrix; G14 queued/long/dynamic announcements remain incomplete.
- Paid Untitled advanced examples have no established entitlement. Exact checked references and accessible compositions are recorded in `docs/ui-upgrade/untitled-ui-register.md`; no paid installation is claimed.

## Coordination and resume instructions

1. Read this checkpoint, CSV and master contract. Run `git branch --show-current`, `git status --short`, `python3 scripts/ui-upgrade.py status` and `validate`. Preserve all dirty work. Do not stage the whole tree.
2. Other thread **01a077ea-7dd8-7ef2-979b-944425998882**, title **Redesign ForeKingHell experience**, owns round/strategy/earlier redesign changes, `mobile-controls.tsx` keepMounted, scorecard JSON puttsSource, and shot correction propagation/services/actions/tests. Contact it before any shared-file edit or live fixture browser run. It is not staging. All UI/component ownership has now transferred here, including their existing Round/Play/Strategy/Today/Practice/Bag changes. They retain backend services/actions/behavior tests and coordinate API changes. Preserve every pre-existing UI change.
3. Resume P02 Today UI from the first unfinished component. Progress is committed891672ea. Import and Result code is applied with separate evidence below. Preserve earlier partial verification; broad remaining acceptance is queued after the UI pass.
4. Localhost3000 is real/read-only;3116 is the existing disposable fixture app with `.next-e2e`. Never restart either or build into their dist directories. `PLAYWRIGHT_BASE_URL=http://localhost:3116 PLAYWRIGHT_E2E_AUTH_BYPASS=1` selects the authorised local app fixture. Isolated component fixtures need BASE_URL only.
5. Relevant tests: `tests/e2e/ui-upgrade-progress.spec.ts`, `ui-upgrade-progress-controls.spec.ts`, `ui-upgrade-forms.spec.ts`, `ui-upgrade-notifications.spec.ts`. Run changed scope; use unique output directories. Update each component row after changes/evidence, then validate inventory.
6. Refresh Excel using `/Users/davidcapener/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/export-ui-upgrade-workbook.py`. Do not hand-edit the generated workbook or replace the CSV with it.
7. Continue Today→remaining route coverage UI. Then return to acceptance/back-end gaps. No merge/deploy. Overall completion requires all492entries to pass both applicable viewport requirements and acceptance checks.

Historical checkpoint retained at `docs/ui-upgrade/checkpoint-before-progress-2026-09-06.md`. Owned baselines: `/tmp/fkh-upgrade-forms-baseline`, `/tmp/fkh-upgrade-navigation-baseline`, `/tmp/fkh-upgrade-shared-baseline`, `/tmp/fkh-upgrade-progress-baseline`. These identify ours versus concurrent working-tree hunks; do not apply an old baseline wholesale over current source.

## Import / Result UI pass, 7 September

- P35C01–C10: namespaced React Aria radio cards, compact shared header, truthful current-operation steps; file picker/limits/errors/retry/queue; session date and type/unit adapters; mapping samples/required/duplicate feedback; all-shot pagination/search/detail/correction; OCR acknowledgement and touch hole navigation; pending-safe contextual checklist; separate responsive history. Full phone workflow is accessible alongside the existing quick range import; both drafts remain mounted during switches. Existing parser/server actions/override permissions retained. The chosen session date is passed explicitly rather than silently overwritten by the detected title date.
- P36C01–C04: missing/invalid/inaccessible result recovery, compact receipt header, saved-session trust counts and review links instead of account-wide quality claims, all matched plan decisions and mobile target/result disclosures, contextual practice links. Earlier companion pattern/verdict work preserved.
- Import smoke:1passed1.6m, both surfaces × six requested sizes, no pageerrors or page overflow, sample5shots,save disabled.24captures in `output/playwright/ui-upgrade/import-ui-smoke`; representative360preview inspected. Initial top-named captures after first size retain prior scroll; test now scrolls to top for future captures. No mutation proof inferred. Mapping disclosure and quick-picker error refinements followed that smoke; no full rerun yet.
- TypeScript/scoped lint passed for Import and Result; latest small refinements need final changed-scope check. Logs `import-ui-types.log`, `import-ui-lint.log`, `result-ui-types.log`, `result-ui-lint.log`. Result browser fixture matrix outstanding.
- A failed CSV write was recovered from the latest generated492-row workbook while preserving the current218-row prefix; inventory/counts reconciled and known latest P45-C06 mobile evidence restored. Future writes are assembled and validated in memory before atomic replacement. No completed status reset.
- Import owned baseline: `/tmp/fkh-upgrade-import-baseline`; preserve its pre-existing companion changes when staging. Root tracker and workbook now distinguish31implemented/partial entries from16in progress and445not started;0fullyPassed.
