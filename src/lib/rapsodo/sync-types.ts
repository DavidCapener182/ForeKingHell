import type { RapsodoProviderKind } from "@/lib/rapsodo/cloud-client";
import type { RapsodoClubChoice, RapsodoClubSuggestion } from "@/lib/rapsodo/club-inference";
import type { CourseScorecardHole } from "@/lib/course-scorecard";
import type { DistanceUnit } from "@/lib/rapsodo/parser";

export type RapsodoSessionListItem = {
  providerKind: RapsodoProviderKind;
  providerSessionId: string;
  providerSessionType: string | null;
  providerSessionMode: string | null;
  title: string;
  dateIso: string | null;
  shotCount: number | null;
  courseName: string | null;
  importedSessionId: string | null;
  exportRawCsvHash: string | null;
  lastImportedAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  isNew: boolean;
};

export type RapsodoPreviewShot = {
  rowNumber: number;
  shotNumber: number | null;
  reportedClubLabel: string;
  reportedClubType: string;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  launchAngleDeg: number | null;
  sideCarryYd: number | null;
  rapsodoShotId: string | null;
  reportedChoice: RapsodoClubChoice | null;
  suggestion: RapsodoClubSuggestion;
};

export type RapsodoSessionPreview = {
  session: RapsodoSessionListItem;
  rawCsvText: string;
  fileName: string;
  fileSizeBytes: number;
  rawCsvHash: string;
  distanceUnit: DistanceUnit;
  sessionType: "range" | "round" | "simulator" | "simulated_course";
  sessionDate: string;
  courseName: string;
  courseScorecard: CourseScorecardHole[];
  courseScorecardSource: "saved_round" | "course_database" | null;
  warnings: string[];
  shotCount: number;
  rawRowCount: number;
  shots: RapsodoPreviewShot[];
  clubChoices: RapsodoClubChoice[];
};
