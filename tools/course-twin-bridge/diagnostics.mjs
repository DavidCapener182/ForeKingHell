import { COURSE_TWIN_BRIDGE_VERSION } from "./version.mjs";

export function createBridgeDiagnosticReport({
  addresses,
  state,
  capturedAt = new Date().toISOString(),
  platform = process.platform,
  architecture = process.arch,
  nodeVersion = process.versions.node,
}) {
  return {
    reportVersion: 1,
    product: "ForeKingHell Course Twin Bridge",
    bridgeVersion: COURSE_TWIN_BRIDGE_VERSION,
    protocolVersion: 1,
    capturedAt,
    runtime: { platform, architecture, nodeVersion },
    network: {
      loopbackOnly: true,
      host: addresses.host,
      gsProPort: addresses.gsProPort,
      browserPort: addresses.browserPort,
      officialGsProPort: addresses.gsProPort === 921,
    },
    state: {
      status: state.status,
      startedAt: state.startedAt,
      gsProConnected: state.gsProConnected,
      browserClients: state.browserClients,
      lastDeviceId: safeDeviceLabel(state.lastDeviceId),
      lastShotAt: state.lastShotAt,
      shotsAccepted: state.shotsAccepted,
      shotsRejected: state.shotsRejected,
      clubShotsAccepted: state.clubShotsAccepted ?? 0,
      playerUpdatesSent: state.playerUpdatesSent ?? 0,
    },
    privacy: {
      containsPairingCode: false,
      containsSessionToken: false,
      containsRawShotPayload: false,
    },
  };
}

export async function readLocalBridgeDiagnosticReport({
  browserPort,
  fetchImpl = fetch,
  timeoutMs = 2_000,
}) {
  try {
    const response = await fetchImpl(`http://127.0.0.1:${browserPort}/diagnostics`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Bridge returned ${response.status}.`);
    return await response.json();
  } catch {
    return createBridgeDiagnosticReport({
      addresses: { host: "127.0.0.1", gsProPort: null, browserPort },
      state: {
        status: "not-running",
        startedAt: null,
        gsProConnected: false,
        browserClients: 0,
        lastDeviceId: null,
        lastShotAt: null,
        shotsAccepted: 0,
        shotsRejected: 0,
        clubShotsAccepted: 0,
        playerUpdatesSent: 0,
      },
    });
  }
}

function safeDeviceLabel(value) {
  if (typeof value !== "string") return null;
  return value.replace(/[^a-zA-Z0-9 ._()-]/g, "").slice(0, 80) || null;
}
