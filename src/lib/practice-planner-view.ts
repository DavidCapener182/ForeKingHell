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
    plannedBalls?: number | null;
    matchedPlannedVolume: boolean;
    result?: "passed" | "mixed" | "failed" | "insufficient_data";
    confidence?: "high" | "medium" | "low";
    summary?: string;
    decision: "maintain" | "repeat_once" | "keep_priority" | "move_down";
  }>;
} | null;

export type PracticeBlockImportStatus =
  | "waiting_for_upload"
  | "matched_from_upload"
  | "needs_more_data"
  | "no_matching_shots";

export type PracticeOutcomeStatus = "passed" | "not_passed" | "awaiting_evidence";

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

export function summarizePracticeOutcome(
  comparison: PracticeComparisonViewLike,
  practiceScore: number | null,
) {
  const decisions = comparison?.decisions ?? [];
  const passedBlocks = decisions.filter((decision) => decision.result === "passed").length;
  const failedBlocks = decisions.filter((decision) => decision.result === "failed").length;
  const partialBlocks = decisions.filter((decision) => decision.result === "mixed").length;
  const insufficientBlocks = decisions.filter(
    (decision) => decision.result === "insufficient_data",
  ).length;
  const hasEvidence = decisions.some((decision) => decision.actualBalls > 0);
  const status: PracticeOutcomeStatus = !hasEvidence
    ? "awaiting_evidence"
    : (practiceScore ?? 0) >= 80
      ? "passed"
      : "not_passed";
  const blocksStillToPass = Math.max(0, decisions.length - passedBlocks);

  return {
    status,
    label:
      status === "passed"
        ? "Passed"
        : status === "not_passed"
          ? "Not passed yet"
          : "Awaiting evidence",
    detail:
      status === "awaiting_evidence"
        ? "Upload today’s launch-monitor shots to score this practice."
        : blocksStillToPass === 0
          ? `All ${decisions.length} blocks passed.`
          : `${passedBlocks} of ${decisions.length} blocks passed. ${blocksStillToPass} still need work.`,
    passedBlocks,
    failedBlocks,
    partialBlocks,
    insufficientBlocks,
    totalBlocks: decisions.length,
  };
}

export function practiceDecisionResultLabel(
  decision: NonNullable<PracticeComparisonViewLike>["decisions"][number],
) {
  switch (decision.result) {
    case "passed":
      return "Passed";
    case "mixed":
      return "Partial — repeat";
    case "failed":
      return "Failed";
    case "insufficient_data":
      return "Not enough shots";
    default:
      return decision.actualBalls > 0 ? "Needs review" : "No matching shots";
  }
}

export function practiceDecisionResultTone(
  decision: NonNullable<PracticeComparisonViewLike>["decisions"][number],
): "positive" | "attention" | "critical" | "neutral" {
  switch (decision.result) {
    case "passed":
      return "positive";
    case "mixed":
      return "attention";
    case "failed":
      return "critical";
    case "insufficient_data":
    default:
      return "neutral";
  }
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
    plan.blocks.find(
      (block) => block.type === "scoring" || /wedge|ladder|scoring/i.test(block.title),
    ) ?? null;
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
  const howToPractice = uniqueLabels(
    [main, scoring, transfer].map((block) => block && drillLabel(block)),
  )
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
    statusLabel: practiceResultLabel(decision, importStatus),
    resultNote: practiceResultNote(block, decision),
    importedEvidence: decision?.actual ?? "Scored after upload.",
  };
}

export function scoredFromLabel(block: PracticeBlockViewLike) {
  const clubLabel =
    block.clubs.length > 0 ? block.clubs.map((club) => club.toUpperCase()).join(", ") : "matching";

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

  if (decision.result === "passed") {
    return "matched_from_upload";
  }

  if (
    decision.result === "mixed" ||
    decision.result === "failed" ||
    decision.result === "insufficient_data"
  ) {
    return "needs_more_data";
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

function practiceResultLabel(
  decision: NonNullable<PracticeComparisonViewLike>["decisions"][number] | null,
  status: PracticeBlockImportStatus,
) {
  if (!decision || decision.actualBalls === 0) {
    return importStatusLabel(status);
  }

  switch (decision.result) {
    case "passed":
      return "Passed";
    case "mixed":
      return "Repeat once";
    case "failed":
      return "Missed target";
    case "insufficient_data":
      return "Low evidence";
  }

  switch (decision.decision) {
    case "maintain":
    case "move_down":
      return decision.matchedPlannedVolume ? "Passed" : "Target met";
    case "repeat_once":
      return "Repeat once";
    case "keep_priority":
      return "Keep priority";
  }
}

function practiceResultNote(
  block: PracticeBlockViewLike,
  decision: NonNullable<PracticeComparisonViewLike>["decisions"][number] | null,
) {
  if (!decision) {
    return "Upload matching launch-monitor shots to score this block.";
  }

  if (decision.actualBalls === 0) {
    return "No matching imported shots found for this block.";
  }

  const plannedBalls = block.ballCount ?? decision.plannedBalls ?? null;

  if (plannedBalls === null) {
    return `${decision.actualBalls} matching shots found.`;
  }

  if (decision.matchedPlannedVolume) {
    return `${decision.actualBalls} matching shots · planned volume met.`;
  }

  const shortBy = Math.max(0, plannedBalls - decision.actualBalls);

  return shortBy > 0
    ? `${decision.actualBalls}/${plannedBalls} planned balls found · ${shortBy} short.`
    : `${decision.actualBalls} matching shots found.`;
}
