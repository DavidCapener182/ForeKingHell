import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const glob = require(
  require.resolve("fast-glob", {
    paths: [join(process.cwd(), "node_modules/@next/eslint-plugin-next")],
  }),
);
const root = mkdtempSync(join(tmpdir(), "fkh-glob-parity-"));
try {
  for (const dir of [
    "apps/site/pages",
    "apps/admin/src/pages",
    "apps/a.b/pages",
    "apps/.hidden/pages",
    "packages/ui",
    "apps/space name/pages",
  ])
    mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, "apps/site/pages/index.tsx"), "");
  const patterns = [
    "apps/*",
    "apps/**",
    "apps/{site,admin}",
    "apps/+(site|admin)",
    "apps/space name",
    "apps/.*",
    "apps/no-match",
    "apps/site",
    "apps/*/pages",
    "!apps/site",
  ];
  console.log(
    JSON.stringify(
      patterns.map((pattern) => ({
        pattern,
        result: glob
          .globSync(join(root, pattern), { onlyDirectories: true })
          .map((path) => path.replace(root, "ROOT"))
          .sort(),
      })),
      null,
      2,
    ),
  );
} finally {
  rmSync(root, { recursive: true });
}
