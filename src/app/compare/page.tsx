import Link from "next/link";
import { ArrowLeft, Crosshair, Upload } from "lucide-react";

import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import {
  defaultClubCompareFilters,
  defaultPlayerCompareFilters,
  getClubCompareData,
  getPlayerCompareData,
  type ClubCompareFilters,
  type PlayerCompareFilters,
} from "@/lib/compare-data";
import { ClubCompareClient } from "./club-compare-client";
import { PlayerCompareClient } from "./player-compare-client";
import { ProgressCompareClient } from "./progress-compare-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={<StatusPill tone="amber">Configuration</StatusPill>}
          title="Compare clubs"
          description="DATABASE_URL is required before club comparisons can be calculated."
        />
      </PageShell>
    );
  }

  const params = await searchParams;
  const [playerData, data] = await Promise.all([
    getPlayerCompareData(parsePlayerFilters(params)),
    getClubCompareData(parseFilters(params)),
  ]);

  return (
    <PageShell>
      <MobileRouteHeader title="Analyse" group="analyse" activeKey="compare" />

      <div className="hidden items-center justify-between gap-4 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import data
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="green">Your progress comparisons</StatusPill>}
        title="Compare"
        description="Start with your latest week against recent practice, then drill into club-vs-club and player comparisons."
        actions={
          <Button
            asChild
            size="lg"
            className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            <Link href="/shots" prefetch={false}>
              <Crosshair className="size-4" />
              Open shots
            </Link>
          </Button>
        }
      />

      <ProgressCompareClient data={data.progress} />

      <ClubCompareClient data={data} />

      <PlayerCompareClient data={playerData} />
    </PageShell>
  );
}

function parseFilters(searchParams: Awaited<SearchParams>): ClubCompareFilters {
  const defaults = defaultClubCompareFilters();

  return {
    clubAId:
      stringParam(searchParams.clubAId) || stringParam(searchParams.clubId) || defaults.clubAId,
    clubBId: stringParam(searchParams.clubBId) || defaults.clubBId,
  };
}

function parsePlayerFilters(searchParams: Awaited<SearchParams>): PlayerCompareFilters {
  const defaults = defaultPlayerCompareFilters();

  return {
    playerAId: stringParam(searchParams.playerAId) || defaults.playerAId,
    playerBId: stringParam(searchParams.playerBId) || defaults.playerBId,
  };
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
