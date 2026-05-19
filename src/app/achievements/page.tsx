import Link from "next/link";
import { ArrowLeft, Award, Flag, Share2, Target, Trophy, Upload, Users } from "lucide-react";

import { AchievementsClient } from "@/app/achievements/achievements-client";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { DataFirstFlowPanel } from "@/components/product-polish";
import { AchievementArtwork } from "@/components/visuals/achievement-artwork";
import { Button } from "@/components/ui/button";
import { getDashboardFeedPreview } from "@/lib/social";
import { getAchievementPageData } from "@/lib/achievements/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AchievementsPage({ searchParams }: { searchParams: SearchParams }) {
  const focusAchievementId = first((await searchParams).achievement)
    .trim()
    .slice(0, 140);
  const [data, feedItems] = await Promise.all([
    getAchievementPageData(),
    getDashboardFeedPreview(12),
  ]);
  const latestAchievementFeedItem =
    feedItems.find(
      (item) => item.itemType === "achievement_unlock" || item.itemType === "level_up",
    ) ?? null;

  return (
    <PageShell>
      <MobileRouteHeader title="Improve" group="improve" activeKey="achievements" />

      <div className="hidden flex-col items-start gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
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

      <section className="premium-card p-3 sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Achievements
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-normal">Next unlock</h1>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {data.unlockedCount}/{data.totalCount} badges unlocked ·{" "}
              {data.totalXp.toLocaleString("en-GB")} XP
            </p>
          </div>
          <StatusPill tone="green">Progress</StatusPill>
        </div>
        <Button
          asChild
          size="sm"
          className="mt-3 w-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          data-primary-action
        >
          <Link href="/today" prefetch={false}>
            Open today&apos;s practice
          </Link>
        </Button>
      </section>

      <div className="hidden sm:block">
        <PageHeader
          eyebrow={<StatusPill tone="slate">Achievement system</StatusPill>}
          title="Progress worth tracking"
          description="Launch monitor metrics and completed round scorecards unlock XP, major badges, club mileage, and generated mastery ladders."
          visual={<AchievementArtwork className="h-full min-h-44" />}
        />
      </div>

      <AchievementsClient data={data} focusAchievementId={focusAchievementId || null} />

      <DataFirstFlowPanel
        title="Achievement categories"
        description="The badge catalogue is grouped by golfer progress, not generic activity."
        steps={[
          {
            title: "Data",
            detail: "Imports, mapped clubs and clean samples.",
            href: "/import",
            status: "ready",
          },
          {
            title: "Practice",
            detail: "Drills, PBs and launch-window work.",
            href: "/today",
            status: "ready",
          },
          {
            title: "Rounds",
            detail: "Completed scorecards and handicap-ready rounds.",
            href: "/rounds",
            status: "ready",
          },
          {
            title: "Course Records",
            detail: "Verified course champions and board attempts.",
            href: "/course-records",
            status: "ready",
          },
          {
            title: "Tournaments",
            detail: "Daily, weekly and major-style event results.",
            href: "/tournaments",
            status: "ready",
          },
          {
            title: "Social",
            detail: "Friends, groups, kudos and shared moments.",
            href: "/feed",
            status: "optional",
          },
        ]}
      />

      <AchievementSocialPanel
        data={data}
        latestFeedItemId={latestAchievementFeedItem?.id ?? null}
      />
    </PageShell>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function AchievementSocialPanel({
  data,
  latestFeedItemId,
}: {
  data: Awaited<ReturnType<typeof getAchievementPageData>>;
  latestFeedItemId: string | null;
}) {
  const rarePercent =
    data.totalCount > 0 ? Math.round((data.unlockedCount / data.totalCount) * 100) : 0;

  return (
    <section className="premium-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div>
        <p className="text-sm font-semibold">Achievement social layer</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {rarePercent}% unlocked. Course champions, verified records and major-style finishes now
          live on this identity layer.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link
            href={
              latestFeedItemId
                ? `/api/share-cards/feed/${latestFeedItemId}`
                : "/feed?filter=achievements"
            }
            target={latestFeedItemId ? "_blank" : undefined}
            prefetch={false}
          >
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
