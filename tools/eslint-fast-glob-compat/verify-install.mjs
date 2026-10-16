import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const local = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pluginFile = require.resolve("@next/eslint-plugin-next");
const pluginRequire = createRequire(pluginFile);
const installed = pluginRequire.resolve("fast-glob");
assert(
  installed.startsWith(path.join(process.cwd(), "node_modules") + path.sep),
  "Never fall back to an ancestor's node_modules",
);
assert.equal(
  fs.readFileSync(installed, "utf8"),
  fs.readFileSync(path.join(local, "index.js"), "utf8"),
  "Installed archive must contain the reviewed source",
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(path.dirname(installed), "package.json"), "utf8"),
);
assert.equal(manifest.name, "@forekinghell/eslint-fast-glob-compat");
assert.equal(manifest.version, "1.0.2");
const expected = JSON.parse(fs.readFileSync(path.join(local, "caller-sha256.json"), "utf8"));
const pluginManifest = JSON.parse(
  fs.readFileSync(path.join(path.dirname(pluginFile), "../package.json"), "utf8"),
);
assert.equal(
  pluginManifest.version,
  expected.plugin,
  "Review compatibility before upgrading Next lint tooling",
);
const caller = fs.readFileSync(path.join(path.dirname(pluginFile), "utils/get-root-dirs.js"));
assert.equal(
  createHash("sha256").update(caller).digest("hex"),
  expected.getRootDirsSha256,
  "Review upstream rootDir signature/normalisation changes",
);
assert.equal(typeof pluginRequire("fast-glob").globSync, "function");
console.log("Installed adapter source, package identity and pinned Next caller match");
