import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

const entries = fs
  .readFileSync(".gitleaksignore", "utf8")
  .split("\n")
  .filter((line) => line && !line.startsWith("#"));
assert.equal(entries.length, 128);
assert.equal(new Set(entries).size, entries.length);
const allowed = new Map([
  [
    "129cab9d57583189f7612e7dee245813d450222d",
    new Set(["docs/evidence/lint/before.json", "docs/evidence/lint/after.json"]),
  ],
  [
    "f7d66c62b61ca3a2190e2261052382b59840f237",
    new Set([
      "docs/evidence/compat/before-inventory.json",
      "docs/evidence/compat/after-inventory.json",
    ]),
  ],
]);
const documents = new Map();
for (const fingerprint of entries) {
  const [commit, file, rule, number, extra] = fingerprint.split(":");
  assert.equal(extra, undefined);
  assert(allowed.get(commit)?.has(file));
  assert.equal(rule, "generic-api-key");
  const ref = `${commit}:${file}`;
  if (!documents.has(ref)) {
    const text = execFileSync("git", ["show", ref], { encoding: "utf8" });
    const document = JSON.parse(text);
    for (const [hash, profile] of Object.entries(document.profiles))
      assert.equal(createHash("sha256").update(JSON.stringify(profile)).digest("hex"), hash);
    documents.set(ref, { text, document });
  }
  const { text, document } = documents.get(ref);
  const line = text.split("\n")[Number(number) - 1];
  const match = /^\s*"([^"]+)": "([a-f0-9]{64})",?$/.exec(line);
  assert(match, `Fingerprint must refer only to a profile assignment: ${fingerprint}`);
  assert.equal(document.scope[match[1]], match[2]);
  assert(document.profiles[match[2]]);
}
console.log(
  `Verified ${entries.length} exact historical fingerprints: every value is a recomputed ESLint profile SHA-256; no credential/rule/path exclusions.`,
);
