/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS package integrity test. */
"use strict";
// Independent bounded regression matrix; no baseline regeneration.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const installedRoot = path.dirname(require.resolve("picomatch"));
const sourceRoot = __dirname;
const pkg = require(path.join(installedRoot, "package.json"));
assert.equal(pkg.name, "@forekinghell/nonrecursive-glob-compat");
for (const file of [
  "index.js",
  "package.json",
  "README.md",
  "LICENSE",
  "lib/scan.js",
  "lib/constants.js",
  "lib/utils.js",
]) {
  assert.equal(
    fs.readFileSync(path.join(installedRoot, file), "utf8"),
    fs.readFileSync(path.join(sourceRoot, file), "utf8"),
    "installed source mismatch: " + file,
  );
  const tar = spawnSync(
    "tar",
    [
      "-xOf",
      path.join(sourceRoot, `forekinghell-nonrecursive-glob-compat-${pkg.version}.tgz`),
      "package/" + file,
    ],
    { encoding: "utf8" },
  );
  assert.equal(tar.status, 0);
  assert.equal(
    tar.stdout,
    fs.readFileSync(path.join(sourceRoot, file), "utf8"),
    "archive mismatch: " + file,
  );
}
assert.deepEqual(fs.readdirSync(path.join(installedRoot, "lib")).sort(), [
  "constants.js",
  "scan.js",
  "utils.js",
]);
const scannerBaseline = JSON.parse(
  fs.readFileSync(path.join(__dirname, "scan-baseline.json"), "utf8"),
  (key, value) => (value === null && ["depth", "maxDepth"].includes(key) ? Infinity : value),
);
const candidatePath = process.argv[2] || require.resolve("picomatch");
const candidate = require(candidatePath);
const matrix = require("./match-baseline.json");
for (const { pattern, opts, expected } of matrix.cases)
  assert.deepEqual(
    matrix.paths.filter(candidate(pattern, opts)),
    expected,
    "whole matched-file set: " + pattern,
  );
const cases = [
  ["trailing globstar base", "src/**/*.test.ts/**", {}, "src/lib/a.test.ts", true],
  ["trailing globstar repeated", "src/**/**", {}, "src", true],
  ["negated class literal posix", "[!a]", { posix: true }, "[!a]", true],
  ["default bang bracket yes", "[!a]", {}, "a", true],
  ["default bang bracket no", "[!a]", {}, "b", false],
  ["literal bracket pipe", "[a|b]", {}, "[a|b]", true],
  ["Vite noext bracket", "[ab].js", { noextglob: true }, "a.js", true],
  ["Vite noext bracket nested", "src/[ab].js", { noextglob: true }, "src/a.js", true],
  ["Vite noext posix", "[[:digit:]].js", { noextglob: true }, "1.js", true],
  ["Vite noext literal extglob", "+(a|b).js", { noextglob: true }, "a.js", false],
  ["negative extglob", "!(a)", {}, "a", false],
  ["negative extglob suffix", "!(foo).js", {}, "foo.js", false],
  ["negative extglob positive", "!(foo).js", {}, "bar.js", true],
  ["plain negation", "!foo", {}, "foo", false],
  ["double negation", "!!foo", {}, "foo", true],
  ["hash is literal", "#foo", {}, "#foo", true],
  ["watch returnIndex", "**/*.js", { returnIndex: false }, "src/x.js", true],
  ["watch dot off", "**/*", { returnIndex: false }, ".env", false],
  ["deny environment", "**/.env", { matchBase: false, nocase: true, dot: true }, "/app/.env", true],
  [
    "deny env nested",
    "**/.env.*",
    { matchBase: false, nocase: true, dot: true },
    "/app/.env.local",
    true,
  ],
  [
    "deny cert",
    "**/*.{crt,pem}",
    { matchBase: false, nocase: true, dot: true },
    "/app/key.PEM",
    true,
  ],
  [
    "deny git",
    "**/.git/**",
    { matchBase: false, nocase: true, dot: true },
    "/app/.git/config",
    true,
  ],
  [
    "deny safe file",
    "**/.env.*",
    { matchBase: false, nocase: true, dot: true },
    "/app/env.ts",
    false,
  ],
  [
    "ignore node_modules",
    "**/*.js",
    { dot: true, noextglob: true, ignore: ["**/node_modules/**"] },
    "node_modules/a/index.js",
    false,
  ],
  ["ignore empty", "**/*.js", { dot: true, noextglob: true, ignore: [] }, "src/index.js", true],
  ["array OR", ["foo", "!bar"], {}, "foo", true],
  ["array OR negative", ["foo", "!bar"], {}, "bar", false],
  ["empty patterns", [], {}, "foo", false],
  ["empty input", "**", {}, "", false],
  ["leading dot pattern", "./a/*", {}, "a/b", true],
  ["leading dot input", "./a/*", {}, "./a/b", false],
  ["duplicate slash", "a/*", {}, "a//b", false],
  ["trailing slash exact", "a/?", {}, "a/b/", false],
  ["trailing slash star", "a/*", {}, "a/b/", true],
  ["posix digit", "[[:digit:]]", { posix: true }, "1", true],
  ["posix digit reject", "[[:digit:]]", { posix: true }, "x", false],
  ["character class", "a/[bc]", {}, "a/b", true],
  ["brace", "a/{b,c}", {}, "a/c", true],
  ["safe repeated extglob", "+(ab|cd)", {}, "abcdab", true],
  ["matchBase", "*.js", { matchBase: true }, "src/x.js", true],
];
let failures = [];
const resolvedVersion = require(
  require.resolve("minimatch/package.json", { paths: [candidatePath] }),
).version;
if (resolvedVersion !== "11.0.9")
  failures.push("Unsafe/unreviewed matcher version: " + resolvedVersion);
for (const [name, pattern, opts, input, expected] of cases) {
  try {
    assert.equal(candidate(pattern, opts)(input), expected, name);
  } catch (e) {
    failures.push(name + ": " + e.message);
  }
}
try {
  assert.throws(() => candidate("[[:alpha:]]", { posix: false }), /unsupported/i);
} catch (e) {
  failures.push("Explicit unsupported POSIX false boundary: " + e.message);
}
const scans = [
  "src/**/*.js",
  "./src/*",
  "a/!(b)/c",
  "a/[bc]",
  "a/{b,c}/x",
  "a/\\*/x",
  "!a/**",
  "a//b",
  "/tmp/a/**",
];
for (const pattern of scans)
  for (const opts of [
    {},
    { parts: true, scanToEnd: true },
    { tokens: true, parts: true, scanToEnd: true },
  ]) {
    try {
      assert.deepEqual(
        candidate.scan(pattern, opts),
        scannerBaseline[JSON.stringify([pattern, opts])],
        "scan " + pattern,
      );
    } catch (e) {
      failures.push("scan " + pattern + ": " + e.message);
    }
  }
for (const pattern of ["+(*a)", "+(a*b)", "+(ab|abab)", "+(@(ab|abab))", "*(*(a|aa))b"]) {
  const r = spawnSync(
    process.execPath,
    [
      "-e",
      `const m=require(${JSON.stringify(candidatePath)})(${JSON.stringify(pattern)});for(const n of [42,1000,10000]) m('ab'.repeat(n)+'!');`,
    ],
    { encoding: "utf8", timeout: 3000 },
  );
  if (r.error || r.status !== 0)
    failures.push("adversarial " + pattern + ": " + (r.error?.code || r.stderr));
}
try {
  assert.throws(() => candidate.makeRe("*.js"), /cannot|unsupported|RegExp/i);
} catch (e) {
  failures.push("makeRe must explicitly fail: " + e.message);
}
assert.throws(() => candidate("a".repeat(4097)), /4096/);
assert.throws(() => candidate(Array(257).fill("*")), /Too many/);
assert.throws(() => candidate.scan("a".repeat(4097)), /4096/);
assert.throws(() => candidate("a".repeat(4000))("x".repeat(4000)), /work budget/);
assert.throws(() => candidate("{a,{b,c}}"), /Nested brace/);
assert.throws(() => candidate("{1..999999999}"), /ranges/);
assert.throws(() => candidate("*")("x".repeat(65537)), /too long/);
assert.throws(() => candidate("+(".repeat(33) + "a" + ")".repeat(33)), /nesting/);
assert.throws(() => candidate("{a,b}".repeat(9)), /expansion/);
assert.throws(() => candidate("**/!(foo)"), /unsupported/);
assert.throws(() => candidate("a", { contains: true }), /Unsupported/);
const discovery = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    `import {glob} from 'tinyglobby';import fs from 'node:fs';import assert from 'node:assert/strict';const expected=fs.readdirSync('src',{recursive:true}).filter(p=>/\\.test\\.tsx?$/.test(p)).map(p=>'src/'+p).sort();const actual=(await glob(['src/**/*.test.ts','src/**/*.test.tsx'],{dot:true})).sort();assert.deepEqual(actual,expected);console.log(actual.length);`,
  ],
  { encoding: "utf8", timeout: 10000 },
);
assert.equal(discovery.status, 0, discovery.stderr);
assert(Number(discovery.stdout) > 600, "Unexpected loss of source test discovery");
console.log(
  JSON.stringify(
    { resolvedVersion, cases: cases.length, scanCases: scans.length * 3, failures },
    null,
    2,
  ),
);
process.exitCode = failures.length ? 1 : 0;
