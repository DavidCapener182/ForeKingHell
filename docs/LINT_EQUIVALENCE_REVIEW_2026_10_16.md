# Bounded lint-equivalence investigation

> Historical checkpoint: the later approved compatibility adapter and schema readiness guards supersede the audit/release blockers below. See `LINT_COMPATIBILITY_RELEASE_2026_10_16.md`. Original investigation results remain recorded.

Base: feature checkpoint `48c1c619`. No rule, threshold, advisory exception, file pattern, permission or secret was changed.

## Exact inventories

`docs/evidence/lint/before.json` records every enabled rule with severity/options, parser metadata/options, globals, settings, plugin names, and the resolved profile/ignored state of all 2,363 tracked JavaScript/TypeScript files. `after.json` records the same inventory under the candidate described below. They are byte-for-byte equal. The resolved TypeScript/TSX profile has 86 enabled rules; the JavaScript profile has 82. Both include all 22 enabled Next rules, 20 TypeScript rules, 17 React rules, 16 React Hooks/compiler rules, six JSX accessibility rules and one import rule. The TypeScript/TSX profile additionally enables four core rules. The configuration itself and all file/ignore scopes stayed unchanged. The inventory includes negative Next-image, conditional-hook and explicit-any/unused-variable probes with unchanged diagnostics; its exploratory accessibility probe did not trigger a diagnostic and is not claimed as runtime accessibility coverage.

Reproduce an inventory with `node scripts/verification/lint-inventory.mjs /tmp/lint-inventory.json`. The recorded file set is anchored to the base commit; newly added verification scripts naturally join the same unchanged ESLint scope once committed. Full inventories, rather than only counts, allow review of each rule and every existing file's profile.

## Candidate and decisive regression

The installed Next ESLint plugin uses `fast-glob` only in `dist/utils/get-root-dirs.js`, calling `globSync(pattern, { onlyDirectories: true })` for an explicit `settings.next.rootDir` string or array. The default root bypasses this call. A scoped npm override replaced just this dependency with `npm:tinyglobby@0.2.17`, leaving the entire official Next/React/TS/accessibility config intact. No vendored rule was introduced. Tinyglobby is maintained and documents `globSync`, and npm supports replacing a transitive dependency with another package through overrides.

The candidate removed the five high audit findings (11 moderate remained), and preserved the current default-root inventory and probe diagnostics. **It failed root-directory glob parity**, so it was rejected and package.json/lockfile were restored with `npm ci --ignore-scripts`.

`root-globs-before.json` and `root-globs-candidate.json` contain the observed results on identical temporary directory trees. Representative failures:

- Exact directory `apps/site`: fast-glob returns only the site root; tinyglobby also returns its `pages` descendant.
- Brace/extglob `apps/{site,admin}` / `apps/+(site|admin)`: candidate returns descendants in addition to roots.
- Absolute input: candidate returns cwd-relative paths with trailing separators; fast-glob retains absolute paths.
- Recursive glob `apps/**`: candidate additionally includes the parent apps directory.

These affect Next's internal-page discovery and therefore the behavior of `@next/next/no-html-link-for-pages` under supported rootDir configurations. An alias that merely turns the audit green would conceal a non-equivalent dependency. Adapting defaults would require changing the upstream call or maintaining a local adapter/fork; that is not a configuration-only equivalent.

## Decision and approval-ready alternatives

The current upstream constraint is `eslint-config-next@16.3.8` → `@next/eslint-plugin-next@16.3.8` → `fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3` (GHSA-vfj7-8cjw-p6xm). The checked latest maintained Next plugin16.4.2 still pins fast-glob3.3.1. Latest fast-glob3.3.3 and micromatch4.0.8 still retain braces3.0.3; no patched braces release was observed. Dropping Next's plugin would remove22 checks; a formatter or general linter does not supply equivalent framework rules.

1. Recommended: retain the complete current lint coverage and blocked release until a maintained upstream release fixes or replaces the glob dependency; then rerun both inventories, root-discovery regression fixtures and all release gates.
2. Broader work requiring an explicit maintenance decision: maintain a narrowly scoped compatibility adapter/fork with upstream rule parity, provenance, root-discovery tests (including Windows paths/symlinks/hidden folders), and a documented owner/update process. This can potentially preserve behavior but is not a currently supported upstream lint-config migration. No such fork was added or approved here.

No safe supported equivalent was established. The original failing audit gate remains in force, and pushing remains blocked.

Primary references: [Next rootDir ESLint settings](https://nextjs.org/docs/app/api-reference/config/eslint#specifying-a-root-directory-within-a-monorepo), [tinyglobby source and usage](https://github.com/SuperchupuDev/tinyglobby), [npm overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides). Installed package source and recorded npm metadata provide the version-specific dependency evidence.
