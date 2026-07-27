import type {
  CourseTwinHole,
  CourseTwinPoint,
  CourseTwinReplayShot,
} from "@/lib/course-twin-contract";

export type CourseTwinBridgeStatus = {
  bridge: string;
  protocolVersion: number;
  status: "running" | "stopped";
  gsProConnected: boolean;
  browserClients: number;
  lastDeviceId: string | null;
  lastShotAt: string | null;
  shotsAccepted: number;
  shotsRejected: number;
};

export type CourseTwinBridgeDiagnosticReport = {
  reportVersion: 1;
  product: "ForeKingHell Course Twin Bridge";
  bridgeVersion: string;
  protocolVersion: 1;
  capturedAt: string;
  runtime: { platform: string; architecture: string; nodeVersion: string };
  network: {
    loopbackOnly: true;
    host: "127.0.0.1" | "::1";
    gsProPort: number | null;
    browserPort: number;
    officialGsProPort: boolean;
  };
  state: {
    status: "running" | "stopped" | "not-running";
    startedAt: string | null;
    gsProConnected: boolean;
    browserClients: number;
    lastDeviceId: string | null;
    lastShotAt: string | null;
    shotsAccepted: number;
    shotsRejected: number;
  };
  privacy: {
    containsPairingCode: false;
    containsSessionToken: false;
    containsRawShotPayload: false;
  };
};

export type CourseTwinBridgeShotEvent = {
  type: "shot";
  eventId: string;
  receivedAt: string;
  source: "gspro-open-connect-v1";
  shot: {
    kind: "shot";
    deviceId: string;
    shotNumber: number;
    receivedUnits: "Yards" | "Meters";
    ballDetected: boolean;
    ready: boolean;
    ball: {
      speedMph: number;
      horizontalLaunchDeg: number;
      verticalLaunchDeg: number;
      spinAxisDeg: number;
      totalSpinRpm: number;
      carryDistanceYards: number | null;
    };
    club: Record<string, number | null> | null;
  };
};

export type CourseTwinBridgeEvent =
  | CourseTwinBridgeShotEvent
  | { type: "bridge-status"; connected: boolean; launchMonitorConnected: boolean }
  | { type: "launch-monitor-status"; connected: boolean; deviceId?: string };

export class CourseTwinBridgeClient {
  #baseUrl: string;
  #socket: WebSocket | null = null;
  #onEvent: (event: CourseTwinBridgeEvent) => void;
  #onDisconnect: (reason: string) => void;

  constructor({
    baseUrl = "http://127.0.0.1:9791",
    onEvent,
    onDisconnect,
  }: {
    baseUrl?: string;
    onEvent: (event: CourseTwinBridgeEvent) => void;
    onDisconnect: (reason: string) => void;
  }) {
    this.#baseUrl = baseUrl;
    this.#onEvent = onEvent;
    this.#onDisconnect = onDisconnect;
  }

  async detect(signal?: AbortSignal) {
    const response = await fetch(`${this.#baseUrl}/health`, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("Course Twin Bridge did not return a healthy response.");
    return parseBridgeStatus(await response.json());
  }

  async pair(code: string) {
    const response = await fetch(`${this.#baseUrl}/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      if (response.status === 401)
        throw new Error("That pairing code is not valid. Check the bridge window and try again.");
      if (response.status === 429)
        throw new Error("Too many pairing attempts. Wait one minute and try again.");
      throw new Error("Course Twin could not pair with the local bridge.");
    }

    const session = parsePairingSession(await response.json());
    await this.#connect(session.wsUrl, session.token);
    return session.expiresAt;
  }

  async diagnostics() {
    const response = await fetch(`${this.#baseUrl}/diagnostics`, { cache: "no-store" });
    if (!response.ok) throw new Error("Course Twin Bridge diagnostics are unavailable.");
    return parseBridgeDiagnostics(await response.json());
  }

  sendPlayer(handed: "RH" | "LH", club: string) {
    if (this.#socket?.readyState !== WebSocket.OPEN) return false;
    this.#socket.send(JSON.stringify({ type: "player", handed, club: gsProClubCode(club) }));
    return true;
  }

  disconnect() {
    const socket = this.#socket;
    this.#socket = null;
    socket?.close(1000, "Course Twin disconnected");
  }

  async #connect(wsUrl: string, token: string) {
    this.disconnect();
    const socket = new WebSocket(wsUrl, ["fkh-course-twin-v1", `fkh-token.${token}`]);
    this.#socket = socket;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        socket.close();
        reject(new Error("The local bridge did not open its browser connection."));
      }, 4_000);
      socket.addEventListener(
        "open",
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          window.clearTimeout(timeout);
          reject(new Error("The local bridge rejected the browser connection."));
        },
        { once: true },
      );
    });

    socket.addEventListener("message", (message) => {
      const event = parseBridgeEvent(message.data);
      if (!event) return;
      this.#onEvent(event);
      if (event.type === "shot") {
        socket.send(JSON.stringify({ type: "ack", eventId: event.eventId }));
      }
    });
    socket.addEventListener("close", (event) => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      this.#onDisconnect(
        event.wasClean ? "Bridge disconnected." : "Bridge connection was interrupted.",
      );
    });
  }
}

export function bridgeShotToReplayShot({
  event,
  hole,
  start,
  clubType,
  holeShotNumber,
}: {
  event: CourseTwinBridgeShotEvent;
  hole: CourseTwinHole;
  start: CourseTwinPoint;
  clubType: string;
  holeShotNumber: number;
}): CourseTwinReplayShot {
  const ball = event.shot.ball;
  const carryYd =
    ball.carryDistanceYards ?? estimateCarryYards(ball.speedMph, ball.verticalLaunchDeg);
  const carryM = carryYd * 0.9144;
  const direction = unitDirection(start, hole.green);
  const launchDirection = rotateDirection(direction, (ball.horizontalLaunchDeg * Math.PI) / 180);
  const carryEnd = pointAlong(start, launchDirection, carryM);
  const rollRatio = estimateRollRatio(clubType, ball.verticalLaunchDeg);
  const totalEnd = pointAlong(carryEnd, launchDirection, carryM * rollRatio);
  const apexM = estimateApexMetres(carryM, ball.verticalLaunchDeg);
  const apex: CourseTwinPoint = [
    start[0] + (carryEnd[0] - start[0]) * 0.52,
    apexM,
    start[2] + (carryEnd[2] - start[2]) * 0.52,
  ];

  return {
    id: `live-${event.eventId}`,
    holeNumber: hole.holeNumber,
    holeShotNumber,
    clubType,
    start,
    carryEnd,
    totalEnd,
    trajectory: [start, apex, carryEnd, totalEnd],
    metrics: {
      carryYd: {
        value: carryYd,
        provenance: ball.carryDistanceYards === null ? "derived" : "measured",
      },
      totalYd: { value: carryYd * (1 + rollRatio), provenance: "reconstructed" },
      sideCarryYd: {
        value: Math.tan((ball.horizontalLaunchDeg * Math.PI) / 180) * carryYd,
        provenance: "derived",
      },
      apexFt: { value: apexM / 0.3048, provenance: "reconstructed" },
      ballSpeedMph: { value: ball.speedMph, provenance: "measured" },
      launchAngleDeg: { value: ball.verticalLaunchDeg, provenance: "measured" },
      spinRate: { value: ball.totalSpinRpm, provenance: "measured" },
      spinAxis: { value: ball.spinAxisDeg, provenance: "measured" },
    },
    placementProvenance: "derived",
    trajectoryProvenance: "reconstructed",
    rollProvenance: "reconstructed",
  };
}

function parseBridgeStatus(value: unknown): CourseTwinBridgeStatus {
  if (
    !isRecord(value) ||
    value.bridge !== "ForeKingHell Course Twin" ||
    value.protocolVersion !== 1
  ) {
    throw new Error("A different or unsupported service answered on the bridge port.");
  }
  return value as CourseTwinBridgeStatus;
}

function parsePairingSession(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.token !== "string" ||
    typeof value.expiresAt !== "string" ||
    typeof value.wsUrl !== "string" ||
    !value.wsUrl.startsWith("ws://127.0.0.1:")
  ) {
    throw new Error("The local bridge returned an invalid pairing session.");
  }
  return { token: value.token, expiresAt: value.expiresAt, wsUrl: value.wsUrl };
}

function parseBridgeDiagnostics(value: unknown): CourseTwinBridgeDiagnosticReport {
  if (
    !isRecord(value) ||
    value.reportVersion !== 1 ||
    value.product !== "ForeKingHell Course Twin Bridge" ||
    value.protocolVersion !== 1 ||
    !isRecord(value.network) ||
    value.network.loopbackOnly !== true ||
    !isRecord(value.privacy) ||
    value.privacy.containsPairingCode !== false ||
    value.privacy.containsSessionToken !== false ||
    value.privacy.containsRawShotPayload !== false
  ) {
    throw new Error("The local bridge returned an unsafe or unsupported diagnostic report.");
  }
  return value as CourseTwinBridgeDiagnosticReport;
}

function parseBridgeEvent(value: unknown): CourseTwinBridgeEvent | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : JSON.parse(String(value));
    if (!isRecord(parsed) || typeof parsed.type !== "string") return null;
    if (parsed.type === "bridge-status" && typeof parsed.connected === "boolean") {
      return parsed as CourseTwinBridgeEvent;
    }
    if (parsed.type === "launch-monitor-status" && typeof parsed.connected === "boolean") {
      return parsed as CourseTwinBridgeEvent;
    }
    if (
      parsed.type === "shot" &&
      typeof parsed.eventId === "string" &&
      isRecord(parsed.shot) &&
      parsed.shot.kind === "shot" &&
      isRecord(parsed.shot.ball) &&
      typeof parsed.shot.ball.speedMph === "number" &&
      typeof parsed.shot.ball.verticalLaunchDeg === "number"
    ) {
      return parsed as CourseTwinBridgeShotEvent;
    }
    return null;
  } catch {
    return null;
  }
}

function unitDirection(start: CourseTwinPoint, end: CourseTwinPoint) {
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const length = Math.max(0.001, Math.hypot(dx, dz));
  return { x: dx / length, z: dz / length };
}

function rotateDirection(direction: { x: number; z: number }, radians: number) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: direction.x * cosine - direction.z * sine,
    z: direction.x * sine + direction.z * cosine,
  };
}

function pointAlong(
  start: CourseTwinPoint,
  direction: { x: number; z: number },
  distanceM: number,
): CourseTwinPoint {
  return [start[0] + direction.x * distanceM, 0, start[2] + direction.z * distanceM];
}

function estimateCarryYards(ballSpeedMph: number, launchAngleDeg: number) {
  const launchFactor = Math.max(0.65, Math.min(1.04, 1 - Math.abs(14 - launchAngleDeg) * 0.018));
  return Math.max(10, Math.min(350, ballSpeedMph * 1.68 * launchFactor));
}

function estimateApexMetres(carryM: number, launchAngleDeg: number) {
  return Math.max(1, carryM * Math.tan((Math.max(2, launchAngleDeg) * Math.PI) / 180) * 0.24);
}

function estimateRollRatio(clubType: string, launchAngleDeg: number) {
  const club = clubType.toLowerCase();
  const base = club.includes("driver")
    ? 0.09
    : club.includes("wood")
      ? 0.07
      : club.includes("wedge")
        ? 0.025
        : 0.045;
  return Math.max(0.015, base - Math.max(0, launchAngleDeg - 15) * 0.0015);
}

function gsProClubCode(clubType: string) {
  const club = clubType.toLowerCase();
  if (club.includes("driver")) return "DR";
  if (club.includes("putter")) return "PT";
  const number = club.match(/\d+/)?.[0];
  if (club.includes("wood")) return `${number ?? "3"}W`;
  if (club.includes("hybrid")) return `${number ?? "3"}H`;
  if (club.includes("wedge")) return number ? `${number}D` : "SW";
  if (club.includes("iron") || /^\d+i$/.test(club)) return `${number ?? "7"}I`;
  return "UN";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
