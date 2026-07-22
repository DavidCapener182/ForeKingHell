export const coachInteractionTypes = [
  "practice_assignment",
  "private_note",
  "player_note",
  "session_comment",
  "goal_review",
  "evidence_request",
] as const;

export type CoachInteractionType = (typeof coachInteractionTypes)[number];

export const coachInteractionTypeLabels: Record<CoachInteractionType, string> = {
  practice_assignment: "Practice assignment",
  private_note: "Private coach note",
  player_note: "Player-visible note",
  session_comment: "Session comment",
  goal_review: "Goal review",
  evidence_request: "Evidence request",
};

export function parseCoachInteractionType(value: unknown): CoachInteractionType | null {
  return typeof value === "string" && coachInteractionTypes.includes(value as CoachInteractionType)
    ? (value as CoachInteractionType)
    : null;
}

export function visibilityForInteraction(type: CoachInteractionType) {
  return type === "private_note" ? ("coach_only" as const) : ("player_visible" as const);
}

export function coachInteractionStatusLabel(value: string) {
  if (value === "acknowledged") return "Acknowledged";
  if (value === "completed") return "Completed";
  if (value === "cancelled") return "Cancelled";
  return "Open";
}

export function interactionNeedsAction(type: string, status: string) {
  return (
    status === "open" &&
    (type === "practice_assignment" || type === "evidence_request" || type === "goal_review")
  );
}
