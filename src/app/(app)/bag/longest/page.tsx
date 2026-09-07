import { LongestEvidenceViews } from "@/app/bag/longest-evidence-views";
import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { getLongestShots } from "@/lib/longest-shot-data";
import { BestShotsBoard } from "@/app/bag/best-shots-board";

import {
  DesktopWorkbenchLayout,
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableFrame, PageShell, PageHeader } from "@/components/premium";

import { formatClubType } from "@/lib/club-format";
import { getCurrentUserPreferences } from "@/lib/current-user";

import {
  formatStoredApexFeet,
  formatStoredLateralYards,
  formatStoredSpeedMph,
  formatStoredYards,
  type DistanceUnitPreference,
} from "@/lib/units";
import { LongestShotsSection, type LongestShot } from "@/app/bag/longest-shots-section";

export const dynamic = "force-dynamic";

const longestShotColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "model", label: "Model" },
  { id: "shot", label: "Shot" },
  { id: "date", label: "Date" },
  { id: "total", label: "Total" },
  { id: "carry", label: "Carry" },
  { id: "offline", label: "Offline" },
  { id: "ball-speed", label: "Ball speed" },
  { id: "apex", label: "Apex" },
  { id: "proof", label: "Proof tier" },
  { id: "source", label: "Session / source" },
  { id: "action", label: "Action", locked: true },
];

const longestShotSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Longest totals",
    href: "/bag/longest",
    detail: "Each club's best total-distance shot with carry and offline context.",
  },
  {
    title: "Full bag gapping",
    href: "/bag?tab=distances#bag-gapping-table",
    detail: "Compare PBs with playable stock numbers and confidence.",
  },
  {
    title: "Shot explorer",
    href: "/shots",
    detail: "Inspect every launch-monitor row behind the PBs.",
  },
];

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function LongestShotsPage() {
  const [longestShots, carryShots, preferences] = await Promise.all([
    getLongestShots("total"),
    getLongestShots("carry"),
    getCurrentUserPreferences(),
  ]);
  const preferredUnits = preferences.preferredUnits;

  return (
    <PageShell contentClassName="gap-6">
      <DesktopWorkbenchLayout scope="longest-shots-route">
        <div className="flex w-full max-w-none flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/bag">
                <ArrowLeft className="size-4" />
                Bag map
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/import">
                <Upload className="size-4" />
                Import data
              </Link>
            </Button>
          </div>

          <PageHeader
            title="Best shots by club"
            eyebrow="Your personal records"
            description="Longest carry and total are separate records. Choose a club and distance to inspect the exact saved shot."
          />

          <BestShotsBoard
            carryShots={carryShots}
            totalShots={longestShots}
            preferredUnits={preferredUnits}
          />

          {longestShots.length > 0 ? (
            <>
              <details className="rounded-2xl border border-border p-5">
                <summary className="min-h-11 cursor-pointer text-base font-semibold">
                  Explore the illustrative shot replay
                </summary>
                <p className="my-3 text-sm text-muted-foreground">
                  Distance values come from your saved shot. The replay illustrates a flight; it is
                  not a measured trajectory.
                </p>
                <LongestShotsSection shots={longestShots} preferredUnits={preferredUnits} />
              </details>
              <LongestEvidenceViews
                carry={
                  carryShots.length ? (
                    <LongestShotEvidenceTable
                      shots={carryShots}
                      preferredUnits={preferredUnits}
                      metric="carry"
                    />
                  ) : (
                    <p>No measured carry records.</p>
                  )
                }
                total={
                  <LongestShotEvidenceTable
                    shots={longestShots}
                    preferredUnits={preferredUnits}
                    metric="total"
                  />
                }
              />
            </>
          ) : carryShots.length > 0 ? (
            <LongestEvidenceViews
              carry={
                <LongestShotEvidenceTable
                  shots={carryShots}
                  preferredUnits={preferredUnits}
                  metric="carry"
                />
              }
              total={<p>No measured total records. Carry is not substituted.</p>}
            />
          ) : (
            <Card className="premium-card">
              <CardContent className="py-12 text-center">
                <p className="text-lg font-medium">No longest shots yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Import launch-monitor shots to establish your first club records.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function LongestShotEvidenceTable({
  shots,
  preferredUnits,
  metric,
}: {
  shots: LongestShot[];
  preferredUnits: DistanceUnitPreference;
  metric: "carry" | "total";
}) {
  const rankedShots = [...shots].sort(
    (a, b) =>
      (b[metric === "carry" ? "carryYd" : "totalYd"] ?? -Infinity) -
      (a[metric === "carry" ? "carryYd" : "totalYd"] ?? -Infinity),
  );
  const bestShot = rankedShots[0];

  return (
    <section id="longest-shot-pb-table" className="grid gap-3" data-workbench-scope="longest-shots">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">
            {metric === "carry" ? "Carry" : "Total"} PB evidence board
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Sort, export and review the launch-monitor proof behind each club&apos;s longest
            recorded {metric} shot. Values are ranked by measured {metric}; missing values are never
            substituted.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          Best visible PB: {formatClubType(bestShot.clubType)} ·{" "}
          {formatStoredYards(
            metric === "carry" ? bestShot.carryYd : bestShot.totalYd,
            preferredUnits,
          )}{" "}
          {metric}
        </Badge>
      </div>

      <DesktopTableWorkbenchControls
        viewKey="bag-longest-shots"
        scope="longest-shots"
        currentViewLabel="Longest shot PB evidence"
        resultLabel={`${numberFormatter.format(shots.length)} club PBs`}
        columns={longestShotColumns}
        suggestedViews={longestShotSuggestedViews}
        exportTableId="longest-shot-pbs"
        exportFileName="forekinghell-longest-shot-pbs.csv"
      />

      <DataTableFrame mainTable mainTableLabel="Longest shot PB evidence table" stickyFirstColumn>
        <Table
          className="min-w-[1120px]"
          data-workbench-scope="longest-shots"
          data-workbench-export-table="longest-shot-pbs"
          aria-describedby="longest-shot-pb-summary"
        >
          <TableCaption id="longest-shot-pb-summary" className="sr-only">
            Longest shot PB evidence table showing club, model, shot number, date, total distance,
            carry, offline distance, ball speed, apex, proof tier and club action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
            <TableRow>
              <TableHead
                data-column="club"
                className="sticky left-0 z-20 min-w-36 bg-card shadow-[1px_0_0_hsl(var(--border))]"
              >
                Club
              </TableHead>
              <TableHead data-column="model">Model</TableHead>
              <TableHead data-column="shot">Shot</TableHead>
              <TableHead data-column="date">Date</TableHead>
              <TableHead data-column="total" className="text-right">
                Total
              </TableHead>
              <TableHead data-column="carry" className="text-right">
                Carry
              </TableHead>
              <TableHead data-column="offline" className="text-right">
                Offline
              </TableHead>
              <TableHead data-column="ball-speed" className="text-right">
                Ball speed
              </TableHead>
              <TableHead data-column="apex" className="text-right">
                Apex
              </TableHead>
              <TableHead data-column="proof">Proof tier</TableHead>
              <TableHead data-column="source">Session / source</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankedShots.map((shot) => (
              <TableRow key={shot.id} tabIndex={0} className="focus-aaa outline-none">
                <TableCell
                  data-column="club"
                  className="sticky left-0 z-10 min-w-36 bg-card shadow-[1px_0_0_hsl(var(--border))]"
                >
                  <Link
                    href={`/bag/${shot.clubId}`}
                    className="font-semibold text-foreground underline-offset-4 hover:underline"
                    prefetch={false}
                  >
                    {formatClubType(shot.clubType)}
                  </Link>
                </TableCell>
                <TableCell data-column="model" className="text-muted-foreground">
                  {shot.brandModel}
                </TableCell>
                <TableCell data-column="shot">#{shot.shotNumber ?? "-"}</TableCell>
                <TableCell data-column="date">{formatDate(shot.shotAt)}</TableCell>
                <TableCell data-column="total" className="text-right font-semibold">
                  {formatStoredYards(shot.totalYd, preferredUnits)}
                </TableCell>
                <TableCell data-column="carry" className="text-right">
                  {formatStoredYards(shot.carryYd, preferredUnits)}
                </TableCell>
                <TableCell data-column="offline" className="text-right">
                  {formatStoredLateralYards(shot.sideCarryYd, preferredUnits)}
                </TableCell>
                <TableCell data-column="ball-speed" className="text-right">
                  {formatStoredSpeedMph(shot.ballSpeedMph, preferredUnits)}
                </TableCell>
                <TableCell data-column="apex" className="text-right">
                  {formatStoredApexFeet(shot.apexFt, preferredUnits)}
                </TableCell>
                <TableCell data-column="proof">
                  <Badge variant="outline">{proofTierForShot(shot)}</Badge>
                </TableCell>
                <TableCell data-column="source" className="max-w-52 text-muted-foreground">
                  <p className="truncate font-medium text-foreground">
                    {shot.sessionFileName ?? "Saved session"}
                  </p>
                  <p className="mt-0.5 text-xs">{formatSessionSource(shot.sessionSource)}</p>
                </TableCell>
                <TableCell data-column="action" className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/bag/${shot.clubId}/analytics`} prefetch={false}>
                      Open analytics
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function proofTierForShot(shot: LongestShot) {
  if (shot.recordTrust === "raw") {
    return "Raw maximum";
  }

  if (shot.ballSpeedMph !== null && shot.clubSpeedMph !== null && shot.spinRate !== null) {
    return "Launch monitor";
  }

  if (shot.ballSpeedMph !== null || shot.clubSpeedMph !== null) {
    return "Speed recorded";
  }

  return "Distance only";
}

function formatSessionSource(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
