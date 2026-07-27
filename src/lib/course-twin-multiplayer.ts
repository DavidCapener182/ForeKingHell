import {
  parseCourseTwinRoundEventInput,
  type CourseTwinRoundEventInput,
} from "@/lib/course-twin-round";

export const COURSE_TWIN_ROOM_TTL_MS = 4 * 60 * 60 * 1000;
export const COURSE_TWIN_ROOM_EVENT_LIMIT = 100;

export type CourseTwinRoomMode = "explore" | "play" | "live" | "replay";
export type CourseTwinRoomStatus = "lobby" | "playing" | "finished" | "closed";
export type CourseTwinRoomTransport = "walk" | "cart";
export type CourseTwinRoomRole = "host" | "player" | "spectator";
export type CourseTwinRoomPosition = [number, number, number];

export type CourseTwinCreateRoomInput = {
  mode: CourseTwinRoomMode;
  maxPlayers: number;
  spectatorLimit: number;
  holeNumber: number;
  competition: boolean;
  visibility: "private" | "public";
};

export type CourseTwinJoinRoomInput = {
  inviteCode: string;
  role: Exclude<CourseTwinRoomRole, "host">;
};

export type CourseTwinPresenceInput = {
  transport?: CourseTwinRoomTransport;
  position?: CourseTwinRoomPosition;
  holeNumber?: number;
  isReady?: boolean;
};

export type CourseTwinRoomStateInput = {
  expectedVersion: number;
  status?: CourseTwinRoomStatus;
  holeNumber?: number;
  state?: Record<string, unknown>;
};

export type CourseTwinSharedRoundEventInput = {
  expectedVersion: number;
  event: CourseTwinRoundEventInput;
};

const roomModes = new Set<CourseTwinRoomMode>(["explore", "play", "live", "replay"]);
const roomStatuses = new Set<CourseTwinRoomStatus>(["lobby", "playing", "finished", "closed"]);

export function parseCourseTwinCreateRoomInput(value: unknown): CourseTwinCreateRoomInput | null {
  if (!isRecord(value)) return null;
  const mode = typeof value.mode === "string" ? value.mode : "explore";
  const maxPlayers = value.maxPlayers === undefined ? 4 : value.maxPlayers;
  const spectatorLimit = value.spectatorLimit === undefined ? 8 : value.spectatorLimit;
  const holeNumber = value.holeNumber === undefined ? 1 : value.holeNumber;
  const competition = value.competition === undefined ? false : value.competition;
  const visibility = value.visibility === undefined ? "private" : value.visibility;
  if (!roomModes.has(mode as CourseTwinRoomMode)) return null;
  if (
    !isIntegerInRange(maxPlayers, 2, 4) ||
    !isIntegerInRange(spectatorLimit, 0, 20) ||
    !isIntegerInRange(holeNumber, 1, 18) ||
    typeof competition !== "boolean" ||
    (visibility !== "private" && visibility !== "public") ||
    (competition && mode !== "play" && mode !== "live")
  ) {
    return null;
  }
  return {
    mode: mode as CourseTwinRoomMode,
    maxPlayers,
    spectatorLimit,
    holeNumber,
    competition,
    visibility,
  };
}

export function parseCourseTwinJoinRoomInput(value: unknown): CourseTwinJoinRoomInput | null {
  if (!isRecord(value)) return null;
  const inviteCode = normalizeCourseTwinInviteCode(value.inviteCode);
  const role = value.role === undefined ? "player" : value.role;
  if (!inviteCode || (role !== "player" && role !== "spectator")) return null;
  return { inviteCode, role };
}

export function parseCourseTwinPresenceInput(value: unknown): CourseTwinPresenceInput | null {
  if (!isRecord(value)) return null;
  const result: CourseTwinPresenceInput = {};
  if (value.transport !== undefined) {
    if (value.transport !== "walk" && value.transport !== "cart") return null;
    result.transport = value.transport;
  }
  if (value.position !== undefined) {
    const position = parsePosition(value.position);
    if (!position) return null;
    result.position = position;
  }
  if (value.holeNumber !== undefined) {
    if (!isIntegerInRange(value.holeNumber, 1, 18)) return null;
    result.holeNumber = value.holeNumber;
  }
  if (value.isReady !== undefined) {
    if (typeof value.isReady !== "boolean") return null;
    result.isReady = value.isReady;
  }
  return Object.keys(result).length ? result : null;
}

export function parseCourseTwinRoomStateInput(value: unknown): CourseTwinRoomStateInput | null {
  if (!isRecord(value) || !isIntegerInRange(value.expectedVersion, 1, Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  const result: CourseTwinRoomStateInput = { expectedVersion: value.expectedVersion };
  if (value.status !== undefined) {
    if (
      typeof value.status !== "string" ||
      !roomStatuses.has(value.status as CourseTwinRoomStatus)
    ) {
      return null;
    }
    result.status = value.status as CourseTwinRoomStatus;
  }
  if (value.holeNumber !== undefined) {
    if (!isIntegerInRange(value.holeNumber, 1, 18)) return null;
    result.holeNumber = value.holeNumber;
  }
  if (value.state !== undefined) {
    if (!isRecord(value.state) || JSON.stringify(value.state).length > 8_000) return null;
    result.state = value.state;
  }
  return result.status || result.holeNumber || result.state ? result : null;
}

export function parseCourseTwinRoomEvent(value: unknown) {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  const type = value.type.trim();
  if (!/^[a-z][a-z0-9_.-]{1,39}$/.test(type)) return null;
  const payload = value.payload === undefined ? {} : value.payload;
  if (!isRecord(payload) || JSON.stringify(payload).length > 8_000) return null;
  if (type === "chat.message") {
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    return text && text.length <= 500 ? { type, payload: { text } } : null;
  }
  if (type === "voice.offer" || type === "voice.answer") {
    return isUuid(payload.targetUserId) &&
      typeof payload.sdp === "string" &&
      payload.sdp.length <= 6_000
      ? { type, payload: { targetUserId: payload.targetUserId, sdp: payload.sdp } }
      : null;
  }
  if (type === "voice.ice") {
    return isUuid(payload.targetUserId) &&
      isRecord(payload.candidate) &&
      JSON.stringify(payload.candidate).length <= 2_000
      ? { type, payload: { targetUserId: payload.targetUserId, candidate: payload.candidate } }
      : null;
  }
  if (type === "voice.leave") return { type, payload: {} };
  return null;
}

export function parseCourseTwinSharedRoundEventInput(
  value: unknown,
): CourseTwinSharedRoundEventInput | null {
  if (!isRecord(value) || !isIntegerInRange(value.expectedVersion, 1, Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  const event = parseCourseTwinRoundEventInput(value.event);
  return event ? { expectedVersion: value.expectedVersion, event } : null;
}

export function normalizeCourseTwinInviteCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.toUpperCase().replace(/[^A-Z2-9]/g, "");
  return code.length >= 6 && code.length <= 12 ? code : null;
}

export function isCourseTwinRoomId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function createCourseTwinInviteCode(randomBytes: Uint8Array) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  if (randomBytes.length < 8) throw new Error("Eight random bytes are required.");
  return Array.from(randomBytes.slice(0, 8), (byte) => alphabet[byte % alphabet.length]).join("");
}

export function courseTwinRoomExpiresAt(now = new Date()) {
  return new Date(now.getTime() + COURSE_TWIN_ROOM_TTL_MS);
}

export function isCourseTwinRoomActive(
  room: { status: string; expiresAt: Date },
  now = new Date(),
) {
  return room.status !== "closed" && room.status !== "finished" && room.expiresAt > now;
}

export function isCourseTwinRoomReadable(
  room: { status: string; expiresAt: Date },
  now = new Date(),
) {
  return room.status !== "closed" && room.expiresAt > now;
}

function parsePosition(value: unknown): CourseTwinRoomPosition | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const coordinates = value.map(Number);
  if (
    coordinates.some((coordinate) => !Number.isFinite(coordinate) || Math.abs(coordinate) > 50_000)
  ) {
    return null;
  }
  return coordinates as CourseTwinRoomPosition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}
