import { formatHandicapValue, type HandicapSummary } from "@/lib/round-handicap";

export type DashboardTone = "green" | "sky" | "amber" | "slate" | "pink";

export const integerFormatter = new Intl.NumberFormat("en-GB");
export const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function formatHandicapTrend(summary: HandicapSummary) {
  const trend = summary.trend.direction;
  const delta = summary.trend.delta;

  if (trend === "down" && typeof delta === "number") {
    return `Improved by ${formatHandicapValue(Math.abs(delta))}`;
  }

  if (trend === "up" && typeof delta === "number") {
    return `Higher by ${formatHandicapValue(Math.abs(delta))}`;
  }

  if (trend === "flat") {
    return "Flat trend";
  }

  return `${summary.sampleSize} round sample`;
}

export function formatScoreVsPar(score: number | null, par: number | null) {
  if (typeof score !== "number") {
    return "--";
  }

  if (typeof par !== "number") {
    return integerFormatter.format(score);
  }

  const versusPar = score - par;
  return `${integerFormatter.format(score)} (${versusPar >= 0 ? "+" : ""}${integerFormatter.format(versusPar)})`;
}

export function getRoundHoleHighlights(latestRound: {
  scorecardJson: Array<{
    par: number;
    score?: number | null;
  }> | null;
}) {
  const holes = (latestRound.scorecardJson ?? [])
    .map((hole, index) => ({
      holeNumber: index + 1,
      delta: typeof hole.score === "number" ? hole.score - hole.par : null,
    }))
    .filter((hole): hole is { holeNumber: number; delta: number } => hole.delta !== null);

  if (holes.length === 0) {
    return null;
  }

  const best = holes.reduce((left, right) => (right.delta < left.delta ? right : left));
  const worst = holes.reduce((left, right) => (right.delta > left.delta ? right : left));

  return {
    best: `${best.delta <= -1 ? "Birdie" : formatHoleResult(best.delta)} · hole ${best.holeNumber}`,
    watch: worst.delta > 0 ? `+${worst.delta} · hole ${worst.holeNumber}` : null,
  };
}

export function formatHoleResult(delta: number | null) {
  if (delta === null) {
    return "--";
  }

  if (delta <= -1) {
    return "Bird";
  }

  if (delta === 0) {
    return "Par";
  }

  if (delta === 1) {
    return "Bog";
  }

  return `+${delta}`;
}

export function holeResultClass(delta: number | null) {
  if (delta === null) {
    return "bg-[#F2F4F7] text-[#667085]";
  }

  if (delta <= -1) {
    return "bg-[#E8F7EE] text-[#087A3D]";
  }

  if (delta === 0) {
    return "bg-[#EAF1FF] text-[#2563EB]";
  }

  if (delta === 1) {
    return "bg-[#FFF4DB] text-[#8A4B00]";
  }

  return "bg-[#FEE4E2] text-[#B42318]";
}

export function getCompactPracticeTask(drill: string) {
  return drill.split(/\s+The goal\b/i)[0]?.trim() || drill;
}

export function getDashboardPracticeTask(coachPreview: { issueLabel: string; drill: string }) {
  if (/direction/i.test(coachPreview.issueLabel)) {
    return "Hit 10 balls with a hard left boundary. Count only shots inside the playable window.";
  }

  return getCompactPracticeTask(coachPreview.drill);
}

export function normalizeDashboardTone(tone: DashboardTone): Exclude<DashboardTone, "pink"> {
  return tone === "pink" ? "amber" : tone;
}

export function toneDotClass(tone: DashboardTone) {
  switch (normalizeDashboardTone(tone)) {
    case "green":
      return "bg-[#0F8F4D] ring-[#E8F7EE]";
    case "amber":
      return "bg-[#8A4B00] ring-[#FFF4DB]";
    case "sky":
      return "bg-[#2563EB] ring-[#EAF1FF]";
    case "slate":
      return "bg-[#98A2B3] ring-[#F2F4F7]";
  }
}

export function toneSoftClass(tone: DashboardTone) {
  switch (normalizeDashboardTone(tone)) {
    case "green":
      return "bg-[#E8F7EE] text-[#087A3D]";
    case "amber":
      return "bg-[#FFF4DB] text-[#8A4B00]";
    case "sky":
      return "bg-[#EAF1FF] text-[#2563EB]";
    case "slate":
      return "bg-[#F2F4F7] text-[#667085]";
  }
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

export function formatSignedYards(value: number) {
  return `${formatSignedNumber(value)} yd`;
}

export function formatSignedNumber(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)}`;
}

export function formatSessionType(value: string) {
  if (value === "real_round") {
    return "Real round";
  }

  if (value === "simulated_course") {
    return "Sim course";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
