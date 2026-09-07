import { createRoot } from "react-dom/client";
import { ModerationQueue } from "@/app/admin/moderation-queue";
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <ModerationQueue
      kind="report"
      rows={["one", "two"].map((id) => ({
        id,
        kind: "report",
        label: `Synthetic ${id}`,
        status: "open",
        targetType: "feed",
        targetId: `target-${id}`,
        reason: "spam",
        details: `Full evidence ${id}`,
        actor: "reporter",
        reportedUser: "reported",
        severity: "Not assigned",
        created: "2026-01-01T12:00:00Z",
        resolved: null,
        metadata: "Not recorded",
      }))}
    />
  </main>,
);
