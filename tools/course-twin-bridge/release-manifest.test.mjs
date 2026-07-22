import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertReleaseTrust,
  createReleaseManifest,
  describeArtifact,
  serializeReleaseManifest,
  signReleaseManifest,
  verifyReleaseManifest,
} from "./release-manifest.mjs";

test("release manifests hash artifacts and verify an Ed25519 signature", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fkh-bridge-release-"));
  const executable = join(directory, "forekinghell-course-twin-bridge");
  await writeFile(executable, "signed executable bytes");
  const artifact = await describeArtifact(executable);
  const manifest = createReleaseManifest({
    version: "0.2.0",
    channel: "beta",
    platform: "darwin",
    architecture: "arm64",
    nodeVersion: "24.15.0",
    artifacts: [artifact],
    codeSignature: "developer-id",
    generatedAt: "2026-07-22T18:00:00.000Z",
  });
  const serialized = serializeReleaseManifest(manifest);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const signature = signReleaseManifest(serialized, privateKey);

  assert.equal(artifact.bytes, 23);
  assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
  assert.equal(verifyReleaseManifest(serialized, signature, publicKey), true);
  assert.equal(verifyReleaseManifest(`${serialized} `, signature, publicKey), false);
});

test("public release channels fail closed when release trust credentials are absent", () => {
  assert.doesNotThrow(() => assertReleaseTrust({ channel: "local", platform: "darwin", env: {} }));
  assert.throws(
    () => assertReleaseTrust({ channel: "beta", platform: "darwin", env: {} }),
    /MANIFEST_PRIVATE_KEY/,
  );
  assert.throws(
    () =>
      assertReleaseTrust({
        channel: "stable",
        platform: "darwin",
        env: {
          FKH_RELEASE_MANIFEST_PRIVATE_KEY: "key",
          FKH_MACOS_SIGN_IDENTITY: "Developer ID",
        },
      }),
    /NOTARY_PROFILE/,
  );
});
