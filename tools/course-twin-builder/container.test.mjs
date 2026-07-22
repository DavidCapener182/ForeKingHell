import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("builder image pins Node and installs the executable terrain dependencies", async () => {
  const [dockerfile, packageJson] = await Promise.all([
    readFile(new URL("Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("package.json", root), "utf8").then(JSON.parse),
  ]);

  assert.match(dockerfile, /^FROM node:24\.15\.0-bookworm-slim/m);
  assert.match(dockerfile, /overturemaps==1\.0\.1/);
  assert.match(dockerfile, /npm ci --omit=dev --ignore-scripts/);
  assert.match(dockerfile, /USER node/);
  assert.equal(packageJson.dependencies.geotiff, "^3.0.5");
  assert.equal(packageJson.dependencies.proj4, "^2.20.9");
  assert.equal(packageJson.devDependencies.geotiff, undefined);
});
