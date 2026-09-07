import Link from "next/link";
import { AchievementsClient } from "@/app/achievements/achievements-client";
import { AchievementSharePreview } from "@/app/achievements/achievement-share-preview";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getDashboardFeedPreview } from "@/lib/social";
import { getAchievementPageData } from "@/lib/achievements/service";
import { requireCurrentUserId } from "@/lib/current-user";
import { BRAND_NAME } from "@/lib/brand";
export const dynamic = "force-dynamic";
export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ achievement?: string | string[] }>;
}) {
  const [params, data, userId, feed] = await Promise.all([
    searchParams,
    getAchievementPageData(),
    requireCurrentUserId(),
    getDashboardFeedPreview(12),
  ]);
  const value = Array.isArray(params.achievement) ? params.achievement[0] : params.achievement;
  const focus = value?.trim().slice(0, 140) ?? "";
  const item = feed.find(
    (item) =>
      item.userId === userId &&
      (item.itemType === "achievement_unlock" || item.itemType === "level_up"),
  );
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5" data-achievements-workspace>
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-4 sm:p-5">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Achievements</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your unlocks, next targets and the evidence behind earned XP.
            </p>
          </div>
          <Button asChild>
            <Link href="/today">Open today’s practice</Link>
          </Button>
        </header>
        <AchievementsClient
          key={focus || "achievement-hub"}
          data={data}
          focusAchievementId={focus || null}
          presentation="workbench"
        />
        <AchievementSharePreview
          item={
            item
              ? {
                  id: item.id,
                  title: item.headline,
                  metricLabel: item.metricLabel ?? BRAND_NAME,
                  metricValue: item.metricValue ?? item.verificationLabel,
                  context: item.context ?? item.verificationLabel,
                  footer: `${item.verificationLabel} · @${item.profile.username}`,
                  visibility: item.visibility,
                }
              : null
          }
        />
      </div>
    </PageShell>
  );
}
