import { median, percentile } from "@/lib/analysis-statistics";

export const SPEED_TRANSFER_SHOT_COUNT = 5;
export const SPEED_TRANSFER_REQUIRED_IN_CORRIDOR = 4;
export const SPEED_TRANSFER_METADATA_VERSION = 1;

const MIN_PERSONAL_CORRIDOR_HALF_WIDTH_YD = 10;
const MAX_DRIVER_CORRIDOR_HALF_WIDTH_YD = 30;
const MIN_PERSONAL_CORRIDOR_SAMPLES = 10;

export type SpeedTransferTestMetadata = {
  version: typeof SPEED_TRANSFER_METADATA_VERSION;
  shotSessionId: string;
  shotIds: [string, string, string, string, string];
  linkedAtIso: string;
  playabilityRule: "4_of_5_personal_corridor";
  corridor?: SpeedTransferCorridor;
};

export type SpeedTransferCorridor = {
  minSideCarryYd: number;
  maxSideCarryYd: number;
  centreSideCarryYd: number;
  halfWidthYd: number;
  sampleSize: number;
  basis: "personal_80_percent" | "provisional_driver";
};

export function buildSpeedTransferMetadata(input: {
  shotSessionId: string;
  shotIds: readonly string[];
  linkedAtIso?: string;
  corridor?: SpeedTransferCorridor;
}): SpeedTransferTestMetadata {
  if (!isSpeedTransferUuid(input.shotSessionId)) {
    throw new TypeError("Transfer session id must be a UUID.");
  }

  if (
    input.shotIds.length !== SPEED_TRANSFER_SHOT_COUNT ||
    input.shotIds.some((shotId) => !isSpeedTransferUuid(shotId)) ||
    new Set(input.shotIds).size !== SPEED_TRANSFER_SHOT_COUNT
  ) {
    throw new TypeError("A transfer test must link five unique shot UUIDs.");
  }

  const linkedAtIso = input.linkedAtIso ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(linkedAtIso))) {
    throw new TypeError("Transfer link time must be an ISO date.");
  }

  if (input.corridor && !isSpeedTransferCorridor(input.corridor)) {
    throw new TypeError("Transfer corridor must be a valid personal Driver corridor.");
  }

  return {
    version: SPEED_TRANSFER_METADATA_VERSION,
    shotSessionId: input.shotSessionId,
    shotIds: input.shotIds as SpeedTransferTestMetadata["shotIds"],
    linkedAtIso,
    playabilityRule: "4_of_5_personal_corridor",
    ...(input.corridor ? { corridor: input.corridor } : {}),
  };
}

export function readSpeedTransferMetadata(
  metadata: Record<string, unknown> | null | undefined,
): SpeedTransferTestMetadata | null {
  const value = metadata?.transferTest;
  if (!isRecord(value) || value.version !== SPEED_TRANSFER_METADATA_VERSION) {
    return null;
  }

  try {
    return buildSpeedTransferMetadata({
      shotSessionId: typeof value.shotSessionId === "string" ? value.shotSessionId : "",
      shotIds: Array.isArray(value.shotIds)
        ? value.shotIds.filter((shotId): shotId is string => typeof shotId === "string")
        : [],
      linkedAtIso: typeof value.linkedAtIso === "string" ? value.linkedAtIso : "",
      corridor: isSpeedTransferCorridor(value.corridor) ? value.corridor : undefined,
    });
  } catch {
    return null;
  }
}

export function withSpeedTransferMetadata(
  metadata: Record<string, unknown> | null | undefined,
  transferTest: SpeedTransferTestMetadata | null,
) {
  const next = { ...(metadata ?? {}) };

  if (transferTest) {
    next.transferTest = transferTest;
  } else {
    delete next.transferTest;
  }

  return next;
}

/**
 * The personal corridor is the golfer's central 80% side-carry window, centred
 * on their historical median. A 10-yard floor avoids making a tiny sample
 * unrealistically strict; a 30-yard cap keeps "playable" meaningful for Driver.
 */
export function buildPersonalDriverCorridor(
  sideCarryValues: readonly (number | null | undefined)[],
): SpeedTransferCorridor {
  const values = sideCarryValues.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (values.length < MIN_PERSONAL_CORRIDOR_SAMPLES) {
    return {
      minSideCarryYd: -MAX_DRIVER_CORRIDOR_HALF_WIDTH_YD,
      maxSideCarryYd: MAX_DRIVER_CORRIDOR_HALF_WIDTH_YD,
      centreSideCarryYd: 0,
      halfWidthYd: MAX_DRIVER_CORRIDOR_HALF_WIDTH_YD,
      sampleSize: values.length,
      basis: "provisional_driver",
    };
  }

  const centre = median(values) ?? 0;
  const low = percentile(values, 0.1) ?? centre;
  const high = percentile(values, 0.9) ?? centre;
  const halfWidth = clamp(
    Math.max(Math.abs(centre - low), Math.abs(high - centre)),
    MIN_PERSONAL_CORRIDOR_HALF_WIDTH_YD,
    MAX_DRIVER_CORRIDOR_HALF_WIDTH_YD,
  );
  const roundedCentre = roundOne(centre);
  const roundedHalfWidth = roundOne(halfWidth);

  return {
    minSideCarryYd: roundOne(roundedCentre - roundedHalfWidth),
    maxSideCarryYd: roundOne(roundedCentre + roundedHalfWidth),
    centreSideCarryYd: roundedCentre,
    halfWidthYd: roundedHalfWidth,
    sampleSize: values.length,
    basis: "personal_80_percent",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSpeedTransferCorridor(value: unknown): value is SpeedTransferCorridor {
  if (!isRecord(value)) {
    return false;
  }

  const numericKeys = [
    "minSideCarryYd",
    "maxSideCarryYd",
    "centreSideCarryYd",
    "halfWidthYd",
    "sampleSize",
  ] as const;
  if (
    numericKeys.some(
      (key) => typeof value[key] !== "number" || !Number.isFinite(value[key] as number),
    )
  ) {
    return false;
  }

  return (
    (value.basis === "personal_80_percent" || value.basis === "provisional_driver") &&
    (value.minSideCarryYd as number) <= (value.maxSideCarryYd as number) &&
    (value.halfWidthYd as number) >= 0 &&
    Number.isInteger(value.sampleSize as number) &&
    (value.sampleSize as number) >= 0
  );
}

export function isSpeedTransferUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
