export const COURSE_TWIN_ROUND_EVENT_TYPES = [
  "shot.accepted",
  "putt.accepted",
  "shot.mulligan",
  "hole.completed",
  "round.completed",
  "round.abandoned",
] as const;

export type CourseTwinRoundMode = "play" | "live";
export type CourseTwinRoundStatus = "in_progress" | "complete" | "abandoned";
export type CourseTwinRoundEventType = (typeof COURSE_TWIN_ROUND_EVENT_TYPES)[number];
export type CourseTwinGreenRule = "automatic_putts" | "manual_putts" | "competition_gimmes";
export type CourseTwinRoundPosition = [number, number, number];

export function courseTwinRoundCreatesAnalyticsSession(mode: string): mode is "live" {
  return mode === "live";
}

export type CourseTwinRoundRules = {
  windSpeedMph: number;
  windDirectionDeg: number;
  greenRule: CourseTwinGreenRule;
  mulligansAllowed: boolean;
  competition: boolean;
};

export type CourseTwinCreateRoundInput = {
  mode: CourseTwinRoundMode;
  holeCount: 9 | 18;
  startingHole: number;
  rules: CourseTwinRoundRules;
};

export type CourseTwinShotEventPayload = {
  holeNumber: number;
  shotNumber: number;
  clubId: string;
  clubType: string;
  source: "modelled" | "measured";
  start: CourseTwinRoundPosition;
  carryEnd: CourseTwinRoundPosition;
  totalEnd: CourseTwinRoundPosition;
  metrics: {
    carryYd: number;
    totalYd: number;
    ballSpeedMph: number | null;
    clubSpeedMph: number | null;
    launchAngleDeg: number | null;
    launchDirectionDeg: number | null;
    spinRate: number | null;
    spinAxis: number | null;
  };
  result: {
    finalSurface: string;
    penalty: "water" | "out_of_bounds" | null;
    bounceCount: number;
  };
};

export type CourseTwinPuttEventPayload = {
  holeNumber: number;
  puttNumber: number;
  source: "modelled" | "measured";
  start: CourseTwinRoundPosition;
  end: CourseTwinRoundPosition;
  distanceM: number;
  remainingDistanceM: number;
  aimOffsetDeg: number;
  pacePercent: number;
  holed: boolean;
};

export type CourseTwinHoleCompletedPayload = {
  holeNumber: number;
  par: number;
  yards: number;
  strokes: number;
  putts: number;
  penalties: number;
  fairwayHit: boolean | null;
  gir: boolean | null;
};

export type CourseTwinRoundEventInput =
  | { type: "shot.accepted"; clientEventId: string; payload: CourseTwinShotEventPayload }
  | { type: "putt.accepted"; clientEventId: string; payload: CourseTwinPuttEventPayload }
  | {
      type: "shot.mulligan";
      clientEventId: string;
      payload: { shotClientEventId: string; reason: string | null };
    }
  | { type: "hole.completed"; clientEventId: string; payload: CourseTwinHoleCompletedPayload }
  | { type: "round.completed"; clientEventId: string; payload: Record<string, never> }
  | {
      type: "round.abandoned";
      clientEventId: string;
      payload: { reason: string | null };
    };

export type CourseTwinRoundLedgerEvent = CourseTwinRoundEventInput & {
  id: string;
  sequence: number;
  previousHash: string | null;
  eventHash: string;
  createdAt: Date;
};

export type CourseTwinRoundSummary = {
  status: CourseTwinRoundStatus;
  currentHole: number;
  scorecard: CourseTwinHoleCompletedPayload[];
  acceptedShots: Array<
    CourseTwinShotEventPayload & { clientEventId: string; eventId: string; sequence: number }
  >;
  acceptedPutts: Array<
    CourseTwinPuttEventPayload & { clientEventId: string; eventId: string; sequence: number }
  >;
  mulliganCount: number;
};

export type CourseTwinRoundScore = {
  strokes: number;
  par: number;
  relativeToPar: number;
};

export type CourseTwinAutomaticGreenCompletion = {
  triggerShotClientEventId: string;
  remainingYd: number;
  payload: CourseTwinHoleCompletedPayload;
};

export type CourseTwinManualGreenCompletion = {
  triggerPuttClientEventId: string;
  payload: CourseTwinHoleCompletedPayload;
};

type CourseTwinGreenCompletionSummary = Pick<
  CourseTwinRoundSummary,
  "status" | "currentHole" | "scorecard"
> & {
  acceptedShots: Array<CourseTwinShotEventPayload & { clientEventId: string }>;
  acceptedPutts: Array<CourseTwinPuttEventPayload & { clientEventId: string }>;
};

const eventTypes = new Set<string>(COURSE_TWIN_ROUND_EVENT_TYPES);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCourseTwinCreateRoundInput(value: unknown): CourseTwinCreateRoundInput | null {
  if (!isRecord(value) || (value.mode !== "play" && value.mode !== "live")) return null;
  const holeCount = value.holeCount === 9 ? 9 : value.holeCount === 18 ? 18 : null;
  if (!holeCount || !integerInRange(value.startingHole, 1, 18)) return null;
  if (value.startingHole + holeCount - 1 > 18) return null;
  const rules = parseRules(value.rules);
  return rules ? { mode: value.mode, holeCount, startingHole: value.startingHole, rules } : null;
}

export function parseCourseTwinRoundEventInput(value: unknown): CourseTwinRoundEventInput | null {
  if (!isRecord(value) || typeof value.type !== "string" || !eventTypes.has(value.type))
    return null;
  if (!isUuid(value.clientEventId) || !isRecord(value.payload)) return null;
  if (JSON.stringify(value.payload).length > 12_000) return null;

  if (value.type === "shot.accepted") {
    const payload = parseShotPayload(value.payload);
    return payload ? { type: value.type, clientEventId: value.clientEventId, payload } : null;
  }
  if (value.type === "putt.accepted") {
    const payload = parsePuttPayload(value.payload);
    return payload ? { type: value.type, clientEventId: value.clientEventId, payload } : null;
  }
  if (value.type === "shot.mulligan") {
    if (!isUuid(value.payload.shotClientEventId)) return null;
    const reason = optionalShortText(value.payload.reason, 240);
    if (reason === undefined) return null;
    return {
      type: value.type,
      clientEventId: value.clientEventId,
      payload: { shotClientEventId: value.payload.shotClientEventId, reason },
    };
  }
  if (value.type === "hole.completed") {
    const payload = parseHoleCompleted(value.payload);
    return payload ? { type: value.type, clientEventId: value.clientEventId, payload } : null;
  }
  if (value.type === "round.completed") {
    if (Object.keys(value.payload).length > 0) return null;
    return { type: value.type, clientEventId: value.clientEventId, payload: {} };
  }
  const reason = optionalShortText(value.payload.reason, 240);
  if (reason === undefined) return null;
  return {
    type: "round.abandoned",
    clientEventId: value.clientEventId,
    payload: { reason },
  };
}

export function reduceCourseTwinRoundEvents({
  events,
  startingHole,
}: {
  events: CourseTwinRoundLedgerEvent[];
  startingHole: number;
}): CourseTwinRoundSummary {
  const accepted = new Map<
    string,
    CourseTwinShotEventPayload & { clientEventId: string; eventId: string; sequence: number }
  >();
  const acceptedPutts = new Map<
    string,
    CourseTwinPuttEventPayload & { clientEventId: string; eventId: string; sequence: number }
  >();
  const scorecard = new Map<number, CourseTwinHoleCompletedPayload>();
  let status: CourseTwinRoundStatus = "in_progress";
  let currentHole = startingHole;
  let mulliganCount = 0;

  for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
    if (event.type === "shot.accepted") {
      accepted.set(event.clientEventId, {
        ...event.payload,
        clientEventId: event.clientEventId,
        eventId: event.id,
        sequence: event.sequence,
      });
    } else if (event.type === "putt.accepted") {
      acceptedPutts.set(event.clientEventId, {
        ...event.payload,
        clientEventId: event.clientEventId,
        eventId: event.id,
        sequence: event.sequence,
      });
    } else if (event.type === "shot.mulligan") {
      if (
        accepted.delete(event.payload.shotClientEventId) ||
        acceptedPutts.delete(event.payload.shotClientEventId)
      ) {
        mulliganCount += 1;
      }
    } else if (event.type === "hole.completed") {
      scorecard.set(event.payload.holeNumber, event.payload);
      currentHole = Math.min(18, event.payload.holeNumber + 1);
    } else if (event.type === "round.completed") {
      status = "complete";
    } else if (event.type === "round.abandoned") {
      status = "abandoned";
    }
  }

  return {
    status,
    currentHole,
    scorecard: [...scorecard.values()].sort((left, right) => left.holeNumber - right.holeNumber),
    acceptedShots: [...accepted.values()].sort((left, right) => left.sequence - right.sequence),
    acceptedPutts: [...acceptedPutts.values()].sort(
      (left, right) => left.sequence - right.sequence,
    ),
    mulliganCount,
  };
}

export function buildCourseTwinAutomaticGreenCompletion({
  summary,
  hole,
}: {
  summary: CourseTwinGreenCompletionSummary;
  hole: {
    holeNumber: number;
    par: number;
    yards: number;
    green: readonly [number, number, number];
  };
}): CourseTwinAutomaticGreenCompletion | null {
  if (
    summary.status !== "in_progress" ||
    summary.currentHole !== hole.holeNumber ||
    summary.scorecard.some((score) => score.holeNumber === hole.holeNumber)
  ) {
    return null;
  }
  const holeShots = summary.acceptedShots.filter((shot) => shot.holeNumber === hole.holeNumber);
  const lastShot = holeShots.at(-1);
  if (!lastShot || lastShot.result.penalty || lastShot.result.finalSurface !== "green") return null;

  const remainingYd = courseTwinDistanceToPinYd(lastShot.totalEnd, hole.green);
  const putts = courseTwinAutomaticPuttCount(remainingYd);
  const penalties = holeShots.filter((shot) => Boolean(shot.result.penalty)).length;

  return {
    triggerShotClientEventId: lastShot.clientEventId,
    remainingYd,
    payload: {
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      strokes: holeShots.length + penalties + putts,
      putts,
      penalties,
      fairwayHit: null,
      gir: lastShot.shotNumber <= Math.max(1, hole.par - 2),
    },
  };
}

export function courseTwinAutomaticPuttCount(remainingYd: number) {
  const feet = Math.max(0, remainingYd) * 3;
  return feet <= 10 ? 1 : 2;
}

export function courseTwinDistanceToPinYd(
  position: readonly [number, number, number],
  pin: readonly [number, number, number],
) {
  return Math.hypot(pin[0] - position[0], pin[2] - position[2]) / 0.9144;
}

export function courseTwinRoundScore(
  scorecard: readonly CourseTwinHoleCompletedPayload[],
): CourseTwinRoundScore {
  const strokes = scorecard.reduce((total, hole) => total + hole.strokes, 0);
  const par = scorecard.reduce((total, hole) => total + hole.par, 0);
  return { strokes, par, relativeToPar: strokes - par };
}

export function courseTwinHoleScoreLabel(strokes: number, par: number) {
  const relativeToPar = strokes - par;
  if (relativeToPar <= -3) return "Albatross";
  if (relativeToPar === -2) return "Eagle";
  if (relativeToPar === -1) return "Birdie";
  if (relativeToPar === 0) return "Par";
  if (relativeToPar === 1) return "Bogey";
  if (relativeToPar === 2) return "Double bogey";
  return `+${relativeToPar}`;
}

export function buildCourseTwinManualGreenCompletion({
  summary,
  hole,
}: {
  summary: CourseTwinGreenCompletionSummary;
  hole: { holeNumber: number; par: number; yards: number };
}): CourseTwinManualGreenCompletion | null {
  if (
    summary.status !== "in_progress" ||
    summary.currentHole !== hole.holeNumber ||
    summary.scorecard.some((score) => score.holeNumber === hole.holeNumber)
  ) {
    return null;
  }
  const holePutts = summary.acceptedPutts.filter((putt) => putt.holeNumber === hole.holeNumber);
  const lastPutt = holePutts.at(-1);
  if (!lastPutt?.holed) return null;
  const holeShots = summary.acceptedShots.filter((shot) => shot.holeNumber === hole.holeNumber);
  const penalties = holeShots.filter((shot) => Boolean(shot.result.penalty)).length;
  const lastShotNumber = holeShots.at(-1)?.shotNumber ?? null;
  return {
    triggerPuttClientEventId: lastPutt.clientEventId,
    payload: {
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      strokes: holeShots.length + holePutts.length + penalties,
      putts: holePutts.length,
      penalties,
      fairwayHit: null,
      gir: lastShotNumber === null ? null : lastShotNumber <= Math.max(1, hole.par - 2),
    },
  };
}

export function stableCourseTwinRoundJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableCourseTwinRoundJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableCourseTwinRoundJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function isCourseTwinRoundId(value: unknown): value is string {
  return isUuid(value);
}

function parseRules(value: unknown): CourseTwinRoundRules | null {
  if (!isRecord(value)) return null;
  const windSpeedMph = finiteInRange(value.windSpeedMph, 0, 35);
  const windDirectionDeg = finiteInRange(value.windDirectionDeg, 0, 359.999);
  if (
    windSpeedMph === null ||
    windDirectionDeg === null ||
    (value.greenRule !== "automatic_putts" &&
      value.greenRule !== "manual_putts" &&
      value.greenRule !== "competition_gimmes") ||
    typeof value.mulligansAllowed !== "boolean" ||
    typeof value.competition !== "boolean"
  ) {
    return null;
  }
  if (value.competition && value.mulligansAllowed) return null;
  return {
    windSpeedMph,
    windDirectionDeg,
    greenRule: value.greenRule,
    mulligansAllowed: value.mulligansAllowed,
    competition: value.competition,
  };
}

function parseShotPayload(value: Record<string, unknown>): CourseTwinShotEventPayload | null {
  if (
    !integerInRange(value.holeNumber, 1, 18) ||
    !integerInRange(value.shotNumber, 1, 30) ||
    !isUuid(value.clubId) ||
    typeof value.clubType !== "string" ||
    !value.clubType.trim() ||
    value.clubType.length > 40 ||
    (value.source !== "modelled" && value.source !== "measured")
  ) {
    return null;
  }
  const start = parsePosition(value.start);
  const carryEnd = parsePosition(value.carryEnd);
  const totalEnd = parsePosition(value.totalEnd);
  if (!start || !carryEnd || !totalEnd || !isRecord(value.metrics) || !isRecord(value.result)) {
    return null;
  }
  const carryYd = finiteInRange(value.metrics.carryYd, 0, 600);
  const totalYd = finiteInRange(value.metrics.totalYd, 0, 700);
  const ballSpeedMph = nullableFinite(value.metrics.ballSpeedMph, 0, 260);
  const clubSpeedMph = nullableFinite(value.metrics.clubSpeedMph, 0, 180);
  const launchAngleDeg = nullableFinite(value.metrics.launchAngleDeg, -20, 80);
  const launchDirectionDeg = nullableFinite(value.metrics.launchDirectionDeg, -90, 90);
  const spinRate = nullableFinite(value.metrics.spinRate, 0, 20_000);
  const spinAxis = nullableFinite(value.metrics.spinAxis, -180, 180);
  if (
    carryYd === null ||
    totalYd === null ||
    [ballSpeedMph, clubSpeedMph, launchAngleDeg, launchDirectionDeg, spinRate, spinAxis].some(
      (metric) => metric === undefined,
    ) ||
    typeof value.result.finalSurface !== "string" ||
    !value.result.finalSurface.trim() ||
    value.result.finalSurface.length > 40 ||
    (value.result.penalty !== null &&
      value.result.penalty !== "water" &&
      value.result.penalty !== "out_of_bounds") ||
    !integerInRange(value.result.bounceCount, 0, 100)
  ) {
    return null;
  }
  return {
    holeNumber: value.holeNumber,
    shotNumber: value.shotNumber,
    clubId: value.clubId,
    clubType: value.clubType.trim(),
    source: value.source,
    start,
    carryEnd,
    totalEnd,
    metrics: {
      carryYd,
      totalYd,
      ballSpeedMph: ballSpeedMph as number | null,
      clubSpeedMph: clubSpeedMph as number | null,
      launchAngleDeg: launchAngleDeg as number | null,
      launchDirectionDeg: launchDirectionDeg as number | null,
      spinRate: spinRate as number | null,
      spinAxis: spinAxis as number | null,
    },
    result: {
      finalSurface: value.result.finalSurface.trim(),
      penalty: value.result.penalty,
      bounceCount: value.result.bounceCount,
    },
  };
}

function parsePuttPayload(value: Record<string, unknown>): CourseTwinPuttEventPayload | null {
  if (
    !integerInRange(value.holeNumber, 1, 18) ||
    !integerInRange(value.puttNumber, 1, 10) ||
    (value.source !== "modelled" && value.source !== "measured") ||
    typeof value.holed !== "boolean"
  ) {
    return null;
  }
  const start = parsePosition(value.start);
  const end = parsePosition(value.end);
  const distanceM = finiteInRange(value.distanceM, 0, 100);
  const remainingDistanceM = finiteInRange(value.remainingDistanceM, 0, 100);
  const aimOffsetDeg = finiteInRange(value.aimOffsetDeg, -45, 45);
  const pacePercent = finiteInRange(value.pacePercent, 25, 200);
  if (
    !start ||
    !end ||
    distanceM === null ||
    remainingDistanceM === null ||
    aimOffsetDeg === null ||
    pacePercent === null ||
    (value.holed && remainingDistanceM !== 0)
  ) {
    return null;
  }
  return {
    holeNumber: value.holeNumber,
    puttNumber: value.puttNumber,
    source: value.source,
    start,
    end,
    distanceM,
    remainingDistanceM,
    aimOffsetDeg,
    pacePercent,
    holed: value.holed,
  };
}

function parseHoleCompleted(value: Record<string, unknown>): CourseTwinHoleCompletedPayload | null {
  if (
    !integerInRange(value.holeNumber, 1, 18) ||
    !integerInRange(value.par, 3, 6) ||
    !integerInRange(value.yards, 40, 900) ||
    !integerInRange(value.strokes, 1, 30) ||
    !integerInRange(value.putts, 0, 10) ||
    !integerInRange(value.penalties, 0, 20) ||
    !nullableBoolean(value.fairwayHit) ||
    !nullableBoolean(value.gir)
  ) {
    return null;
  }
  return {
    holeNumber: value.holeNumber,
    par: value.par,
    yards: value.yards,
    strokes: value.strokes,
    putts: value.putts,
    penalties: value.penalties,
    fairwayHit: value.fairwayHit as boolean | null,
    gir: value.gir as boolean | null,
  };
}

function parsePosition(value: unknown): CourseTwinRoundPosition | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const position = value.map(Number);
  return position.every(
    (coordinate) => Number.isFinite(coordinate) && Math.abs(coordinate) <= 50_000,
  )
    ? (position as CourseTwinRoundPosition)
    : null;
}

function nullableFinite(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null | undefined {
  if (value === null) return null;
  const parsed = finiteInRange(value, minimum, maximum);
  return parsed === null ? undefined : parsed;
}

function finiteInRange(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function integerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function nullableBoolean(value: unknown) {
  return value === null || typeof value === "boolean";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function optionalShortText(value: unknown, maximum: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > maximum) return undefined;
  return value.trim() || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
