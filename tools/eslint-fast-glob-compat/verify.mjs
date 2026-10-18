import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as adapter from "./index.js";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), "fkh-eslint-parity-"));
const cwd = process.cwd();
const referenceRoot =
  process.env.FKH_LINT_REFERENCE_PATH ??
  path.dirname(
    require.resolve("fast-glob/package.json", {
      paths: [path.join(cwd, "node_modules/@next/eslint-plugin-next")],
    }),
  );
const reference = require(referenceRoot);
if (["--record", "--compare-live"].includes(process.argv[2])) {
  const referenceManifest = require(path.join(referenceRoot, "package.json"));
  assert.equal(
    referenceManifest.name,
    "fast-glob",
    "Live comparison/capture must use original fast-glob, never the replacement adapter",
  );
  assert.equal(referenceManifest.version, "3.3.1", "The recorded reference is fast-glob 3.3.1");
}
const snapshot = path.join(__dirname, "baseline.json");
const leaves = [
  "apps/site/pages/blog",
  "apps/admin/src/pages",
  "apps/space name/pages",
  "apps/a.b/pages",
  "apps/a[b]/pages",
  "apps/foo(bar)/pages",
  "apps/a{b}/pages",
  "apps/bang!/pages",
  "apps/a+b/pages",
  "apps/.hidden/pages",
  ".hidden-app/pages",
  "apps/site/.cache/deep",
  "apps/site/node_modules/lib",
  "apps/site.js/pages",
  "packages/ui/src",
  "packages/web/pages",
  "range/app1/pages",
  "range/app2/pages",
  "range/app03/pages",
  "range/app04/pages",
  "aliases",
];
try {
  for (const dir of leaves) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, "apps/file.js"), "fixture");
  fs.symlinkSync(
    path.join(root, "apps/site"),
    path.join(root, "aliases/site"),
    process.platform === "win32" ? "junction" : "dir",
  );
  fs.symlinkSync(
    path.join(root, "absent"),
    path.join(root, "aliases/broken"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const roots = ["apps", "packages", "range", "aliases"];
  const suffixes = [
    "",
    "/",
    "/*",
    "/**",
    "/**/",
    "/*/**",
    "/**/**",
    "/*/pages",
    "/**/pages",
    "/**/pages/**",
    "/.*",
    "/{site,admin}",
    "/{site,admin}/**",
    "/+(site|admin)",
    "/!(site)",
    "/@(site|admin)",
    "/[sa]*",
    "/?ite",
    "/{site,}/pages",
    "/{site,{admin,a.b}}/**",
  ];
  const patterns = [
    ...roots.flatMap((base) => suffixes.map((suffix) => base + suffix)),
    ...leaves,
    ".",
    "./",
    "*",
    "**",
    "**/",
    "**/pages",
    "**/.cache/**",
    "!apps/site",
    "!apps/*",
    "apps//site",
    "./apps/site",
    "apps/not-found",
    "apps/*.{js,ts}",
    "range/app{1..4}",
    "range/app{03..04}",
    "range/app{1..4}/**",
    "apps/a\\[b\\]",
    "aliases/*",
    "aliases/**",
  ];
  // Next normalises backslashes before passing a string to globSync.
  const cases = [...new Set(patterns)].flatMap((pattern) => [
    pattern,
    "@ROOT/" + pattern.replace(/^\.\//, ""),
  ]);
  process.chdir(root);
  const portable = (entries) =>
    entries
      .map((entry) => entry.replaceAll("\\", "/").replace(root.replaceAll("\\", "/"), "@ROOT"))
      .sort();
  const results = cases.map((label) => {
    const pattern = label.replace("@ROOT", root.replaceAll("\\", "/")).replace(/\\/g, "/");
    return {
      pattern: label,
      matches: portable(
        (process.argv[2] === "--record" ? reference : adapter).globSync(pattern, {
          onlyDirectories: true,
        }),
      ),
    };
  });
  if (process.argv[2] === "--record") {
    fs.writeFileSync(snapshot, JSON.stringify(results, null, 2) + "\n");
    console.log(`Recorded ${results.length} original fast-glob directory fixtures`);
  } else if (process.argv[2] === "--compare-live") {
    const expected = cases.map((label) => ({
      pattern: label,
      matches: portable(
        reference.globSync(label.replace("@ROOT", root.replaceAll("\\", "/")).replace(/\\/g, "/"), {
          onlyDirectories: true,
        }),
      ),
    }));
    let failures = 0;
    for (let i = 0; i < results.length; i++)
      if (JSON.stringify(results[i]) !== JSON.stringify(expected[i])) {
        console.log(
          JSON.stringify({
            pattern: results[i].pattern,
            expected: expected[i].matches,
            actual: results[i].matches,
          }),
        );
        failures++;
      }
    assert.equal(failures, 0, `${failures} directory glob differences`);
  } else {
    assert.deepEqual(results, JSON.parse(fs.readFileSync(snapshot, "utf8")));
    assert.throws(
      () => adapter.globSync("apps/*", { onlyDirectories: true, dot: true }),
      /contract changed/,
    );
    assert.throws(
      () => adapter.globSync(["apps/*"], { onlyDirectories: true }),
      /contract changed/,
    );
    console.log(
      `Passed ${results.length} directory-glob fixtures including absolute/relative roots, braces, ranges, extglobs, hidden folders, spaces and symlinks`,
    );
  }
} finally {
  process.chdir(cwd);
  fs.rmSync(root, { recursive: true, force: true });
}
