import Link from "next/link";
import { ArrowLeft, Award, Flag, Share2, Target, Trophy, Upload, Users } from "lucide-react";

import { AchievementsClient } from "@/app/achievements/achievements-client";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { AchievementArtwork } from "@/components/visuals/achievement-artwork";
import { Button } from "@/components/ui/button";
import { getDashboardFeedPreview } from "@/lib/social";
import { getAchievementPageData } from "@/lib/achievements/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AchievementsPage({ searchParams }: { searchParams: SearchParams }) {
  const focusAchievementId = first((await searchParams).achievement).trim().slice(0, 140);
  const [data, feedItems] = await Promise.all([getAchievementPageData(), getDashboardFeedPreview(12)]);
  const latestAchievementFeedItem = feedItems.find((item) => item.itemType === "achievement_unlock" || item.itemType === "level_up") ?? null;

  return (
    <PageShell>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button asChild variant="outline">
              <Link href="/course-records">
                <Award className="size-4" />
                Records
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tournaments">
                <Trophy className="size-4" />
                Events
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/rounds">
                <Flag className="size-4" />
                Rounds
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/bag">
                <Target className="size-4" />
                Bag
              </Link>
            </Button>
            <Button asChild>
              <Link href="/import">
                <Upload className="size-4" />
                Import
              </Link>
            </Button>
          </div>
        </div>

        <PageHeader
          eyebrow={<StatusPill tone="slate">Achievement system</StatusPill>}
          title="Progress worth tracking"
          description="Rapsodo metrics and completed round scorecards unlock XP, major badges, club mileage, and generated mastery ladders."
          visual={<AchievementArtwork className="h-full min-h-44" />}
        />

        <AchievementSocialPanel data={data} latestFeedItemId={latestAchievementFeedItem?.id ?? null} />

        <AchievementsClient data={data} focusAchievementId={focusAchievementId || null} />
    </PageShell>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function AchievementSocialPanel({
  data,
  latestFeedItemId,
}: {
  data: Awaited<ReturnType<typeof getAchievementPageData>>;
  latestFeedItemId: string | null;
}) {
  const rarePercent = data.totalCount > 0 ? Math.round((data.unlockedCount / data.totalCount) * 100) : 0;

  return (
    <section className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div>
        <p className="text-sm font-semibold">Achievement social layer</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {rarePercent}% unlocked. Course champions, verified records and major-style finishes now live on this identity layer.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={latestFeedItemId ? `/api/share-cards/feed/${latestFeedItemId}` : "/feed?filter=achievements"} target={latestFeedItemId ? "_blank" : undefined} prefetch={false}>
            <Share2 className="size-4" />
            Share achievement
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/course-records" prefetch={false}>
            <Award className="size-4" />
            Course badges
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/tournaments" prefetch={false}>
            <Trophy className="size-4" />
            Major badges
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/leaderboard?tab=friends" prefetch={false}>
            <Users className="size-4" />
            Compare friends
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/challenges" prefetch={false}>
            <Trophy className="size-4" />
            Challenge badge
          </Link>
        </Button>
      </div>
    </section>
  );
}
