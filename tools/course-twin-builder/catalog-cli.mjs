#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { buildUkFirstWaveCatalog } from "./catalog.mjs";

const limitArgument = process.argv.indexOf("--limit");
const outputArgument = process.argv.indexOf("--output");
const limit = limitArgument >= 0 ? Number(process.argv[limitArgument + 1]) : 20;
const output = resolve(
  outputArgument >= 0
    ? process.argv[outputArgument + 1]
    : "tools/course-twin-builder/catalog/uk-first-wave.json",
);
if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
  throw new Error("--limit must be an integer from 1 to 50");
}
const catalog = await buildUkFirstWaveCatalog({ limit });
if (catalog.selected < limit) {
  throw new Error(`Only ${catalog.selected} mapped courses met the first-wave threshold`);
}
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify({ ...catalog, generatedAt: new Date().toISOString() }, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`Wrote ${catalog.selected} Course Twin candidates to ${output}\n`);
