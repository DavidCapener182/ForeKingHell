export type PracticeBlockViewLike = {
  id: string;
  order: number;
  type: string;
  title: string;
  clubs: string[];
  ballCount: number | null;
  timeMinutes: number;
  successTarget: string;
};

export type PracticePlanViewLike = {
  totalBalls: number | null;
  blocks: PracticeBlockViewLike[];
};

export type PracticeComparisonViewLike = {
  decisions: Array<{
    blockId: string;
    actual: string;
    actualBalls: number;
    matchedPlannedVolume: boolean;
    decision: "maintain" | "repeat_once" | "keep_priority" | "move_down";
  }>;
} | null;

export type PracticeBlockImportStatus =
  | "waiting_for_upload"
  | "matched_from_upload"
  | "needs_more_data"
  | "no_matching_shots";

export type PracticeFocusSummary = {
  main: string;
  secondary: string | null;
  scoring: string | null;
  maintenance: string | null;
  howToPractice: string;
  totalPlannedBalls: number;
  blockCount: number;
};

export function summarizePracticeImportControl(
  plan: PracticePlanViewLike,
  comparison: PracticeComparisonViewLike,
) {
  const totalBalls =
    plan.totalBalls ?? plan.blocks.reduce((total, block) => total + (block.ballCount ?? 0), 0);
  const decisions = comparison?.decisions ?? [];
  const matchedBlockIds = new Set(
    decisions
      .filter((decision) => decision.actualBalls > 0 && decision.matchedPlannedVolume)
      .map((decision) => decision.blockId),
  );
  const matchedBlocks = plan.blocks.filter((block) => matchedBlockIds.has(block.id)).length;
  const importedBalls = plan.blocks.reduce((total, block) => {
    const decision = decisions.find((item) => item.blockId === block.id);

    if (!decision || decision.actualBalls <= 0) {
      return total;
    }

    return total + Math.min(decision.actualBalls, block.ballCount ?? decision.actualBalls);
  }, 0);

  return {
    matchedBlocks,
    totalBlocks: plan.blocks.length,
    importedBalls,
    totalBalls,
    progressPercent:
      plan.blocks.length > 0 ? Math.round((matchedBlocks / plan.blocks.length) * 100) : 0,
  };
}

export function hasPlanVsActualData(comparison: PracticeComparisonViewLike) {
  return Boolean(comparison?.decisions.some((decision) => decision.actualBalls > 0));
}

export function defaultSelectedPracticeBlockId(blocks: PracticeBlockViewLike[]) {
  return (
    findMainPriorityBlock(blocks)?.id ??
    blocks.find((block) => block.type === "technical")?.id ??
    blocks.find((block) => block.type !== "warmup" && block.type !== "warmup_round")?.id ??
    blocks[0]?.id ??
    null
  );
}

export function buildPracticeFocusSummary(plan: PracticePlanViewLike): PracticeFocusSummary {
  const main = findMainPriorityBlock(plan.blocks);
  const secondary =
    plan.blocks.find((block) => block.id !== main?.id && /secondary/i.test(block.title)) ??
    plan.blocks.find((block) => block.id !== main?.id && block.type === "technical") ??
    null;
  const scoring =
    plan.blocks.find((block) => block.type === "scoring" || /wedge|ladder|scoring/i.test(block.title)) ??
    null;
  const maintenance =
    plan.blocks.find(
      (block) =>
        block.id !== main?.id &&
        /maintenance|driver/i.test(block.title) &&
        !/baseline/i.test(block.title),
    ) ?? null;
  const transfer =
    plan.blocks.find((block) => block.type === "random" || /transfer|finish/i.test(block.title)) ??
    null;
  const howToPractice = uniqueLabels([main, scoring, transfer].map((block) => block && drillLabel(block)))
    .slice(0, 3)
    .join(" -> ");

  return {
    main: main ? cleanPracticeBlockTitle(main.title) : "Build a baseline",
    secondary: secondary ? cleanPracticeBlockTitle(secondary.title) : null,
    scoring: scoring ? cleanPracticeBlockTitle(scoring.title) : null,
    maintenance: maintenance ? cleanPracticeBlockTitle(maintenance.title) : null,
    howToPractice: howToPractice || "Warm up -> priority work -> random finish",
    totalPlannedBalls:
      plan.totalBalls ?? plan.blocks.reduce((total, block) => total + (block.ballCount ?? 0), 0),
    blockCount: plan.blocks.length,
  };
}

export function compactPracticeBlockRow(
  block: PracticeBlockViewLike,
  comparison: PracticeComparisonViewLike,
) {
  const decision = comparison?.decisions.find((item) => item.blockId === block.id) ?? null;
  const importStatus = blockImportStatus(decision);

  return {
    blockLabel: `Block ${block.order}`,
    typeLabel: block.type.replace(/_/g, " "),
    title: block.title,
    clubLabel: block.clubs.map((club) => club.toUpperCase()).join(", "),
    volumeLabel: block.ballCount === null ? `${block.timeMinutes} min` : `${block.ballCount} balls`,
    successTarget: block.successTarget,
    importStatus,
    statusLabel: importStatusLabel(importStatus),
    importedEvidence: decision?.actual ?? "Scored after upload.",
  };
}

export function scoredFromLabel(block: PracticeBlockViewLike) {
  const clubLabel = block.clubs.length > 0
    ? block.clubs.map((club) => club.toUpperCase()).join(", ")
    : "matching";

  return `${clubLabel} imported shots after upload.`;
}

function findMainPriorityBlock(blocks: PracticeBlockViewLike[]) {
  return (
    blocks.find((block) => /main priority/i.test(block.title)) ??
    blocks.find((block) => block.type === "technical" && !/baseline/i.test(block.title)) ??
    null
  );
}

function cleanPracticeBlockTitle(title: string) {
  return title
    .replace(/^repeat feel:\s*/i, "")
    .replace(/^main priority:\s*/i, "")
    .replace(/^secondary priority:\s*/i, "")
    .trim();
}

function drillLabel(block: PracticeBlockViewLike) {
  const source = `${block.title} ${block.successTarget}`.toLowerCase();

  if (source.includes("wedge") || source.includes("ladder")) {
    return "wedge ladder";
  }

  if (source.includes("random") || source.includes("transfer") || source.includes("finish")) {
    return "random finish";
  }

  if (source.includes("start line") || source.includes("corridor")) {
    return "start-line gate";
  }

  if (source.includes("baseline")) {
    return "baseline check";
  }

  return cleanPracticeBlockTitle(block.title).toLowerCase();
}

function uniqueLabels(labels: Array<string | null | false>) {
  const seen = new Set<string>();

  return labels.filter((label): label is string => {
    if (!label || seen.has(label)) {
      return false;
    }

    seen.add(label);
    return true;
  });
}

function blockImportStatus(
  decision: NonNullable<PracticeComparisonViewLike>["decisions"][number] | null,
): PracticeBlockImportStatus {
  if (!decision || decision.actualBalls === 0) {
    return decision ? "no_matching_shots" : "waiting_for_upload";
  }

  return decision.matchedPlannedVolume ? "matched_from_upload" : "needs_more_data";
}

function importStatusLabel(status: PracticeBlockImportStatus) {
  switch (status) {
    case "matched_from_upload":
      return "Matched from upload";
    case "needs_more_data":
      return "Needs more shots";
    case "no_matching_shots":
      return "No matching shots";
    case "waiting_for_upload":
      return "Waiting for upload";
  }
}
