import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), "fkh-next-rule-"));
try {
  for (const entry of [
    "apps/site/pages/about.tsx",
    "apps/admin/src/pages/admin.tsx",
    "packages/web/pages/contact.tsx",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, entry)), { recursive: true });
    fs.writeFileSync(path.join(root, entry), "export default function Page(){return null}");
  }
  const configurations = [
    root + "/apps/site",
    root + "/apps/*",
    root + "/apps/**",
    root + "/apps/{site,admin}",
    [root + "/apps/site", root + "/apps/admin"],
    root.replaceAll("/", "\\") + "\\apps\\*",
    path.relative(process.cwd(), root) + "/apps/*",
  ];
  const results = [];
  for (let i = 0; i < configurations.length; i++) {
    const eslint = new ESLint({
      overrideConfig: { settings: { next: { rootDir: configurations[i] } } },
    });
    for (const href of [
      "/about",
      "/admin",
      "/contact",
      "/outside",
      "https://example.invalid/about",
    ]) {
      const [result] = await eslint.lintText(
        `export default function Page(){return <a href="${href}">Open</a>}`,
        { filePath: "src/app/lint-compat-probe.tsx" },
      );
      results.push({
        configuration: i,
        href,
        messages: result.messages.map(({ ruleId, severity, message, line, column }) => ({
          ruleId,
          severity,
          message,
          line,
          column,
        })),
      });
    }
  }
  const snapshot = path.join(dir, "next-baseline.json");
  if (process.argv[2] === "--record") {
    fs.writeFileSync(snapshot, JSON.stringify(results, null, 2) + "\n");
    console.log(`Recorded ${results.length} original Next rule diagnostics`);
  } else {
    assert.deepEqual(results, JSON.parse(fs.readFileSync(snapshot, "utf8")));
    assert(
      results.some((r) => r.messages.some((m) => m.ruleId === "@next/next/no-html-link-for-pages")),
    );
    console.log(
      `Passed ${results.length} Next rule diagnostics across literal/glob/array/Windows-normalised roots`,
    );
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
