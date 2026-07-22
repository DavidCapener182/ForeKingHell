import { createHash } from "node:crypto";

import { stableCourseTwinRoundJson, type CourseTwinRoundEventType } from "@/lib/course-twin-round";

export function hashCourseTwinSharedRoundEvent(value: {
  roomId: string;
  userId: string;
  sequence: number;
  type: CourseTwinRoundEventType;
  payload: Record<string, unknown>;
  previousHash: string | null;
}) {
  return createHash("sha256").update(stableCourseTwinRoundJson(value)).digest("hex");
}

export function validateCourseTwinSharedRoundMutation({
  role,
  competition,
  eventType,
}: {
  role: string;
  competition: boolean;
  eventType: CourseTwinRoundEventType;
}) {
  if (role === "spectator") return "Spectators cannot change the shared round.";
  if ((eventType === "round.completed" || eventType === "round.abandoned") && role !== "host") {
    return "Only the host can lock the shared round.";
  }
  if (competition && eventType === "shot.mulligan") {
    return "Competition rooms do not allow mulligans.";
  }
  return null;
}
