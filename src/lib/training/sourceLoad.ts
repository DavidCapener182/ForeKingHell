import { calculateSessionLoad } from "@/lib/training/trainingLoad";

export type ImportedTrainingSessionType = "range" | "round" | "simulator" | "simulated_course";
export type ImportedTrainingSource = "rapsodo" | "square" | "trackman";
export type ImportedTrainingSourceType = "round" | "launch_monitor";

export type ImportedTrainingSessionInput = {
  userId: string;
  sourceId: string;
  source: ImportedTrainingSource;
  sessionType: ImportedTrainingSessionType;
  sessionDate: Date;
  fileName: string;
  courseName?: string | null;
  /** Raw committed swings: review exclusions change analytical evidence, not physical workload. */
  shotCount: number;
  scorecardHoleCount?: number | null;
};

export type ImportedTrainingSessionRow = {
  userId: string;
  sourceType: ImportedTrainingSourceType;
  sourceId: string;
  title: string;
  sessionDate: string;
  durationMinutes: null;
  holesPlayed: number | null;
  totalSwings: number | null;
  fullSwings: null;
  shortGameSwings: null;
  puttingSwings: null;
  walked: boolean | null;
  usedCart: boolean | null;
  competition: false;
  rpe: number;
  mentalPressure: null;
  physicalDemand: null;
  sessionLoad: number;
  notes: string;
};

export function buildImportedTrainingSessionRow(
  input: ImportedTrainingSessionInput,
): ImportedTrainingSessionRow {
  const isRoundLike = isRoundLikeSession(input.sessionType);
  const holesPlayed = isRoundLike ? (input.scorecardHoleCount ?? 18) : null;
  const totalSwings = isRoundLike ? null : Math.max(1, input.shotCount);
  const rpe = isRoundLike ? 5 : input.shotCount >= 80 ? 5 : 4;
  const walked = isRoundLike ? false : null;
  const competition = false;
  const mentalPressure = null;
  const sessionLoad = calculateSessionLoad({
    holesPlayed,
    totalSwings,
    walked,
    competition,
    mentalPressure,
    rpe,
  });

  return {
    userId: input.userId,
    sourceType: isRoundLike ? "round" : "launch_monitor",
    sourceId: input.sourceId,
    title: isRoundLike ? roundTitle(input) : practiceTitle(input),
    sessionDate: toDateKey(input.sessionDate),
    durationMinutes: null,
    holesPlayed,
    totalSwings,
    fullSwings: null,
    shortGameSwings: null,
    puttingSwings: null,
    walked,
    usedCart: isRoundLike ? true : null,
    competition,
    rpe,
    mentalPressure,
    physicalDemand: null,
    sessionLoad,
    notes: "Automatically logged from imported golf activity.",
  };
}

function isRoundLikeSession(sessionType: ImportedTrainingSessionType) {
  return (
    sessionType === "round" || sessionType === "simulator" || sessionType === "simulated_course"
  );
}

function roundTitle(input: ImportedTrainingSessionInput) {
  const courseName = input.courseName?.trim();
  return courseName || "Golf round";
}

function practiceTitle(input: ImportedTrainingSessionInput) {
  if (input.source === "rapsodo") {
    return "Rapsodo practice";
  }

  if (input.source === "trackman") {
    return "TrackMan practice";
  }

  if (input.source === "square") {
    return "Square practice";
  }

  return input.fileName.trim() || "Imported practice";
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
