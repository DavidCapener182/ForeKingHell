import { createHash } from "node:crypto";
import type { CoachClubCard, CoachDrillChallenge } from "@/lib/coach";
import type { PracticePlan } from "@/lib/practice-planner";

export function coachPracticeFingerprint(card: CoachClubCard, drill: CoachDrillChallenge) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        clubId: card.clubId,
        drill: card.drill,
        reason: card.reason,
        sampleSize: card.sampleSize,
        drillId: drill.id,
        target: drill.target,
        winCondition: drill.winCondition,
        rule: drill.winRule,
      }),
    )
    .digest("hex");
}

/** Preserve the displayed Coach prescription; no source-session claim is inferred from club history. */
export function coachPracticePlan(
  base: PracticePlan,
  card: CoachClubCard,
  drill: CoachDrillChallenge,
): PracticePlan {
  if (
    drill.clubId !== card.clubId ||
    !base.sourceContext.bag.clubs.some((club) => club.clubId === card.clubId)
  )
    throw new Error("That coaching club is no longer in your bag.");
  const main = base.blocks.findIndex((block) => block.title.startsWith("Main priority"));
  const transfer = base.blocks.findIndex((block) => block.type === "random");
  if (main < 0 || transfer < 0)
    throw new Error("The practice draft could not retain this coaching drill.");
  const difference = (base.blocks[main].ballCount ?? 0) - drill.completionTarget;
  if ((base.blocks[transfer].ballCount ?? 0) + difference < 0)
    throw new Error("This draft does not have enough balls for the full Coach target.");
  const blocks = base.blocks.map((block, index) =>
    index === main
      ? {
          ...block,
          title: `Main priority: ${drill.title}`,
          clubs: [card.clubType],
          ballCount: drill.completionTarget,
          purpose: `${card.reason} Source: Coach’s owned ${card.clubName} club evidence (${card.sampleSize} clean shots).`,
          drill: card.drill,
          successTarget: `${drill.target} ${drill.winCondition}`,
          recordPrompt:
            "Upload the measured shots in drill order. Missing target measurements remain unverified.",
          scoringRules: {
            metric: "coach_target",
            target: drill.winRule.target,
            evidenceMode: "launch_monitor" as const,
            coachTarget: {
              clubType: card.clubType,
              completionTarget: drill.completionTarget,
              winRule: drill.winRule,
            },
          },
        }
      : index === transfer
        ? { ...block, ballCount: (block.ballCount ?? 0) + difference }
        : block,
  );
  return {
    ...base,
    title: `${card.clubName} · ${drill.title}`,
    summary: `Saved from Coach: ${card.drill} Target: ${drill.target} ${drill.winCondition}`,
    focusClubs: [card.clubType, ...base.focusClubs.filter((club) => club !== card.clubType)],
    blocks,
    generation: {
      ...base.generation,
      label: "Coach diagnosis",
      prescriptionConfidence: base.confidenceLabel,
      note: "Exact Coach drill and target retained. Coaching source is the owned club sample; the later practice import supplies outcome evidence.",
      coachHandoff: {
        clubId: card.clubId,
        drillId: drill.id,
        fingerprint: coachPracticeFingerprint(card, drill),
      },
    },
  };
}

export function parseCoachPracticeTarget(
  value: unknown,
): PracticePlan["blocks"][number]["scoringRules"]["coachTarget"] {
  if (!value || typeof value !== "object") return undefined;
  const target = value as Record<string, unknown>;
  if (
    typeof target.clubType !== "string" ||
    !/^[a-z0-9]{1,12}$/.test(target.clubType) ||
    !Number.isInteger(target.completionTarget) ||
    Number(target.completionTarget) < 1 ||
    Number(target.completionTarget) > 120 ||
    !target.winRule ||
    typeof target.winRule !== "object"
  )
    return undefined;
  const rule = target.winRule as Record<string, unknown>;
  if (!Number.isInteger(rule.target) || Number(rule.target) < 1 || Number(rule.target) > 120)
    return undefined;
  if (
    ![
      "clean-shots",
      "playable",
      "launch-window",
      "solid-strike",
      "delivery-window",
      "carry-window",
    ].includes(String(rule.kind))
  )
    return undefined;
  if (
    rule.kind === "launch-window" &&
    !(
      typeof rule.low === "number" &&
      Number.isFinite(rule.low) &&
      typeof rule.high === "number" &&
      Number.isFinite(rule.high) &&
      rule.low <= rule.high
    )
  )
    return undefined;
  if (
    rule.kind === "carry-window" &&
    !(
      Number.isInteger(rule.setSize) &&
      Number(rule.setSize) > 0 &&
      Number(rule.setSize) <= 120 &&
      typeof rule.maxSpreadYd === "number" &&
      Number.isFinite(rule.maxSpreadYd) &&
      rule.maxSpreadYd >= 0
    )
  )
    return undefined;
  return {
    clubType: target.clubType,
    completionTarget: Number(target.completionTarget),
    winRule: rule as CoachDrillChallenge["winRule"],
  };
}
