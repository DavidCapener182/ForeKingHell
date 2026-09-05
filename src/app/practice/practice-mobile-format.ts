import type { PracticeBlock, PracticePlan } from "@/lib/practice-planner";
import { formatClubType } from "@/lib/club-format";
export function clubLabel(block: PracticeBlock) {
  return block.clubs.length > 0 ? block.clubs.map(formatClubType).join(" + ") : "Mixed clubs";
}

export function clubSummary(plan: PracticePlan) {
  if (plan.focusClubs.length === 0) return "Mixed clubs";
  return plan.focusClubs.slice(0, 3).map(formatClubType).join(" + ");
}

export function blockVolume(block: PracticeBlock) {
  return block.ballCount === null ? `${block.timeMinutes} min` : `${block.ballCount} balls`;
}
