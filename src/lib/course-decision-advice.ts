import { formatClubType, isShortGameTouchClubType } from "@/lib/club-format";
import type { StockYardage } from "@/lib/stock-yardage";

export type ClubDecisionLabel =
  | "Trust"
  | "Developing"
  | "Needs calibration"
  | "Do not trust yet"
  | "Touch shots only";
export type CourseDecisionTone = "green" | "sky" | "pink" | "amber" | "slate";

export type CourseDecisionClub = {
  id: string;
  type: string;
  brandModel?: string | null;
  isShortGameTouch?: boolean;
  stock: Pick<
    StockYardage,
    "carryMedianYd" | "recommendedPlayNumberYd" | "confidenceScore" | "label"
  >;
  touch?: {
    sampleSize: number;
    carryMedianYd: number | null;
    carryP25Yd: number | null;
    carryP75Yd: number | null;
  };
};

export type CourseDecisionAdvice = {
  key: "200-out" | "180-tee" | "150-approach" | "inside-100";
  label: string;
  value: string;
  detail: string;
  tone: CourseDecisionTone;
  clubId?: string;
};

type TrustedClub = CourseDecisionClub & {
  playNumberYd: number;
  decisionLabel: Extract<ClubDecisionLabel, "Trust" | "Developing">;
};

export function getClubDecisionLabel(input: {
  isShortGameTouch?: boolean;
  stockLabel: StockYardage["label"] | string | null | undefined;
}): ClubDecisionLabel {
  if (input.isShortGameTouch) {
    return "Touch shots only";
  }

  if (input.stockLabel === "Reliable") {
    return "Trust";
  }

  if (input.stockLabel === "Developing") {
    return "Developing";
  }

  if (input.stockLabel === "Unstable") {
    return "Needs calibration";
  }

  return "Do not trust yet";
}

export function getClubDecisionTone(label: ClubDecisionLabel): CourseDecisionTone {
  if (label === "Trust") {
    return "green";
  }

  if (label === "Developing") {
    return "sky";
  }

  if (label === "Touch shots only" || label === "Needs calibration") {
    return "amber";
  }

  return "pink";
}

export function buildCourseDecisionAdvice(clubs: CourseDecisionClub[]): CourseDecisionAdvice[] {
  const trustedStockClubs = clubs
    .map((club) => {
      const decisionLabel = getClubDecisionLabel({
        isShortGameTouch: club.isShortGameTouch ?? isShortGameTouchClubType(club.type),
        stockLabel: club.stock.label,
      });
      const playNumberYd = club.stock.recommendedPlayNumberYd ?? club.stock.carryMedianYd;

      if ((decisionLabel !== "Trust" && decisionLabel !== "Developing") || playNumberYd === null) {
        return null;
      }

      return {
        ...club,
        decisionLabel,
        playNumberYd,
      };
    })
    .filter((club): club is TrustedClub => club !== null);

  return [
    buildTwoHundredOutAdvice(trustedStockClubs),
    buildOneEightyTeeAdvice(trustedStockClubs),
    buildOneFiftyApproachAdvice(trustedStockClubs),
    buildInsideHundredAdvice(clubs, trustedStockClubs),
  ];
}

function buildTwoHundredOutAdvice(clubs: TrustedClub[]): CourseDecisionAdvice {
  const club = nearestClub(
    clubs.filter((candidate) => candidate.type !== "driver"),
    200,
    35,
  );

  if (!club) {
    return {
      key: "200-out",
      label: "200 yd out",
      value: "No trusted non-driver",
      detail:
        "Build a fairway wood, hybrid, or long-iron sample before making this a pressure number.",
      tone: "amber",
    };
  }

  return {
    key: "200-out",
    label: "200 yd out",
    value: `${formatClubType(club.type)} ${formatYards(club.playNumberYd)}`,
    detail: `Use the current ${club.decisionLabel.toLowerCase()} number and leave driver out of this decision.`,
    tone: getClubDecisionTone(club.decisionLabel),
    clubId: club.id,
  };
}

function buildOneEightyTeeAdvice(clubs: TrustedClub[]): CourseDecisionAdvice {
  const club = nearestClub(clubs.filter(isPositionClub), 180, 30);

  if (!club) {
    return {
      key: "180-tee",
      label: "180 yd tee or layup",
      value: "Needs a position club",
      detail: "Prioritise a trusted wood, hybrid, or long iron for controlled tee shots.",
      tone: "amber",
    };
  }

  return {
    key: "180-tee",
    label: "180 yd tee or layup",
    value: `${formatClubType(club.type)} ${formatYards(club.playNumberYd)}`,
    detail: "Use this as the position club when driver brings too much trouble into play.",
    tone: getClubDecisionTone(club.decisionLabel),
    clubId: club.id,
  };
}

function buildOneFiftyApproachAdvice(clubs: TrustedClub[]): CourseDecisionAdvice {
  const irons = clubs.filter((club) => /^[1-9]i$/.test(club.type));
  const club = nearestClub(irons, 150, 30);

  if (!club) {
    return {
      key: "150-approach",
      label: "150 yd approach",
      value: "Needs iron calibration",
      detail: "Add clean mid-iron stock shots before trusting one course number here.",
      tone: "amber",
    };
  }

  const saferLongerClub = irons
    .filter(
      (candidate) => candidate.playNumberYd > club.playNumberYd && candidate.playNumberYd <= 175,
    )
    .sort((left, right) => left.playNumberYd - right.playNumberYd)[0];
  const dangerDetail =
    club.playNumberYd < 147 && saferLongerClub
      ? `If short is danger, club up to ${formatClubType(saferLongerClub.type)}.`
      : "If short is danger, club up instead of forcing the top end.";

  return {
    key: "150-approach",
    label: "150 yd approach",
    value: `${formatClubType(club.type)} ${formatYards(club.playNumberYd)}`,
    detail: dangerDetail,
    tone: getClubDecisionTone(club.decisionLabel),
    clubId: club.id,
  };
}

function buildInsideHundredAdvice(
  clubs: CourseDecisionClub[],
  trustedStockClubs: TrustedClub[],
): CourseDecisionAdvice {
  const fullWedge = trustedStockClubs
    .filter(
      (club) =>
        isWedgeType(club.type) && !isShortGameTouchClubType(club.type) && club.playNumberYd <= 115,
    )
    .sort(
      (left, right) => Math.abs(left.playNumberYd - 100) - Math.abs(right.playNumberYd - 100),
    )[0];

  if (fullWedge) {
    return {
      key: "inside-100",
      label: "Inside 100 yd",
      value: `${formatClubType(fullWedge.type)} ladder`,
      detail: `Use ${formatYards(fullWedge.playNumberYd)} as the full-shot anchor, then take yardage off by window.`,
      tone: getClubDecisionTone(fullWedge.decisionLabel),
      clubId: fullWedge.id,
    };
  }

  const touchClub = clubs
    .filter((club) => club.isShortGameTouch ?? isShortGameTouchClubType(club.type))
    .sort((left, right) => (right.touch?.sampleSize ?? 0) - (left.touch?.sampleSize ?? 0))[0];
  const touchWindow =
    touchClub?.touch?.carryP25Yd !== null &&
    touchClub?.touch?.carryP25Yd !== undefined &&
    touchClub.touch.carryP75Yd !== null &&
    touchClub.touch.carryP75Yd !== undefined
      ? `${formatYards(touchClub.touch.carryP25Yd)}-${formatYards(touchClub.touch.carryP75Yd)}`
      : "30/50/70 yd";

  return {
    key: "inside-100",
    label: "Inside 100 yd",
    value: touchClub ? `${formatClubType(touchClub.type)} touch only` : "Wedge ladder",
    detail: `Use the ${touchWindow} touch windows; keep chips and pitches out of full-stock numbers.`,
    tone: "amber",
    clubId: touchClub?.id,
  };
}

function nearestClub(clubs: TrustedClub[], targetYd: number, maxGapYd: number) {
  return clubs
    .map((club) => ({ club, gap: Math.abs(club.playNumberYd - targetYd) }))
    .filter((entry) => entry.gap <= maxGapYd)
    .sort(
      (left, right) => left.gap - right.gap || right.club.playNumberYd - left.club.playNumberYd,
    )[0]?.club;
}

function isPositionClub(club: TrustedClub) {
  if (/^[1-9][wh]$/.test(club.type)) {
    return true;
  }

  const iron = club.type.match(/^([1-9])i$/);
  return iron ? Number(iron[1]) <= 6 : false;
}

function isWedgeType(clubType: string) {
  return ["pw", "gw", "aw", "sw", "lw", "wedge"].includes(clubType);
}

function formatYards(value: number) {
  return `${Math.round(value)} yd`;
}
