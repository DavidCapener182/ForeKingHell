import Link from "next/link";
import { Award, Flag, Share2, Target, Trophy, Upload, Users } from "lucide-react";

import { AchievementsClient } from "@/app/achievements/achievements-client";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { DataFirstFlowPanel } from "@/components/product-polish";
import { AchievementArtwork } from "@/components/visuals/achievement-artwork";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { getDashboardFeedPreview } from "@/lib/social";
import { getAchievementPageData } from "@/lib/achievements/service";

export const dynamic = "force-dynamic";
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AchievementsPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, surface, data] = await Promise.all([
    searchParams,
    getRequestAppSurface(),
    getAchievementPageData(),
  ]);
  const focusAchievementId = first(params.achievement).trim().slice(0, 140);

  if (surface === "companion") {
    return (
      <PageShell>
        <MobileRouteHeader title="Achievements" group="improve" activeKey="achievements" />
        <Card className="gap-0 py-0" data-achievements-companion>
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Achievements
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal">Next unlock</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {data.unlockedCount}/{data.totalCount} badges unlocked ·{" "}
                  {data.totalXp.toLocaleString("en-GB")} XP
                </p>
              </div>
              <StatusPill tone="green">Progress</StatusPill>
            </div>
            <Button asChild size="sm" className="mt-3 w-full" data-primary-action>
              <Link href="/today" prefetch={false}>
                Open today&apos;s practice
              </Link>
            </Button>
          </CardContent>
        </Card>
        <AchievementsClient
          key={focusAchievementId || "achievement-hub"}
          data={data}
          focusAchievementId={focusAchievementId || null}
          presentation="companion"
        />
      </PageShell>
    );
  }

  const [{ DesktopWorkbenchLayout }, feedItems] = await Promise.all([
    import("@/components/app/desktop-workbench"),
    getDashboardFeedPreview(12),
  ]);
  const latestAchievementFeedItem =
    feedItems.find(
      (item) => item.itemType === "achievement_unlock" || item.itemType === "level_up",
    ) ?? null;

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="achievements">
        <div
          className="flex flex-col items-end gap-3 lg:flex-row lg:items-center lg:justify-end"
          data-achievements-workbench
        >
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
          description="Launch monitor metrics and completed round scorecards unlock XP, major badges, club mileage, and generated mastery ladders."
          visual={<AchievementArtwork className="h-full min-h-44" priority />}
        />

        <AchievementsClient
          key={focusAchievementId || "achievement-hub"}
          data={data}
          focusAchievementId={focusAchievementId || null}
          presentation="workbench"
        />

        <div className="contents">
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
        </div>
      </DesktopWorkbenchLayout>
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
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
      </CardContent>
    </Card>
  );
}
