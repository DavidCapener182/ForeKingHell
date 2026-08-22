import { isRoundHistorySession } from "@/lib/round-sessions";

export const MAX_SHOT_DELETE_BATCH_SIZE = 50;

export type ShotDeleteActionInput = {
  shotIds: string[];
};

export type ShotDeletionBoundaryInput = {
  sessionType: string | null | undefined;
  sessionPlayContext: string | null | undefined;
  sessionCourseId: string | null | undefined;
  courseHoleNumber: number | null | undefined;
  providerKind?: string | null;
  providerSessionMode?: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseShotDeleteActionInput(input: unknown): ShotDeleteActionInput {
  if (!input || typeof input !== "object") {
    throw new Error("Shot selection is required.");
  }

  const record = input as Record<string, unknown>;
  const shotIds = Array.isArray(record.shotIds)
    ? [...new Set(record.shotIds.filter((value): value is string => typeof value === "string"))]
    : [];

  if (shotIds.length === 0) {
    throw new Error("Select at least one shot to delete.");
  }
  if (shotIds.length > MAX_SHOT_DELETE_BATCH_SIZE) {
    throw new Error(`Delete no more than ${MAX_SHOT_DELETE_BATCH_SIZE} shots at once.`);
  }
  if (shotIds.some((shotId) => !uuidPattern.test(shotId))) {
    throw new Error("One or more shots are invalid.");
  }

  return { shotIds };
}

export function isPermanentShotDeletionRestricted(input: ShotDeletionBoundaryInput) {
  const sessionType = input.sessionType?.trim().toLowerCase() ?? "";
  const playContext = input.sessionPlayContext?.trim().toLowerCase() ?? "";

  return (
    sessionType === "course" ||
    playContext === "on_course" ||
    playContext === "simulated_course" ||
    Boolean(input.sessionCourseId) ||
    (input.courseHoleNumber !== null && input.courseHoleNumber !== undefined) ||
    isRoundHistorySession({
      type: sessionType,
      providerKind: input.providerKind?.trim().toLowerCase() ?? null,
      providerSessionMode: input.providerSessionMode?.trim().toLowerCase() ?? null,
    })
  );
}
