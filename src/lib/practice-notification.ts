export type PracticeNotificationEvidence = {
  planId: string;
  sessionId: string;
  title: string;
  status: string;
  accepted: boolean;
  analysed: boolean;
  createdAt: Date;
};

export function practiceReviewNotification(row: PracticeNotificationEvidence) {
  const ready = row.accepted && row.analysed && row.status === "analysed";
  if (!ready && (row.accepted || row.status !== "match_found")) return null;
  return {
    // Same identity for candidate -> linked review; recalculation never creates another event.
    id: `practice-${row.planId}-${row.sessionId}`,
    title: ready ? "Practice review ready" : "Possible practice match",
    detail: ready
      ? `${row.title}: review coverage and the measured outcome. Missing evidence may remain inconclusive.`
      : `${row.title}: confirm the session association before reviewing the practice.`,
    href: `/practice?planId=${encodeURIComponent(row.planId)}`,
    tone: ready ? ("green" as const) : ("amber" as const),
    createdAt: row.createdAt.toISOString(),
    unread: true,
  };
}
