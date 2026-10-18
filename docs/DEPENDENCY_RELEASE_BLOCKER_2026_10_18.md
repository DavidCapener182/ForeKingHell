# Dependency release repair — 18 October 2026

## Current status

David approved the dedicated dependency repair on 18 October 2026. The repaired graph passes the unchanged gate with **0 high and 0 critical findings**; npm still reports 11 moderate findings. No exception, scanner policy or CI threshold was relaxed. The baseline diagnosis and approval plan below are retained as historical context.

The bounded repair removes the unused shadcn development CLI, preserves its MIT-licensed Tailwind CSS locally, patches sharp to 0.35.5 and source-map-js to 1.2.2, and replaces only pinned Next ESLint's directory-glob dependency with the reviewed local adapter. Its source/archive identity and upstream caller are checked. All 234 original directory fixtures and 35 original Next diagnostics remain unchanged; additional missing-parent normalization and hidden-symlink regressions preserve lint coverage. Independent review identified those two edge cases and both were corrected. Excessive glob nesting/expansion fails explicitly rather than silently dropping roots.

The pre/post lint profiles and diagnostic probes match byte-for-byte for every previously tracked file. The added tooling and tests use the existing profiles; no original file lost rules or lint coverage. Preserved shadcn CSS has identical canonical parser output to the original package stylesheet after formatting. Focused image decoding and scorecard tests pass. The secret scanner finds no candidate or feature secrets, and detects a deliberately invalid synthetic positive control. No PR101 product or migration work was merged.

## Historical gate and baseline

Before remediation, the repository release gate `node scripts/dependency-audit.mjs` exited **1**. It does not permit high/critical findings outside its narrowly scoped exception. The existing braces exception expired on 10 October 2026 and has not been extended.

This was independently reproduced using untouched `package.json` and `package-lock.json` extracted from remote main `bb43ba147ef5ff53334692f1ad375ff7c9d624f5`, with `npm audit --package-lock-only --json`. No dependencies were installed for that baseline audit. At baseline, the working lockfile and main lockfile had identical Git blob identity `5bc6cb85e58d0636a84d51b58f875a117c0beab3`. The initial feature checkpoint changed neither package files nor audit policy/workflows; the separately approved repair changes package files only.

The clean-main report contains **27 findings: 15 moderate, 11 high, 1 critical**. These are advisory/dependency findings, not proof that every package is reachable in the deployed application.

## Blocking packages

| Packages in report                                                                                                              | Severity   | Root advisory / minimum published fix                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `proxy-addr`                                                                                                                    | Critical   | [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), IPv4-mapped IPv6 trust subnet spoofing; affected below 2.0.8                                                     |
| `sharp`                                                                                                                         | High       | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), librsvg dependency; affected below 0.35.5                                                                        |
| `source-map-js`                                                                                                                 | High       | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), indexed source-map denial of service; affected below 1.2.2                                                       |
| `@modelcontextprotocol/sdk`                                                                                                     | High       | [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h), OAuth authorization-server credential forwarding; affected 1.12.0 through 1.30.1                                 |
| `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next`, `@ts-morph/common`, `ts-morph`, `shadcn` | High chain | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), recursion denial of service in braces <=3.0.3. **No patched braces version** is listed in the reviewed advisory. |

GitHub advisory pages were checked during diagnosis. The npm report's suggested `eslint-config-next` 14.2.35 and `shadcn` 1.0.0 changes are major downgrades, not automatically safe fixes for this Next 16 application. No `npm audit fix --force`, dependency downgrades, exclusions or security threshold reductions were performed.

## Separate remediation decision

Simple patched-package/transitive updates should be assessed separately, including runtime image processing and toolchain regressions. They cannot alone clear the unpatched braces chain.

Open PR101 (`feat/pro-trial-round-plan`) already contains dependency/lint remediation, including removal of the development generator, a sharp patch, and a custom verified directory-glob compatibility adapter in commit `f7d66c62`. It also contains unrelated Pro trials, round planning, import allowance, billing logic and migration work. **It must not be merged wholesale as a shortcut for this release.**

Safe next decision: explicitly authorize a dedicated dependency-only port/review from the existing repair work, excluding unrelated product/database/security-policy changes, then run clean install, lint-profile/adapter equivalence, scanner controls, full tests/build/browser checks and the unchanged audit gate. No automatic audit fix or blanket PR merge is proposed. Main publication is retained behind that gate; the benchmark/page work can be committed locally and remains reviewable.

### Proposed bounded implementation after approval

1. Keep the finished feature/page patch intact. Extract only the dependency/tooling subset from the existing repair; do not merge or cherry-pick whole PR101 product commits.
2. Patch `sharp` and its matching override to the published fixed 0.35.5 line. Refresh the unchanged semver-compatible transitive lock entries for `source-map-js`, `proxy-addr` and MCP SDK where still required. Remove the unused development-only `shadcn` CLI dependency after verifying no runtime import relies on it; keep the repository's existing generated UI files.
3. For the no-patch braces chain remaining inside Next's lint plugin, review the existing `f7d66c62` directory-only compatibility package under `tools/eslint-fast-glob-compat/`. Its replacement is **specific to `@next/eslint-plugin-next@16.3.8`**, not a global fast-glob substitution. Reuse its fail-closed caller/API checks, pinned package/source identities, 234 glob fixtures and real Next rule fixtures. Inspect and reproduce its package tarball from the checked-in source before trusting the lockfile artifact.
4. Compare actual before/after lint configuration and diagnostics across the current 104-route repository, not an older snapshot. All existing rule profiles and diagnostics must remain equivalent. Do not remove a rule, mute a diagnostic, replace the whole framework lint configuration or accept a broad picomatch substitution as equivalence.
5. Regenerate a minimal package lock with a clean install; verify `npm ls`, the unchanged dependency gate, adapter installation/source/caller checks, lint equivalence, secret scanning with a synthetic positive control, formatting, types, full unit suite, migration-file checks, production build, route budgets and responsive fixtures. No production database action is needed.
6. Independently review the exact dependency-only diff, then integrate it with the finished feature/page changes and publish only when release gates pass. Verify remote main SHA and actual CI/deployment outcomes afterward.

The proposed port does **not** authorize PR101 billing/trials/import allowance/round-plan code, migration 0062, production SQL, Stripe calls, new access, broad scanner exclusions or extending expired exceptions. If remediation needs any of those, stop that specific action and request separate approval. Historic lint evidence in PR101 generated secret-scanner false positives; do not copy its unrelated historical fingerprint exceptions or weaken scanning to make a new port pass.

## Actions not performed

No production migration, database import/rewrite, secret change, new persistent access, security exception extension or PR101 merge occurred. No successful remote release can be claimed from local checks.
