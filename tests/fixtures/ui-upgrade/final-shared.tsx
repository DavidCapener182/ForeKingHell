import { createRoot } from "react-dom/client";
import { useState } from "react";
import { WorkbenchBreadcrumbs } from "@/components/app/workbench-breadcrumbs";
import { buildWorkbenchBreadcrumbItems } from "@/lib/workbench-breadcrumbs";
import { CompanionSyncStatus } from "@/components/app/companion-sync-status";
import {
  AchievementNotificationProvider,
  notifyAchievementUnlocks,
} from "@/components/achievement-notifications";
const notifications = [
  {
    achievementId: "fixture-long",
    name: "Synthetic achievement with a long descriptive name",
    description:
      "A complete description that must remain readable on a narrow phone and must never be truncated before the golfer can understand the achievement.",
    tier: "gold" as const,
    xpAwarded: 123456789,
    unlockedAt: "2026-09-07T12:00:00Z",
  },
];
function Fixture() {
  const [account, setAccount] = useState("owner");
  return (
    <main className="p-4 space-y-4">
      <h1>Shared controls fixture</h1>
      <WorkbenchBreadcrumbs
        items={buildWorkbenchBreadcrumbItems(
          { label: "Courses", href: "/courses" },
          "/courses/course-a/records/record-b",
        )}
      />
      <CompanionSyncStatus accountId={account} />
      <button
        onClick={() => {
          sessionStorage.setItem("queue-state", "queued");
          window.dispatchEvent(new Event("fkh-offline-queue-changed"));
        }}
      >
        Recover storage
      </button>
      <button onClick={() => setAccount("other")}>Switch account</button>
      <button onClick={() => notifyAchievementUnlocks(notifications)}>Repeat notification</button>
      <AchievementNotificationProvider initialNotifications={notifications}>
        <p>Saved content remains available.</p>
      </AchievementNotificationProvider>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
