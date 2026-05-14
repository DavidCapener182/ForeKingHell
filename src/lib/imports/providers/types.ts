export type LaunchMonitorProviderKind = "rapsodo" | "square" | "trackman";

export type ProviderInput = {
  fileName?: string;
  text: string;
};

export type NormalizedMetric =
  | "carry_yards"
  | "total_yards"
  | "offline_yards"
  | "ball_speed_mph"
  | "club_speed_mph"
  | "launch_angle_deg"
  | "launch_direction_deg"
  | "spin_rate_rpm"
  | "spin_axis_deg"
  | "apex_feet"
  | "descent_angle_deg"
  | "attack_angle_deg"
  | "club_path_deg"
  | "face_angle_deg"
  | "smash_factor";

export type NormalizedShot = {
  shotNumber: number | null;
  clubRaw: string | null;
  clubType: string;
  metrics: Partial<Record<NormalizedMetric, number>>;
  raw: Record<string, string>;
  warnings: string[];
};

export type NormalizedSession = {
  providerKind: LaunchMonitorProviderKind;
  sessionTitle: string | null;
  shotCount: number;
  shots: NormalizedShot[];
  rawHeaders: string[];
  warnings: string[];
};

export type LaunchMonitorProvider = {
  providerKind: LaunchMonitorProviderKind;
  label: string;
  status: "live" | "beta" | "research";
  detect(input: ProviderInput): Promise<boolean>;
  parse(input: ProviderInput): Promise<NormalizedSession>;
  mapClub(rawClub: string | null): string;
  mapMetric(rawMetric: string): NormalizedMetric | null;
};

export function parseDelimitedRows(text: string) {
  const delimiter = text.includes("\t") && text.split("\t").length > text.split(",").length ? "\t" : ",";
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitDelimitedLine(line, delimiter));
}

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function numberFromCell(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function splitDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}
