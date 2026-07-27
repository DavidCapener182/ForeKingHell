export function evaluateHardwareAcceptance({ baseline, final, expectedDevice, minimumShots }) {
  const acceptedShots = Math.max(0, final.state.shotsAccepted - baseline.state.shotsAccepted);
  const rejectedShots = Math.max(0, final.state.shotsRejected - baseline.state.shotsRejected);
  const clubShots = Math.max(
    0,
    (final.state.clubShotsAccepted ?? 0) - (baseline.state.clubShotsAccepted ?? 0),
  );
  const playerUpdates = Math.max(
    0,
    (final.state.playerUpdatesSent ?? 0) - (baseline.state.playerUpdatesSent ?? 0),
  );
  const checks = [
    check("official-loopback-port", final.network.loopbackOnly && final.network.officialGsProPort),
    check("launch-monitor-connected", final.state.gsProConnected === true),
    check("browser-paired", final.state.browserClients > 0),
    check(
      "expected-device",
      normalise(final.state.lastDeviceId).includes(normalise(expectedDevice)),
      final.state.lastDeviceId,
    ),
    check("minimum-shots", acceptedShots >= minimumShots, `${acceptedShots}/${minimumShots}`),
    check("club-data", clubShots >= 1, String(clubShots)),
    check("player-handedness-and-club-response", playerUpdates >= 1, String(playerUpdates)),
    check("no-rejected-shots", rejectedShots === 0, String(rejectedShots)),
  ];
  return {
    passed: checks.every((item) => item.passed),
    checks,
    counters: { acceptedShots, rejectedShots, clubShots, playerUpdates },
  };
}

export async function captureHardwareAcceptance({
  bridgePort = 9791,
  expectedDevice = "Rapsodo MLM2PRO",
  minimumShots = 5,
  durationMs = 300_000,
  pollMs = 1_000,
  fetchImpl = fetch,
  now = () => new Date(),
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  const startedAt = now();
  const baseline = await readDiagnostics(bridgePort, fetchImpl);
  let final = baseline;
  let result = evaluateHardwareAcceptance({ baseline, final, expectedDevice, minimumShots });
  const deadline = startedAt.getTime() + durationMs;
  while (!result.passed && now().getTime() < deadline) {
    await wait(Math.min(pollMs, Math.max(0, deadline - now().getTime())));
    final = await readDiagnostics(bridgePort, fetchImpl);
    result = evaluateHardwareAcceptance({ baseline, final, expectedDevice, minimumShots });
  }
  return {
    reportVersion: 1,
    product: "ForeKingHell Course Twin Bridge physical acceptance",
    expectedDevice,
    startedAt: startedAt.toISOString(),
    completedAt: now().toISOString(),
    bridgeVersion: final.bridgeVersion,
    result,
    privacy: {
      containsPairingCode: false,
      containsSessionToken: false,
      containsRawShotPayload: false,
      containsShotMetrics: false,
    },
  };
}

async function readDiagnostics(port, fetchImpl) {
  const response = await fetchImpl(`http://127.0.0.1:${port}/diagnostics`, {
    signal: AbortSignal.timeout(2_500),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Bridge diagnostics returned ${response.status}.`);
  return response.json();
}

function check(name, passed, evidence = null) {
  return { name, passed: Boolean(passed), evidence };
}

function normalise(value) {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}
