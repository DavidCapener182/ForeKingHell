import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";

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
import { DataTableFrame, PageShell } from "@/components/premium";
import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  clubAccent,
  clubSortValue,
  formatClubType,
  isShortGameTouchClubType,
  isTrackedClubType,
} from "@/lib/club-format";
import { getCurrentUserPreferences, requireCurrentUserId } from "@/lib/current-user";
import {
  excludedRecordQualityTags,
  excludedRecordShotCategories,
  recordDistance,
} from "@/lib/shot-records";
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
  const [longestShots, preferences] = await Promise.all([
    getLongestShots(),
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

          <header className="premium-hero p-7">
            <div className="max-w-3xl space-y-2">
              <Badge variant="secondary" className="w-fit">
                Shot simulator
              </Badge>
              <h1 className="text-2xl font-semibold tracking-normal text-balance sm:text-5xl">
                Longest shot simulator
              </h1>
              <p className="line-clamp-1 text-sm leading-6 text-muted-foreground sm:line-clamp-none sm:text-base sm:leading-7">
                Replay each club&apos;s best trusted all-time shot, with the raw maximum kept
                visible whenever it was excluded from the record.
              </p>
            </div>
          </header>

          {longestShots.length > 0 ? (
            <>
              <LongestShotsSection shots={longestShots} preferredUnits={preferredUnits} />
              <LongestShotEvidenceTable shots={longestShots} preferredUnits={preferredUnits} />
            </>
          ) : (
            <Card className="premium-card">
              <CardContent className="py-12 text-center">
                <p className="text-lg font-medium">No longest shots yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Import launch-monitor shots to build the shot simulator.
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
}: {
  shots: LongestShot[];
  preferredUnits: DistanceUnitPreference;
}) {
  const bestShot = shots.reduce((best, shot) =>
    shotDistanceValue(shot) > shotDistanceValue(best) ? shot : best,
  );

  return (
    <section id="longest-shot-pb-table" className="grid gap-3" data-workbench-scope="longest-shots">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">PB evidence board</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Sort, export and review the launch-monitor proof behind each club&apos;s longest
            recorded shot.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          Best visible PB: {formatClubType(bestShot.clubType)} ·{" "}
          {formatStoredYards(shotDistance(bestShot), preferredUnits)}
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
            {shots.map((shot) => (
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
                  {formatStoredYards(shotDistance(shot), preferredUnits)}
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

async function getLongestShots() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const distanceExpression = sql<number>`coalesce(${shots.totalYd}, ${shots.carryYd})`;
  const excludedQualityValues = sql.join(
    [...excludedRecordQualityTags, "warm_up"].map((tag) => sql`${tag}`),
    sql`, `,
  );
  const excludedCategoryValues = sql.join(
    [...excludedRecordShotCategories, "warm_up"].map((category) => sql`${category}`),
    sql`, `,
  );
  const trustedLifecycleEvidence = or(
    eq(shots.reviewStatus, "restored"),
    and(
      eq(shots.reviewStatus, "included"),
      sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'`,
      sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not in (${excludedQualityValues})`,
      sql`lower(trim(coalesce(${shots.shotCategory}, ''))) not in (${excludedCategoryValues})`,
    ),
  );
  const shotSelection = {
    id: shots.id,
    clubId: shots.clubId,
    sessionId: shots.sessionId,
    sessionSource: sessions.source,
    sessionFileName: sessions.fileName,
    shotNumber: shots.shotNumber,
    shotAt: shots.shotAt,
    carryYd: shots.carryYd,
    totalYd: shots.totalYd,
    sideCarryYd: shots.sideCarryYd,
    ballSpeedMph: shots.ballSpeedMph,
    clubSpeedMph: shots.clubSpeedMph,
    launchAngleDeg: shots.launchAngleDeg,
    launchDirectionDeg: shots.launchDirectionDeg,
    apexFt: shots.apexFt,
    descentAngleDeg: shots.descentAngleDeg,
    spinRate: shots.spinRate,
    spinAxis: shots.spinAxis,
    qualityTag: shots.qualityTag,
    shotCategory: shots.shotCategory,
  };
  const [clubRows, rawRecordRows, trustedRecordRows] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type)),
    db
      .selectDistinctOn([shots.clubId], shotSelection)
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(
        and(eq(shots.userId, userId), eq(sessions.userId, userId), sql`${distanceExpression} > 0`),
      )
      .orderBy(shots.clubId, desc(distanceExpression), desc(shots.shotAt)),
    db
      .selectDistinctOn([shots.clubId], shotSelection)
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(
        and(
          eq(shots.userId, userId),
          eq(sessions.userId, userId),
          sql`${distanceExpression} > 0`,
          trustedLifecycleEvidence,
          sql`lower(${sessions.source}) not in ('manual', 'manual_edit')`,
        ),
      )
      .orderBy(shots.clubId, desc(distanceExpression), desc(shots.shotAt)),
  ]);

  const rawRecordByClubId = new Map(rawRecordRows.map((shot) => [shot.clubId, shot]));
  const trustedRecordByClubId = new Map(trustedRecordRows.map((shot) => [shot.clubId, shot]));

  return clubRows
    .filter((club) => isTrackedClubType(club.type) && !isShortGameTouchClubType(club.type))
    .map((club) => {
      const rawRecord = rawRecordByClubId.get(club.id) ?? null;
      const trustedRecord = trustedRecordByClubId.get(club.id) ?? null;
      const longestShot = trustedRecord ?? rawRecord;

      if (!longestShot) {
        return null;
      }

      const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";

      return toLongestShot({
        shot: longestShot,
        clubId: club.id,
        clubType: club.type,
        brandModel,
        accent: clubAccent(club.type),
        recordTrust: trustedRecord ? "trusted" : "raw",
        rawMaximumYd: rawRecord ? recordDistance(rawRecord, "total") : null,
      });
    })
    .filter((shot): shot is LongestShot => shot !== null)
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
}

type LongestShotRow = {
  id: string;
  clubId: string;
  sessionId: string;
  sessionSource: string;
  sessionFileName: string | null;
  shotNumber: number | null;
  shotAt: Date;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  descentAngleDeg: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  qualityTag: string | null;
  shotCategory: string | null;
};

function toLongestShot({
  shot,
  clubId,
  clubType,
  brandModel,
  accent,
  recordTrust,
  rawMaximumYd,
}: {
  shot: LongestShotRow;
  clubId: string;
  clubType: string;
  brandModel: string;
  accent: string;
  recordTrust: "trusted" | "raw";
  rawMaximumYd: number | null;
}): LongestShot {
  return {
    id: shot.id,
    clubId,
    clubType,
    brandModel,
    accent,
    sessionId: shot.sessionId,
    sessionSource: shot.sessionSource,
    sessionFileName: shot.sessionFileName,
    qualityTag: shot.qualityTag,
    shotCategory: shot.shotCategory,
    recordTrust,
    rawMaximumYd,
    shotNumber: shot.shotNumber,
    shotAt: shot.shotAt.toISOString(),
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    sideCarryYd: shot.sideCarryYd,
    ballSpeedMph: shot.ballSpeedMph,
    clubSpeedMph: shot.clubSpeedMph,
    launchAngleDeg: shot.launchAngleDeg,
    launchDirectionDeg: shot.launchDirectionDeg,
    apexFt: shot.apexFt,
    descentAngleDeg: shot.descentAngleDeg,
    spinRate: shot.spinRate,
    spinAxis: shot.spinAxis,
  };
}

function shotDistance(shot: LongestShot) {
  return shot.totalYd ?? shot.carryYd ?? null;
}

function shotDistanceValue(shot: LongestShot) {
  return shotDistance(shot) ?? 0;
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
    return "Speed verified";
  }

  return "Distance only";
}

function formatSessionSource(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
