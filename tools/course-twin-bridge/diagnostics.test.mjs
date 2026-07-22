import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createBridgeDiagnosticReport, readLocalBridgeDiagnosticReport } from "./diagnostics.mjs";
import { COURSE_TWIN_BRIDGE_VERSION } from "./version.mjs";

test("diagnostic reports describe loopback health without credentials or raw shots", () => {
  const report = createBridgeDiagnosticReport({
    addresses: { host: "127.0.0.1", gsProPort: 921, browserPort: 9791 },
    state: {
      status: "running",
      startedAt: "2026-07-22T18:00:00.000Z",
      gsProConnected: true,
      browserClients: 1,
      lastDeviceId: "Rapsodo MLM2PRO<script>",
      lastShotAt: "2026-07-22T18:01:00.000Z",
      shotsAccepted: 2,
      shotsRejected: 1,
    },
    capturedAt: "2026-07-22T18:02:00.000Z",
    platform: "darwin",
    architecture: "arm64",
    nodeVersion: "24.15.0",
  });

  assert.equal(report.network.loopbackOnly, true);
  assert.equal(report.network.officialGsProPort, true);
  assert.equal(report.state.lastDeviceId, "Rapsodo MLM2PROscript");
  assert.deepEqual(report.privacy, {
    containsPairingCode: false,
    containsSessionToken: false,
    containsRawShotPayload: false,
  });
  assert.doesNotMatch(JSON.stringify(report), /654321|token-value|BallData/);
});

test("diagnostic command returns a safe stopped report when the bridge is unavailable", async () => {
  const report = await readLocalBridgeDiagnosticReport({
    browserPort: 9791,
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
  });
  assert.equal(report.state.status, "not-running");
  assert.equal(report.network.host, "127.0.0.1");
});

test("bridge version remains aligned with the application release", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
  assert.equal(COURSE_TWIN_BRIDGE_VERSION, packageJson.version);
});
