export const conditionDimensions = [
  "context",
  "temperature",
  "wind",
  "elevation",
  "surface",
  "ball",
  "ground",
] as const;

export type ConditionDimension = (typeof conditionDimensions)[number];

export type ConditionShot = {
  sessionId: string;
  carryYd: number | null;
  sideCarryYd: number | null;
  playContext: string | null;
  location?: string | null;
  weather?: {
    conditions?: string | null;
    wind?: string | null;
    temperature?: string | null;
  } | null;
  sourceRaw?: Record<string, string> | null;
};

export type ConditionGroup = {
  label: string;
  shotCount: number;
  sessionCount: number;
  meanCarryYd: number | null;
  meanAbsoluteSideYd: number | null;
  confidence: "High" | "Moderate" | "Low";
};

export type ConditionBreakdown = {
  dimension: ConditionDimension;
  label: string;
  description: string;
  recordedShots: number;
  unclassifiedShots: number;
  groups: ConditionGroup[];
  caveat: string;
};

const dimensionCopy: Record<
  ConditionDimension,
  { label: string; description: string; unknown: string }
> = {
  context: {
    label: "Course, range and indoor",
    description: "Keeps on-course truth separate from range, simulator and indoor samples.",
    unknown: "Unclassified context",
  },
  temperature: {
    label: "Temperature",
    description: "Compares cold, mild and warm recorded sessions.",
    unknown: "Temperature not recorded",
  },
  wind: {
    label: "Wind",
    description: "Separates calm, breezy and windy samples when wind was recorded.",
    unknown: "Wind not recorded",
  },
  elevation: {
    label: "Elevation",
    description: "Separates lower and elevated venues using recorded elevation metadata.",
    unknown: "Elevation not recorded",
  },
  surface: {
    label: "Mat or grass",
    description: "Compares recorded hitting surfaces without inferring an unknown lie.",
    unknown: "Surface not recorded",
  },
  ball: {
    label: "Range or premium ball",
    description: "Keeps limited-flight range balls separate from named personal or premium balls.",
    unknown: "Ball not recorded",
  },
  ground: {
    label: "Wet or dry",
    description: "Uses recorded weather and condition text only.",
    unknown: "Ground condition not recorded",
  },
};

export function buildConditionsAnalysis(shots: ConditionShot[]): ConditionBreakdown[] {
  return conditionDimensions.map((dimension) => {
    const copy = dimensionCopy[dimension];
    const buckets = new Map<string, ConditionShot[]>();
    let unclassifiedShots = 0;

    for (const shot of shots) {
      const label = classifyCondition(shot, dimension);
      if (!label) {
        unclassifiedShots += 1;
        continue;
      }
      buckets.set(label, [...(buckets.get(label) ?? []), shot]);
    }

    const groups = [...buckets.entries()]
      .map(([label, rows]) => summariseGroup(label, rows))
      .sort(
        (left, right) => right.shotCount - left.shotCount || left.label.localeCompare(right.label),
      );
    const recordedShots = groups.reduce((total, group) => total + group.shotCount, 0);
    const comparableGroups = groups.filter((group) => group.shotCount >= 6);

    return {
      dimension,
      label: copy.label,
      description: copy.description,
      recordedShots,
      unclassifiedShots,
      groups,
      caveat:
        comparableGroups.length >= 2
          ? "Association only: conditions can move together with venue, strike and session intent."
          : `Need at least two recorded groups with six shots each. ${copy.unknown} rows stay outside the comparison.`,
    };
  });
}

export function strongestConditionDifference(breakdowns: ConditionBreakdown[]) {
  const candidates = breakdowns.flatMap((breakdown) => {
    const groups = breakdown.groups.filter(
      (group) => group.shotCount >= 6 && group.meanCarryYd !== null,
    );
    if (groups.length < 2) return [];
    const sorted = [...groups].sort(
      (left, right) => (left.meanCarryYd ?? 0) - (right.meanCarryYd ?? 0),
    );
    const low = sorted[0];
    const high = sorted.at(-1)!;
    return [
      {
        dimension: breakdown.label,
        low,
        high,
        deltaYd: (high.meanCarryYd ?? 0) - (low.meanCarryYd ?? 0),
      },
    ];
  });

  return candidates.sort((left, right) => right.deltaYd - left.deltaYd)[0] ?? null;
}

function summariseGroup(label: string, shots: ConditionShot[]): ConditionGroup {
  const carry = shots.map((shot) => shot.carryYd).filter(isNumber);
  const side = shots.map((shot) => shot.sideCarryYd).filter(isNumber);
  const sessionCount = new Set(shots.map((shot) => shot.sessionId)).size;
  return {
    label,
    shotCount: shots.length,
    sessionCount,
    meanCarryYd: average(carry),
    meanAbsoluteSideYd: average(side.map(Math.abs)),
    confidence:
      shots.length >= 30 && sessionCount >= 3
        ? "High"
        : shots.length >= 12 && sessionCount >= 2
          ? "Moderate"
          : "Low",
  };
}

function classifyCondition(shot: ConditionShot, dimension: ConditionDimension) {
  const raw = normalizedRaw(shot.sourceRaw);
  const combined = [
    shot.location,
    shot.weather?.conditions,
    shot.weather?.wind,
    shot.weather?.temperature,
    ...Object.values(raw),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  switch (dimension) {
    case "context": {
      const context = shot.playContext?.toLowerCase().replace(/[\s-]+/g, "_") ?? "unknown";
      if (context === "on_course") return "Course";
      if (context === "simulator") return "Simulator";
      if (context === "indoor" || /\b(indoor|studio)\b/.test(combined)) return "Indoor";
      if (context === "practice_bay") return "Outdoor range / bay";
      return null;
    }
    case "temperature": {
      const value = firstNumber(
        shot.weather?.temperature,
        raw.temperature,
        raw.temp,
        raw.temperaturec,
      );
      if (value === null) return null;
      if (value < 10) return "Cold · under 10°C";
      if (value < 18) return "Mild · 10–17°C";
      return "Warm · 18°C+";
    }
    case "wind": {
      const source = shot.weather?.wind ?? raw.wind ?? raw.windspeed ?? raw.windmph;
      const value = firstNumber(source);
      if (value !== null) {
        if (value >= 12) return "Windy · 12 mph+";
        if (value >= 5) return "Breezy · 5–11 mph";
        return "Calm · under 5 mph";
      }
      if (/\b(windy|strong wind|gale)\b/.test(combined)) return "Windy · described";
      if (/\b(calm|still)\b/.test(combined)) return "Calm · described";
      return null;
    }
    case "elevation": {
      const value = firstNumber(raw.elevation, raw.elevationm, raw.altitude, raw.altitudem);
      if (value === null) return null;
      return value > 100 ? "Elevated · over 100 m" : "Lower · 100 m or below";
    }
    case "surface": {
      const surface = [raw.surface, raw.lie, raw.turf, raw.hittingsurface]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (/\b(mat|artificial|simulator)\b/.test(surface)) return "Mat";
      if (/\b(grass|turf|fairway|rough)\b/.test(surface)) return "Grass";
      return null;
    }
    case "ball": {
      const ball = [raw.ball, raw.ballmodel, raw.balltype, raw["ball model"]]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!ball) return null;
      if (/\b(range|limited|floater|practice)\b/.test(ball)) return "Range / limited-flight ball";
      if (/\b(pro v1|prov1|tp5|tour|chrome soft|z-star|z star|premium|rxs?|xs)\b/.test(ball)) {
        return "Premium ball";
      }
      return "Other named ball";
    }
    case "ground": {
      if (/\b(wet|rain|rainy|drizzle|shower|damp|soft)\b/.test(combined)) return "Wet / soft";
      if (/\b(dry|clear|sunny|firm)\b/.test(combined)) return "Dry / firm";
      return null;
    }
  }
}

function normalizedRaw(raw: Record<string, string> | null | undefined) {
  return Object.fromEntries(
    Object.entries(raw ?? {}).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]/g, ""),
      String(value),
    ]),
  );
}

function firstNumber(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const match = value?.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
