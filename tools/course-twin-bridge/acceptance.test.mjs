import assert from "node:assert/strict";
import test from "node:test";

import { evaluateHardwareAcceptance } from "./acceptance.mjs";

const diagnostics = {
  network: { loopbackOnly: true, officialGsProPort: true },
  state: {
    gsProConnected: true,
    browserClients: 1,
    lastDeviceId: "Rapsodo MLM2PRO",
    shotsAccepted: 10,
    shotsRejected: 2,
    clubShotsAccepted: 5,
    playerUpdatesSent: 3,
  },
};

test("physical acceptance requires fresh shots, club data and browser player feedback", () => {
  const result = evaluateHardwareAcceptance({
    baseline: diagnostics,
    final: {
      ...diagnostics,
      state: {
        ...diagnostics.state,
        shotsAccepted: 15,
        clubShotsAccepted: 10,
        playerUpdatesSent: 4,
      },
    },
    expectedDevice: "MLM2PRO",
    minimumShots: 5,
  });
  assert.equal(result.passed, true);
  assert.deepEqual(result.counters, {
    acceptedShots: 5,
    rejectedShots: 0,
    clubShots: 5,
    playerUpdates: 1,
  });
});

test("physical acceptance fails closed for a wrong device or rejected shot", () => {
  const result = evaluateHardwareAcceptance({
    baseline: diagnostics,
    final: {
      ...diagnostics,
      state: {
        ...diagnostics.state,
        lastDeviceId: "Simulator",
        shotsAccepted: 15,
        shotsRejected: 3,
        clubShotsAccepted: 10,
        playerUpdatesSent: 4,
      },
    },
    expectedDevice: "MLM2PRO",
    minimumShots: 5,
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((item) => item.name === "expected-device").passed, false);
  assert.equal(result.checks.find((item) => item.name === "no-rejected-shots").passed, false);
});
