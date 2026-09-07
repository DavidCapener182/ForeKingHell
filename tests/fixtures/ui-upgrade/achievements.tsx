import { createRoot } from "react-dom/client";
import { AchievementsClient } from "@/app/achievements/achievements-client";
import { AchievementSharePreview } from "@/app/achievements/achievement-share-preview";
import { calculateUserLevel } from "@/lib/achievements/xp";
import type { AchievementPageData, AchievementView } from "@/lib/achievements/service";
const achievements: AchievementView[] = Array.from({ length: 1201 }, (_, index) => ({
  id: `synthetic-${index}`,
  name: `Synthetic badge ${index}`,
  displayName: `Synthetic badge ${index}`,
  description: "Synthetic achievement target",
  displayDescription: "Synthetic achievement target",
  category: "data",
  tier: "bronze",
  xp: 50,
  repeatable: false,
  hidden: false,
  triggerType: "session",
  unlocked: index < 1200,
  unlockCount: index < 1200 ? 1 : 0,
  unlockedAt: index < 1200 ? "2026-09-06T12:00:00Z" : null,
  xpAwarded: index < 1200 ? 50 : 0,
  progressValue: index < 1200 ? 1 : 0.5,
  progressTargetValue: 1,
  progressPercent: index < 1200 ? 100 : 50,
  progressLabel: "Synthetic target",
  source:
    index < 1200
      ? {
          kind: "session",
          title: "Synthetic source session",
          detail: "Synthetic source evidence, manual fixture",
          occurredAt: "2026-09-06T12:00:00Z",
          href: "/sessions/synthetic-source",
          stats: [{ label: "Shots", value: "20" }],
        }
      : null,
}));
const data: AchievementPageData = {
  totalXp: 60000,
  level: calculateUserLevel(60000),
  unlockedCount: 1200,
  totalCount: 1201,
  needsSync: false,
  recentUnlocks: achievements.slice(0, 2),
  achievements,
  trackedClubTypes: [],
  categorySummaries: [{ category: "data", total: 1201, unlocked: 1200 }],
};
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <h1>Achievements fixture</h1>
    <AchievementsClient data={data} focusAchievementId={null} presentation="workbench" />
    <AchievementSharePreview
      item={{
        id: "synthetic-feed",
        title: "Synthetic achievement",
        metricLabel: "Achievement XP",
        metricValue: "50",
        context: "Synthetic achievement target",
        footer: "Achievement · @synthetic",
        visibility: "private",
      }}
    />
  </main>,
);
