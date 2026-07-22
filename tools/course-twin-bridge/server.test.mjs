import test from "node:test";
import assert from "node:assert/strict";
import { connect as connectTcp } from "node:net";
import { once } from "node:events";
import WebSocket from "ws";
import { CourseTwinBridge } from "./server.mjs";
import { PairingAuthority } from "./security.mjs";

test("pairs an allowed browser and relays only a normalised accepted shot", async (context) => {
  const origin = "http://localhost:3210";
  const bridge = new CourseTwinBridge({
    gsProPort: 0,
    browserPort: 0,
    allowedOrigins: new Set([origin]),
    pairingAuthority: new PairingAuthority({ pairingCode: "654321" }),
  });
  await bridge.start();
  context.after(() => bridge.stop());

  const health = await fetch(`http://127.0.0.1:${bridge.addresses.browserPort}/health`, {
    headers: { Origin: origin },
  });
  assert.equal(health.status, 200);
  assert.equal((await health.json()).gsProConnected, false);

  const diagnostics = await fetch(`http://127.0.0.1:${bridge.addresses.browserPort}/diagnostics`, {
    headers: { Origin: origin },
  });
  assert.equal(diagnostics.status, 200);
  assert.match(diagnostics.headers.get("content-disposition"), /course-twin-bridge\.json/);
  assert.deepEqual((await diagnostics.json()).privacy, {
    containsPairingCode: false,
    containsSessionToken: false,
    containsRawShotPayload: false,
  });

  const deniedPair = await fetch(`http://127.0.0.1:${bridge.addresses.browserPort}/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.invalid" },
    body: JSON.stringify({ code: "654321" }),
  });
  assert.equal(deniedPair.status, 403);

  const pair = await fetch(`http://127.0.0.1:${bridge.addresses.browserPort}/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ code: "654321" }),
  });
  assert.equal(pair.status, 200);
  const session = await pair.json();
  assert.ok(session.token.length >= 32);

  const webSocket = new WebSocket(
    session.wsUrl,
    ["fkh-course-twin-v1", `fkh-token.${session.token}`],
    { origin },
  );
  const firstMessagePromise = nextJsonMessage(webSocket);
  await once(webSocket, "open");
  context.after(() => webSocket.close());
  const firstMessage = await firstMessagePromise;
  assert.equal(firstMessage.type, "bridge-status");

  const launchMonitor = connectTcp(bridge.addresses.gsProPort, "127.0.0.1");
  await once(launchMonitor, "connect");
  context.after(() => launchMonitor.destroy());
  launchMonitor.write(JSON.stringify(validShot()));

  const [response, relayed] = await Promise.all([
    nextTcpJson(launchMonitor),
    nextJsonMessage(webSocket),
  ]);
  assert.equal(response.Code, 200);
  assert.equal(relayed.type, "shot");
  assert.equal(relayed.source, "gspro-open-connect-v1");
  assert.deepEqual(relayed.shot.ball, {
    speedMph: 143.2,
    horizontalLaunchDeg: -1.8,
    verticalLaunchDeg: 13.4,
    spinAxisDeg: 4.2,
    totalSpinRpm: 2675,
    carryDistanceYards: 238.4,
  });
  assert.equal("BallData" in relayed.shot, false);

  webSocket.send(JSON.stringify({ type: "player", handed: "RH", club: "DR" }));
  const playerResponse = await nextTcpJson(launchMonitor);
  assert.equal(playerResponse.Code, 201);
  assert.deepEqual(playerResponse.Player, { Handed: "RH", Club: "DR" });
});

test("rejects a WebSocket without a valid pairing token", async (context) => {
  const origin = "http://localhost:3210";
  const bridge = new CourseTwinBridge({
    gsProPort: 0,
    browserPort: 0,
    allowedOrigins: new Set([origin]),
  });
  await bridge.start();
  context.after(() => bridge.stop());

  const webSocket = new WebSocket(
    `ws://127.0.0.1:${bridge.addresses.browserPort}/shots`,
    ["fkh-course-twin-v1", "fkh-token.invalid"],
    { origin },
  );
  const [error] = await once(webSocket, "error");
  assert.match(error.message, /401/);
});

function nextJsonMessage(webSocket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for WebSocket message")),
      2_000,
    );
    webSocket.once("message", (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString("utf8")));
    });
  });
}

function nextTcpJson(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for TCP response")), 2_000);
    socket.once("data", (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString("utf8")));
    });
  });
}

function validShot() {
  return {
    DeviceID: "Rapsodo MLM2PRO",
    Units: "Yards",
    ShotNumber: 7,
    APIversion: "1",
    BallData: {
      Speed: 143.2,
      SpinAxis: 4.2,
      TotalSpin: 2675,
      HLA: -1.8,
      VLA: 13.4,
      CarryDistance: 238.4,
    },
    ClubData: {
      Speed: 101.5,
      AngleOfAttack: 2.1,
      FaceToTarget: -0.7,
      Lie: 59,
      Loft: 10.5,
      Path: 1.4,
      SpeedAtImpact: 100.9,
      VerticalFaceImpact: 2,
      HorizontalFaceImpact: -1,
      ClosureRate: 120,
    },
    ShotDataOptions: {
      ContainsBallData: true,
      ContainsClubData: true,
      IsHeartBeat: false,
      IsBallDetected: true,
      IsReady: true,
    },
  };
}
