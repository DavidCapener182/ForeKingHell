import type {
  CourseTwinCreateRoundInput,
  CourseTwinHoleCompletedPayload,
  CourseTwinPuttEventPayload,
  CourseTwinRoundPosition,
  CourseTwinRoundEventInput,
  CourseTwinRoundRules,
  CourseTwinRoundStatus,
  CourseTwinShotEventPayload,
} from "@/lib/course-twin-round";

export type CourseTwinRoundClientDocument = {
  id: string;
  courseId: string;
  sessionId: string | null;
  mode: "play" | "live";
  status: CourseTwinRoundStatus;
  holeCount: number;
  startingHole: number;
  currentHole: number;
  version: number;
  rulesJson: CourseTwinRoundRules;
  finalEventHash: string | null;
  summary: {
    status: CourseTwinRoundStatus;
    currentHole: number;
    scorecard: CourseTwinHoleCompletedPayload[];
    acceptedShots: Array<CourseTwinShotEventPayload & { clientEventId: string }>;
    acceptedPutts: Array<CourseTwinPuttEventPayload & { clientEventId: string }>;
    mulliganCount: number;
  };
};

export type CourseTwinRoundHoleResumeState = {
  holeNumber: number;
  physicalHoleNumber: number;
  start: CourseTwinRoundPosition;
  shotNumber: number;
  puttNumber: number;
  strokes: number;
  penaltyStrokes: number;
};

export class CourseTwinRoundRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CourseTwinRoundRequestError";
  }
}

export function courseTwinRoundPhysicalHoleNumber(
  round: Pick<CourseTwinRoundClientDocument, "currentHole" | "holeCount" | "startingHole">,
  holes: ReadonlyArray<{ holeNumber: number }>,
) {
  if (holes.some((hole) => hole.holeNumber === round.currentHole)) return round.currentHole;
  if (holes.length === 0 || round.holeCount <= holes.length) return null;

  const roundOffset = round.currentHole - round.startingHole;
  if (roundOffset < 0 || roundOffset >= round.holeCount) return null;
  const orderedHoles = [...holes].sort((left, right) => left.holeNumber - right.holeNumber);
  return orderedHoles[roundOffset % orderedHoles.length]?.holeNumber ?? null;
}

export function courseTwinRoundHoleResumeState(
  round: CourseTwinRoundClientDocument,
  holes: ReadonlyArray<{ holeNumber: number; tee: CourseTwinRoundPosition }>,
): CourseTwinRoundHoleResumeState | null {
  const physicalHoleNumber = courseTwinRoundPhysicalHoleNumber(round, holes);
  if (physicalHoleNumber === null) return null;
  const hole = holes.find((candidate) => candidate.holeNumber === physicalHoleNumber);
  if (!hole) return null;

  const shots = round.summary.acceptedShots
    .filter((shot) => shot.holeNumber === round.currentHole)
    .sort((left, right) => left.shotNumber - right.shotNumber);
  const putts = round.summary.acceptedPutts
    .filter((putt) => putt.holeNumber === round.currentHole)
    .sort((left, right) => left.puttNumber - right.puttNumber);
  const lastShot = shots.at(-1);
  const lastPutt = putts.at(-1);
  const penaltyStrokes = shots.filter((shot) => shot.result.penalty).length;
  const start =
    lastPutt?.end ??
    (lastShot ? (lastShot.result.penalty ? lastShot.carryEnd : lastShot.totalEnd) : hole.tee);

  return {
    holeNumber: round.currentHole,
    physicalHoleNumber,
    start,
    shotNumber: shots.length + 1,
    puttNumber: putts.length + 1,
    strokes: shots.length + (round.mode === "play" ? putts.length : 0) + penaltyStrokes,
    penaltyStrokes,
  };
}

export async function createCourseTwinRoundClient(
  courseId: string,
  input: CourseTwinCreateRoundInput,
) {
  return requestCourseTwinRound(`/api/course-twins/${encodeURIComponent(courseId)}/rounds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function loadActiveCourseTwinRoundClient(courseId: string) {
  const response = await fetch(`/api/course-twins/${encodeURIComponent(courseId)}/rounds`, {
    cache: "no-store",
  });
  const body = (await response.json()) as
    | CourseTwinRoundClientDocument
    | null
    | { error?: unknown };
  if (!response.ok) {
    throw new Error(
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : "Course Twin could not resume the round.",
    );
  }
  return body && "id" in body ? body : null;
}

export async function loadCourseTwinRoundClient(roundId: string) {
  return requestCourseTwinRound(`/api/course-twins/rounds/${encodeURIComponent(roundId)}`, {
    method: "GET",
  });
}

export async function appendCourseTwinRoundEventClient(
  round: Pick<CourseTwinRoundClientDocument, "id" | "version">,
  event: CourseTwinRoundEventInput,
) {
  return requestCourseTwinRound(`/api/course-twins/rounds/${round.id}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedVersion: round.version, event }),
  });
}

async function requestCourseTwinRound(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = (await response.json()) as CourseTwinRoundClientDocument | { error?: unknown };
  if (!response.ok || !("id" in body)) {
    throw new CourseTwinRoundRequestError(
      "error" in body && typeof body.error === "string"
        ? body.error
        : "Course Twin could not save the round.",
      response.status,
    );
  }
  return body;
}
