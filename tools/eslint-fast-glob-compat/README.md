# ForeKingHell Next ESLint directory compatibility

Owner: repository maintainer. Node24 only. This private adapter replaces only the `globSync(string, {onlyDirectories:true})` call made by pinned `@next/eslint-plugin-next@16.3.8/dist/utils/get-root-dirs.js`. It is not a general fast-glob implementation. Unknown signatures/options fail loudly and require review.

Pattern compilation uses maintained picomatch4.0.7 and brace-expansion5.0.12; directory enumeration uses Node's filesystem API. It preserves original directory-only filtering, brace expansion, directory-or-directory/slash matching, lexical symlink paths, root formatting and glob-parent exclusion. Missing roots/broken links are ignored; other filesystem errors and symlink cycles fail explicitly. Enumeration order is unspecified and is immaterial to Next's URL membership rule.

234 recorded original fixtures and35 actual Next rule diagnostics cover the reviewed behavior. Baselines were generated against fast-glob3.3.1 before substitution. `verify.mjs --record` and `verify-next.mjs --record` are investigation-only capture modes: never regenerate baselines from the adapter to make a failing upgrade pass. Ordinary checks omit `--record`. The full existing rule/file inventory must also remain identical.

A local npm tarball is used because nested directory overrides produced invalid relative symlinks with npm11. The tarball contains this readable source and manifest, not a compiled implementation. Tests compare the installed source with this file and check caller/package identity, preventing a stale archive or fallback to an ancestor's node_modules. Rebuild with `npm pack ./tools/eslint-fast-glob-compat --pack-destination ./tools/eslint-fast-glob-compat --ignore-scripts`, then run all compatibility checks, npmci, audit and normal release gates.

When a supported upstream release removes the vulnerable chain, prefer removing this adapter, its scoped override and direct peer pins after proving rule and root-discovery parity. Do not broaden this adapter for another caller without a separate review.
