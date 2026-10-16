import { ESLint } from "eslint";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
const eslint = new ESLint();
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => /\.(?:[cm]?[jt]sx?)$/.test(f));
const profiles = {},
  scope = {};
for (const file of files) {
  const config = await eslint.calculateConfigForFile(file);
  if (!config) {
    scope[file] = null;
    continue;
  }
  const inventory = {
    rules: Object.fromEntries(
      Object.entries(config.rules ?? {})
        .filter(([, v]) => v[0] !== 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    parser: config.languageOptions.parser.meta,
    parserOptions: config.languageOptions.parserOptions,
    globals: config.languageOptions.globals,
    settings: config.settings,
    plugins: Object.keys(config.plugins ?? {}).sort(),
  };
  const hash = createHash("sha256").update(JSON.stringify(inventory)).digest("hex");
  profiles[hash] = inventory;
  scope[file] = hash;
}
const probes = {
  nextImage: 'export default function Page(){return <img src="/x.png" alt="x"/>}',
  a11y: 'export default function Page(){return <button aria-label="" onClick={()=>{}}> </button>}',
  hooks:
    'import {useState} from "react";export default function Page({ok}:{ok:boolean}){if(ok)useState(0);return null}',
  typescript: "const unused: any = 1;export default function Page(){return null}",
  scripts: "const value = 1; console.log(value);",
};
const diagnostics = {};
for (const [name, text] of Object.entries(probes)) {
  const filePath =
    name === "scripts" ? "scripts/lint-parity-probe.mjs" : "src/app/lint-parity-probe.tsx";
  const [result] = await eslint.lintText(text, { filePath });
  diagnostics[name] = result.messages.map(({ ruleId, severity, message, line, column }) => ({
    ruleId,
    severity,
    message,
    line,
    column,
  }));
}
fs.writeFileSync(process.argv[2], JSON.stringify({ profiles, scope, diagnostics }, null, 2) + "\n");
console.log(
  JSON.stringify({
    files: files.length,
    profiles: Object.keys(profiles).length,
    enabledRuleCounts: Object.values(profiles).map((p) => Object.keys(p.rules).length),
    diagnostics,
  }),
);
