import Link from "next/link";
import { ArrowLeft, Flag, Target, Upload } from "lucide-react";

import { AchievementsClient } from "@/app/achievements/achievements-client";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { AchievementArtwork } from "@/components/visuals/achievement-artwork";
import { Button } from "@/components/ui/button";
import { getAchievementPageData } from "@/lib/achievements/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AchievementsPage({ searchParams }: { searchParams: SearchParams }) {
  const focusAchievementId = first((await searchParams).achievement).trim().slice(0, 140);
  const data = await getAchievementPageData();

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

        <AchievementsClient data={data} focusAchievementId={focusAchievementId || null} />
    </PageShell>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
