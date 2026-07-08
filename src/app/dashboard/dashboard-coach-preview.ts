import { formatClubType } from "@/lib/club-format";
import type { PathTrendTracking } from "@/lib/bag-intelligence";

type DashboardCoachClub = {
  id: string;
  type: string;
  stock: {
    coursePlayCarryYd: number | null;
    confidenceScore: number;
    sampleSize: number;
    dispersionLeftYd: number | null;
    dispersionRightYd: number | null;
  };
};

type DashboardCoachPreview = {
  clubId: string;
  clubName: string;
  issueLabel: string;
  reason: string;
  drill: string;
  tone: "green" | "sky" | "pink" | "amber" | "slate";
  trustIndex: number;
  sampleSize: number;
  stockCarryYd: number | null;
  usualMiss: "Left" | "Right" | "Balanced" | "Unknown";
  playableRate: number | null;
  launchWindow: { low: number; high: number };
};

export function buildDashboardCoachPreview({
  clubs,
  pathTrend,
}: {
  clubs: DashboardCoachClub[];
  pathTrend: PathTrendTracking;
}): DashboardCoachPreview | null {
  const clubById = new Map(clubs.map((club) => [club.id, club]));
  const pathClub = pathTrend.clubId ? (clubById.get(pathTrend.clubId) ?? null) : null;

  if (pathClub && pathTrend.status !== "building") {
    return {
      clubId: pathClub.id,
      clubName: formatClubType(pathClub.type),
      issueLabel: "Delivery pattern",
      reason: pathTrend.detail,
      drill: `Hit 10 ${formatClubType(pathClub.type)} stock shots and keep the delivery window tighter than the recent pattern.`,
      tone: toneForPathStatus(pathTrend.status),
      trustIndex: pathClub.stock.confidenceScore,
      sampleSize: Math.max(pathTrend.recentShots.length, pathClub.stock.sampleSize),
      stockCarryYd: pathClub.stock.coursePlayCarryYd,
      usualMiss: missFromDispersion(
        pathClub.stock.dispersionLeftYd,
        pathClub.stock.dispersionRightYd,
      ),
      playableRate: null,
      launchWindow: { low: 0, high: 0 },
    };
  }

  const lowTrustClub = [...clubs]
    .filter((club) => club.stock.sampleSize >= 3)
    .sort(
      (left, right) =>
        left.stock.confidenceScore - right.stock.confidenceScore ||
        right.stock.sampleSize - left.stock.sampleSize,
    )[0];

  if (!lowTrustClub) {
    return null;
  }

  return {
    clubId: lowTrustClub.id,
    clubName: formatClubType(lowTrustClub.type),
    issueLabel: lowTrustClub.stock.confidenceScore < 60 ? "Trust rebuild" : "Stock check",
    reason:
      lowTrustClub.stock.confidenceScore < 60
        ? `${formatClubType(lowTrustClub.type)} is still the lowest-trust club in the current bag.`
        : `${formatClubType(lowTrustClub.type)} needs a cleaner stock window before the dashboard can trust the carry fully.`,
    drill: `Hit 12 clean ${formatClubType(lowTrustClub.type)} stock shots and keep only normal swings in the sample.`,
    tone: lowTrustClub.stock.confidenceScore < 60 ? "amber" : "sky",
    trustIndex: lowTrustClub.stock.confidenceScore,
    sampleSize: lowTrustClub.stock.sampleSize,
    stockCarryYd: lowTrustClub.stock.coursePlayCarryYd,
    usualMiss: missFromDispersion(
      lowTrustClub.stock.dispersionLeftYd,
      lowTrustClub.stock.dispersionRightYd,
    ),
    playableRate: null,
    launchWindow: { low: 0, high: 0 },
  };
}

function toneForPathStatus(status: PathTrendTracking["status"]) {
  switch (status) {
    case "neutralising":
      return "green";
    case "stable":
      return "sky";
    case "widening":
      return "amber";
    default:
      return "slate";
  }
}

function missFromDispersion(
  dispersionLeftYd: number | null,
  dispersionRightYd: number | null,
): "Left" | "Right" | "Balanced" | "Unknown" {
  if (dispersionLeftYd === null || dispersionRightYd === null) {
    return "Unknown";
  }

  const left = Math.abs(dispersionLeftYd);
  const right = Math.abs(dispersionRightYd);

  if (left > right + 2) {
    return "Left";
  }

  if (right > left + 2) {
    return "Right";
  }

  return "Balanced";
}
