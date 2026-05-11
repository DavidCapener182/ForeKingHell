import Link from "next/link";
import { ArrowLeft, Flag, Target, Upload } from "lucide-react";

import { AchievementsClient } from "@/app/achievements/achievements-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAchievementPageData } from "@/lib/achievements/service";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const data = await getAchievementPageData();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
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

        <header className="premium-hero p-5 sm:p-7">
          <div className="max-w-3xl space-y-2">
            <Badge className="w-fit bg-zinc-900 text-white hover:bg-zinc-900">
              Achievement system
            </Badge>
            <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
              Progress worth tracking
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              Rapsodo metrics and completed round scorecards unlock XP, major badges, and generated club mastery ladders.
            </p>
          </div>
        </header>

        <AchievementsClient data={data} />
      </div>
    </main>
  );
}
