import type {
  CourseTwinCreateRoundInput,
  CourseTwinHoleCompletedPayload,
  CourseTwinPuttEventPayload,
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
    throw new Error(
      "error" in body && typeof body.error === "string"
        ? body.error
        : "Course Twin could not save the round.",
    );
  }
  return body;
}
