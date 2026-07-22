import { formatClubType } from "@/lib/club-format";

export type PostRoundReviewShot = {
  clubId: string;
  clubType: string;
  carryYd: number | null;
  sideYd: number | null;
};

export type StoredPostRoundReview = {
  feltDifferent: string;
  troubleClub: string;
  contextChange: string;
  shotsToReview: string;
};

export function buildPostRoundReview(input: {
  currentShots: PostRoundReviewShot[];
  baselineShots: PostRoundReviewShot[];
}) {
  const current = clubReads(input.currentShots).filter((club) => club.sampleSize >= 3);
  const baseline = new Map(
    clubReads(input.baselineShots)
      .filter((club) => club.sampleSize >= 3)
      .map((club) => [club.clubId, club]),
  );
  const strongest = [...current].sort(
    (left, right) =>
      right.playableRate - left.playableRate || left.averageAbsSide - right.averageAbsSide,
  )[0];
  const costly = [...current].sort(
    (left, right) =>
      right.averageAbsSide - left.averageAbsSide || left.playableRate - right.playableRate,
  )[0];
  const changes = current.flatMap((club) => {
    const prior = baseline.get(club.clubId);
    return prior ? [{ club, prior, delta: club.averageAbsSide - prior.averageAbsSide }] : [];
  });
  const biggestChange = [...changes].sort(
    (left, right) => Math.abs(right.delta) - Math.abs(left.delta),
  )[0];
  const totalShots = current.reduce((total, club) => total + club.sampleSize, 0);

  return {
    strongest: strongest
      ? {
          value: strongest.label,
          detail: `${strongest.playableRate}% inside the 15 yd lateral window · ${strongest.sampleSize} measured shots.`,
        }
      : noRead("No trusted club read", "At least three measured shots per club are required."),
    mostCostly: costly
      ? {
          value: costly.label,
          detail: `${costly.averageAbsSide.toFixed(1)} yd average lateral miss · ${costly.sampleSize} measured shots.`,
        }
      : noRead("No costly pattern yet", "Add measured round shots before assigning a costly club."),
    biggestDifference: biggestChange
      ? {
          value: `${biggestChange.club.label} ${signed(biggestChange.delta)} yd`,
          detail: `${biggestChange.delta > 0 ? "Wider" : "Tighter"} than the earlier personal baseline (${biggestChange.prior.sampleSize} comparison shots).`,
        }
      : noRead(
          "No like-for-like baseline",
          "This round does not yet have a club with three measured shots in both periods.",
        ),
    practiceRecommendation: costly
      ? {
          value: `${costly.label} start-line block`,
          detail: `Rebuild a 10-shot measured sample and try to beat ${costly.averageAbsSide.toFixed(1)} yd average lateral miss.`,
          clubId: costly.clubId,
        }
      : {
          value: "Capture the round evidence",
          detail: "Import or connect measured shots before changing the practice plan.",
          clubId: null,
        },
    confidence:
      totalShots >= 20 && current.length >= 3 ? "High" : totalShots >= 10 ? "Moderate" : "Low",
    evidence: `${totalShots} measured shots across ${current.length} club${current.length === 1 ? "" : "s"} with 3+ shots. Manual answers remain context, not scoring evidence.`,
  } as const;
}

export function readStoredPostRoundReview(notes: string | null): StoredPostRoundReview {
  const block = notes?.match(
    /\[LMWT_POST_ROUND_REVIEW\]\n([\s\S]*?)\n\[\/LMWT_POST_ROUND_REVIEW\]/,
  )?.[1];
  if (!block) return emptyReview();
  const values = Object.fromEntries(
    block.split("\n").map((line) => {
      const index = line.indexOf(":");
      return index > 0 ? [line.slice(0, index), line.slice(index + 1).trim()] : [line, ""];
    }),
  );
  return {
    feltDifferent: values.feltDifferent ?? "",
    troubleClub: values.troubleClub ?? "",
    contextChange: values.contextChange ?? "",
    shotsToReview: values.shotsToReview ?? "",
  };
}

export function mergeStoredPostRoundReview(notes: string | null, review: StoredPostRoundReview) {
  const existing = (notes ?? "")
    .replace(/\n?\[LMWT_POST_ROUND_REVIEW\]\n[\s\S]*?\n\[\/LMWT_POST_ROUND_REVIEW\]\n?/g, "\n")
    .trim();
  const block = [
    "[LMWT_POST_ROUND_REVIEW]",
    `feltDifferent: ${singleLine(review.feltDifferent)}`,
    `troubleClub: ${singleLine(review.troubleClub)}`,
    `contextChange: ${singleLine(review.contextChange)}`,
    `shotsToReview: ${singleLine(review.shotsToReview)}`,
    "[/LMWT_POST_ROUND_REVIEW]",
  ].join("\n");
  return [existing, block].filter(Boolean).join("\n\n");
}

function clubReads(shots: PostRoundReviewShot[]) {
  const groups = new Map<string, PostRoundReviewShot[]>();
  for (const shot of shots) {
    if (shot.sideYd === null) continue;
    groups.set(shot.clubId, [...(groups.get(shot.clubId) ?? []), shot]);
  }
  return [...groups.entries()].map(([clubId, rows]) => ({
    clubId,
    label: formatClubType(rows[0]?.clubType ?? "club"),
    sampleSize: rows.length,
    averageAbsSide: average(rows.map((shot) => Math.abs(shot.sideYd!))),
    playableRate: Math.round(
      (rows.filter((shot) => Math.abs(shot.sideYd!) <= 15).length / rows.length) * 100,
    ),
  }));
}

function noRead(value: string, detail: string) {
  return { value, detail };
}

function emptyReview(): StoredPostRoundReview {
  return { feltDifferent: "", troubleClub: "", contextChange: "", shotsToReview: "" };
}

function singleLine(value: string) {
  return value
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 600);
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function signed(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}
