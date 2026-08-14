import type { OfflineActionRecord } from "@/lib/offline-queue";

export type TodayPrimaryState = {
  eyebrow: string;
  title: string;
  reason: string;
  status: string;
  tone: "positive" | "attention" | "info" | "neutral";
  href: string;
  action: string;
};

export function getTodaySyncOverride(
  actions: OfflineActionRecord[],
  isOnline: boolean,
): TodayPrimaryState | null {
  const imports = actions.filter((action) => action.kind === "import-csv");
  if (imports.length === 0) return null;

  const needsAttention = imports.filter((action) => action.status === "dead_letter").length;
  if (needsAttention > 0) {
    return {
      eyebrow: "Upload needs attention",
      title: "Review the queued session",
      reason: `${needsAttention} session upload${needsAttention === 1 ? " needs" : "s need"} a decision before analysis can continue.`,
      status: "Needs attention",
      tone: "attention",
      href: "/settings?section=offline#offline-storage",
      action: "Review upload",
    };
  }

  if (isOnline) {
    return {
      eyebrow: "Session upload syncing",
      title: "Building your session review",
      reason: `${imports.length} upload${imports.length === 1 ? " is" : "s are"} being saved. The verdict and charts will appear only after sync completes.`,
      status: "Syncing",
      tone: "info",
      href: "/import",
      action: "View import status",
    };
  }

  return {
    eyebrow: "Upload queued on this phone",
    title: "Your session is waiting safely",
    reason: "Waiting for connection. Analysis will appear after the upload syncs.",
    status: "Waiting for connection",
    tone: "attention",
    href: "/import",
    action: "View queued upload",
  };
}
