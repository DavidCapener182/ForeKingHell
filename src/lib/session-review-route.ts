import { isRoundSessionType } from "@/lib/round-sessions";

export type ReviewableSession = {
  id: string;
  type: string | null | undefined;
};

export function companionReviewRoute(session: ReviewableSession) {
  const prefix = isRoundSessionType(session.type) ? "/rounds" : "/sessions";
  return `${prefix}/${encodeURIComponent(session.id)}`;
}
