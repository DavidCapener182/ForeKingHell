export type SessionType = "range" | "round" | "simulator" | "simulated_course";

export type UploadedCsv = {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  rawCsvText: string;
};

export type HoleReviewState = Record<
  number,
  {
    shotCount?: number | null;
    penalties?: number | null;
    score?: number | null;
    putts?: number | null;
    netScore?: number | null;
    fairwayHit?: boolean | null;
    gir?: boolean | null;
    strokeIndex?: number | null;
  }
>;

export type ScorecardExtractState =
  | { status: "idle" }
  | { status: "loading"; fileName: string }
  | { status: "success"; fileName: string; message: string }
  | { status: "error"; fileName?: string; message: string };
