import Link from "next/link";
import {
  ArrowLeft,
  Award,
  Trophy,
  Target,
  Upload,
} from "lucide-react";
import { and, asc, count, desc, eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CompactReadoutGrid,
  DataPair,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
  PageHeader,
  PageShell,
  StatusPill,
} from "@/components/premium";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  clubAccent,
  clubSortValue,
  formatClubType,
  isShortGameTouchClubType,
  isTrackedClubType,
} from "@/lib/club-format";
import { calculateShortGameTouchSummary } from "@/lib/short-game";
import { calculateStockYardage, type StockShot } from "@/lib/stock-yardage";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const RECENT_SHOTS_PER_CLUB = 200;

export default async function BagPage() {
  const bag = await getBag();
  const gappingRows = buildGappingRows(bag);
  const totalShots = bag.reduce((total, club) => total + club.rawShotCount, 0);
  const stockConfidenceClubs = bag.filter((club) => !club.isShortGameTouch);
  const averageConfidence =
    stockConfidenceClubs.length === 0
      ? 0
      : Math.round(
          stockConfidenceClubs.reduce((total, club) => total + club.stock.confidenceScore, 0) /
            stockConfidenceClubs.length,
        );

  return (
    <PageShell>
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/import">
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
        </div>

        <PageHeader
          eyebrow={<StatusPill>Bag map</StatusPill>}
          title="Stock yardages"
          description="Rolling median carry, outlier filtering, dispersion, and confidence by club."
          actions={
            <>
            <Button asChild variant="outline">
              <Link href="/bag/longest">
                <Trophy className="size-4" />
                Longest shots
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/achievements">
                <Award className="size-4" />
                Achievements
              </Link>
            </Button>
            </>
          }
          metrics={[
            { label: "Clubs", value: bag.length.toString(), detail: "Tracked active clubs" },
            { label: "Shots", value: totalShots.toString(), detail: "Saved launch monitor rows" },
            { label: "Confidence", value: `${averageConfidence}%`, detail: "Average stock confidence" },
          ]}
        />

        {gappingRows.length > 0 ? <CarryGappingTable rows={gappingRows} /> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bag.map((club) => (
            <Link key={club.id} href={`/bag/${club.id}`} className="group block">
              <Card className="premium-card h-full transition-colors group-hover:border-emerald-300">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardDescription>{club.brandModel}</CardDescription>
                      <CardTitle className="text-3xl tracking-normal">
                        {formatClubType(club.type)}
                      </CardTitle>
                    </div>
                    <ClubMark clubType={club.type} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {club.isShortGameTouch ? "Touch median" : "Stock carry"}
                      </p>
                      <p className="text-5xl font-semibold tracking-normal">
                        {formatMetric(club.isShortGameTouch ? club.touch.carryMedianYd : club.stock.carryMedianYd)}
                        <span className="ml-1 text-lg text-muted-foreground">yd</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {club.isShortGameTouch ? "Full stock" : "Play"}
                      </p>
                      <p className="text-3xl font-semibold tracking-normal">
                        {formatMetric(club.isShortGameTouch ? null : club.stock.recommendedPlayNumberYd)}
                      </p>
                    </div>
                  </div>

                  <MiniDispersion
                    shots={club.shots}
                    accent={club.accent}
                    carryMedianYd={club.isShortGameTouch ? club.touch.carryMedianYd : club.stock.carryMedianYd}
                  />

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Metric
                      label={club.isShortGameTouch ? "Touch sample" : "Sample"}
                      value={(club.isShortGameTouch ? club.touch.sampleSize : club.stock.sampleSize).toString()}
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Upper touch" : "Good carry"}
                      value={formatMetric(club.isShortGameTouch ? club.touch.carryP75Yd : club.stock.carryP75Yd)}
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Longest touch" : "Total"}
                      value={formatMetric(club.isShortGameTouch ? club.touch.longestCarryYd : club.stock.totalMedianYd)}
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Lower touch" : "Ball mph"}
                      value={formatMetric(club.isShortGameTouch ? club.touch.carryP25Yd : club.stock.averageBallSpeedMph)}
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Under 30" : "Launch"}
                      value={
                        club.isShortGameTouch
                          ? club.touch.under30YdCount.toString()
                          : `${formatMetric(club.stock.averageLaunchAngleDeg)} deg`
                      }
                    />
                    <Metric
                      label={club.isShortGameTouch ? "Type" : "Side"}
                      value={
                        club.isShortGameTouch
                          ? "Touch"
                          : `${formatMetric(club.stock.dispersionLeftYd)}L / ${formatMetric(
                              club.stock.dispersionRightYd,
                            )}R`
                      }
                    />
                  </div>

                  {club.isShortGameTouch ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      Round chips and pitches are shown as touch data, not full-swing stock yardage.
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {club.isShortGameTouch ? "Short-game touch" : club.stock.label}
                      </span>
                      <span className="text-muted-foreground">
                        {club.isShortGameTouch ? `${club.touch.sampleSize} shots` : `${club.stock.confidenceScore}%`}
                      </span>
                    </div>
                    <Progress
                      value={club.isShortGameTouch ? Math.min(100, (club.touch.sampleSize / 50) * 100) : club.stock.confidenceScore}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        {bag.length === 0 ? (
          <Card className="premium-card">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <Target className="size-8 text-emerald-500" />
              <div>
                <p className="text-lg font-medium">No clubs imported yet</p>
                <p className="text-sm text-muted-foreground">Import Rapsodo CSVs to build the bag map.</p>
              </div>
            </CardContent>
          </Card>
        ) : null}
    </PageShell>
  );
}

async function getBag() {
  const db = getDb();

  const clubRows = await db
    .select({
      id: clubs.id,
      userId: clubs.userId,
      type: clubs.type,
      brand: clubs.brand,
      model: clubs.model,
    })
    .from(clubs)
    .where(eq(clubs.active, true))
    .orderBy(asc(clubs.type));

  const clubData = await Promise.all(
    clubRows.map(async (club) => {
      const [recentShots, [shotCount]] = await Promise.all([
        db
          .select({
            id: shots.id,
            clubId: shots.clubId,
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
            courseHoleNumber: shots.courseHoleNumber,
            sessionType: sessions.type,
            shotCategory: shots.shotCategory,
            qualityTag: shots.qualityTag,
          })
          .from(shots)
          .innerJoin(sessions, eq(shots.sessionId, sessions.id))
          .where(and(eq(shots.userId, club.userId), eq(shots.clubId, club.id)))
          .orderBy(desc(shots.shotAt))
          .limit(RECENT_SHOTS_PER_CLUB),
        db
          .select({ value: count() })
          .from(shots)
          .where(and(eq(shots.userId, club.userId), eq(shots.clubId, club.id))),
      ]);

      return {
        club,
        recentShots,
        rawShotCount: shotCount?.value ?? 0,
      };
    }),
  );

  return clubData
    .filter(({ club }) => isTrackedClubType(club.type))
    .map(({ club, recentShots, rawShotCount }) => {
      const accent = clubAccent(club.type);
      const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";
      const isShortGameTouch = isShortGameTouchClubType(club.type);

      return {
        ...club,
        accent,
        brandModel,
        isShortGameTouch,
        rawShotCount,
        shots: recentShots,
        touch: calculateShortGameTouchSummary(recentShots, RECENT_SHOTS_PER_CLUB, { clubType: club.type }),
        stock: calculateStockYardage(recentShots, RECENT_SHOTS_PER_CLUB, { clubType: club.type }),
      };
    })
    .sort((left, right) => clubSortValue(left.type) - clubSortValue(right.type));
}

type BagClub = Awaited<ReturnType<typeof getBag>>[number];

type GappingRow = {
  id: string;
  clubType: string;
  brandModel: string;
  carryYd: number | null;
  playNumberYd: number | null;
  gapToNextYd: number | null;
  targetCarryYd: number | null;
  targetPlayNumberYd: number | null;
  workOnYd: number | null;
  targetGapYd: number | null;
  sampleSize: number;
  confidenceScore: number;
  confidenceLabel: string;
};

function buildGappingRows(bag: BagClub[]): GappingRow[] {
  const stockBag = bag.filter((club) => !club.isShortGameTouch);

  const baseRows: GappingRow[] = stockBag.map((club, index) => {
    const nextClub = stockBag
      .slice(index + 1)
      .find((candidate) => candidate.stock.carryMedianYd !== null);
    const gapToNextYd =
      club.stock.carryMedianYd !== null && nextClub !== undefined && nextClub.stock.carryMedianYd !== null
        ? club.stock.carryMedianYd - nextClub.stock.carryMedianYd
        : null;

    return {
      id: club.id,
      clubType: club.type,
      brandModel: club.brandModel,
      carryYd: club.stock.carryMedianYd,
      playNumberYd: club.stock.recommendedPlayNumberYd,
      gapToNextYd: gapToNextYd === null ? null : Math.round(gapToNextYd * 10) / 10,
      targetCarryYd: null,
      targetPlayNumberYd: null,
      workOnYd: null,
      targetGapYd: null,
      sampleSize: club.stock.sampleSize,
      confidenceScore: club.stock.confidenceScore,
      confidenceLabel: club.stock.label,
    };
  });

  const rowsWithCarry = baseRows
    .map((row, index) => ({ row, index }))
    .filter((entry): entry is { row: GappingRow & { carryYd: number }; index: number } => entry.row.carryYd !== null);
  const first = rowsWithCarry[0];
  const last = rowsWithCarry[rowsWithCarry.length - 1];

  if (!first || !last || first.index === last.index) {
    return baseRows;
  }

  const targetGapYd = roundOne((first.row.carryYd - last.row.carryYd) / (last.index - first.index));

  if (targetGapYd <= 0) {
    return baseRows;
  }

  return baseRows.map((row, index) => {
    const targetCarryYd = roundOne(first.row.carryYd - targetGapYd * (index - first.index));

    return {
      ...row,
      targetCarryYd,
      targetPlayNumberYd: roundToNearestFive(targetCarryYd),
      workOnYd: row.carryYd === null ? null : roundOne(targetCarryYd - row.carryYd),
      targetGapYd,
    };
  });
}

function CarryGappingTable({ rows }: { rows: GappingRow[] }) {
  const targetGapYd = rows.find((row) => row.targetGapYd !== null)?.targetGapYd ?? null;

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="text-2xl tracking-normal">Carry gapping</CardTitle>
        <CardDescription>
          Stock carry by club, with target carry numbers to make the gaps more consistent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {targetGapYd !== null ? <GappingRecommendations rows={rows} targetGapYd={targetGapYd} /> : null}
        <CarryGappingBars rows={rows} />
        <DataTableFrame
          mobile={
            <MobileDataList>
              {rows.map((row) => (
                <MobileDataCard
                  key={row.id}
                  href={`/bag/${row.id}`}
                  title={formatClubType(row.clubType)}
                  subtitle={row.brandModel}
                  action={<GapBadge gapYd={row.gapToNextYd} />}
                >
                  <DataPair label="Carry" value={`${formatMetric(row.carryYd)}${row.carryYd === null ? "" : " yd"}`} />
                  <DataPair label="Play" value={`${formatMetric(row.playNumberYd)}${row.playNumberYd === null ? "" : " yd"}`} />
                  <DataPair label="Target" value={`${formatMetric(row.targetCarryYd)}${row.targetCarryYd === null ? "" : " yd"}`} />
                  <DataPair label="Work on" value={<WorkOnBadge workOnYd={row.workOnYd} />} />
                  <DataPair label="Confidence" value={`${row.confidenceScore}% ${row.confidenceLabel}`} />
                </MobileDataCard>
              ))}
            </MobileDataList>
          }
        >
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Carry</TableHead>
                <TableHead className="text-right">Play</TableHead>
                <TableHead className="text-right">Gap</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Work on</TableHead>
                <TableHead className="text-right">Sample</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/bag/${row.id}`}
                      className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      {formatClubType(row.clubType)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[220px] overflow-hidden text-ellipsis text-muted-foreground">
                    {row.brandModel}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMetric(row.carryYd)}
                    {row.carryYd === null ? "" : " yd"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMetric(row.playNumberYd)}
                    {row.playNumberYd === null ? "" : " yd"}
                  </TableCell>
                  <TableCell className="text-right">
                    <GapBadge gapYd={row.gapToNextYd} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-medium">
                      {formatMetric(row.targetCarryYd)}
                      {row.targetCarryYd === null ? "" : " yd"}
                    </span>
                    {row.targetPlayNumberYd === null ? null : (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.targetPlayNumberYd} play
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <WorkOnBadge workOnYd={row.workOnYd} />
                  </TableCell>
                  <TableCell className="text-right">{row.sampleSize}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-medium">{row.confidenceScore}%</span>
                    <span className="ml-2 text-muted-foreground">{row.confidenceLabel}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </Card>
  );
}

function GappingRecommendations({ rows, targetGapYd }: { rows: GappingRow[]; targetGapYd: number }) {
  const priorities = rows
    .filter((row): row is GappingRow & { workOnYd: number; targetCarryYd: number } => row.workOnYd !== null && row.targetCarryYd !== null)
    .filter((row) => Math.abs(row.workOnYd) > 2)
    .sort((left, right) => Math.abs(right.workOnYd) - Math.abs(left.workOnYd))
    .slice(0, 3);

  return (
    <div className="apple-panel grid gap-3 p-4 lg:grid-cols-[0.7fr_1.3fr]">
      <div className="apple-panel-strong p-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Target gap</p>
        <p className="mt-2 text-4xl font-semibold tracking-normal">{numberFormatter.format(targetGapYd)} yd</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Straight-line ladder from your longest full club to your shortest full club.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {priorities.length > 0 ? (
          <div className="md:col-span-3">
            <CompactReadoutGrid
              columnsClassName="md:grid-cols-3"
              items={priorities.map((row) => ({
                label: formatClubType(row.clubType),
                value: `${numberFormatter.format(row.targetCarryYd)} yd target`,
                detail: workOnText(row.workOnYd),
                tone: Math.abs(row.workOnYd) > 10 ? "pink" : "amber",
                href: `/bag/${row.id}`,
              }))}
            />
          </div>
        ) : (
          <div className="apple-panel-strong p-4 md:col-span-3">
            <p className="font-semibold">Gaps are already close</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every club with a target is within 2 yd of the current carry ladder.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function workOnText(workOnYd: number) {
  const absoluteYards = numberFormatter.format(Math.abs(workOnYd));
  if (Math.abs(workOnYd) <= 2) {
    return "Hold the current carry window.";
  }

  return `${workOnYd > 0 ? "Add" : "Take off"} ${absoluteYards} yd to close the ladder.`;
}


function CarryGappingBars({ rows }: { rows: GappingRow[] }) {
  const maxCarry = Math.max(1, ...rows.map((row) => row.carryYd ?? 0));

  return (
    <div className="apple-panel grid gap-3 p-4">
      {rows.map((row) => {
        const carry = row.carryYd ?? 0;
        const width = Math.max(8, (carry / maxCarry) * 100);

        return (
          <Link key={row.id} href={`/bag/${row.id}`} className="grid gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-white/80">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{formatClubType(row.clubType)}</span>
              <span className="text-muted-foreground">
                {formatMetric(row.carryYd)} yd carry · {formatMetric(row.playNumberYd)} yd play
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function GapBadge({ gapYd }: { gapYd: number | null }) {
  if (gapYd === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  const tone =
    gapYd < 8
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : gapYd > 18
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex min-w-16 justify-center rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}>
      {numberFormatter.format(gapYd)} yd
    </span>
  );
}

function WorkOnBadge({ workOnYd }: { workOnYd: number | null }) {
  if (workOnYd === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  const absoluteYards = Math.abs(workOnYd);

  if (absoluteYards <= 2) {
    return (
      <span className="inline-flex min-w-24 justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
        Hold window
      </span>
    );
  }

  const tone =
    absoluteYards > 10
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const direction = workOnYd > 0 ? "Add" : "Take off";

  return (
    <span className={`inline-flex min-w-24 justify-center rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}>
      {direction} {numberFormatter.format(absoluteYards)} yd
    </span>
  );
}

function ClubMark({ clubType }: { clubType: string }) {
  const accent = clubAccent(clubType);

  return (
    <div
      className="grid size-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
      style={{ background: accent }}
    >
      {formatClubType(clubType).slice(0, 2)}
    </div>
  );
}

function MiniDispersion({
  shots,
  accent,
  carryMedianYd,
}: {
  shots: StockShot[];
  accent: string;
  carryMedianYd: number | null;
}) {
  const visibleShots = shots
    .filter((shot) => shot.carryYd !== null)
    .slice(0, 40);
  const maxCarry = Math.max(240, ...visibleShots.map((shot) => shot.carryYd ?? 0));
  const maxSide = Math.max(45, ...visibleShots.map((shot) => Math.abs(shot.sideCarryYd ?? 0)));

  return (
    <svg viewBox="0 0 360 150" className="h-36 w-full rounded-xl border bg-white/80">
      <rect x="0" y="0" width="360" height="150" fill="#f9fafb" />
      {[60, 120, 180, 240].map((yard) => {
        const y = 140 - (yard / maxCarry) * 120;
        return (
          <g key={yard}>
            <line x1="18" x2="344" y1={y} y2={y} stroke="#e5e7eb" />
            <text x="22" y={y - 4} fill="#9ca3af" fontSize="10">
              {yard}
            </text>
          </g>
        );
      })}
      <line x1="180" x2="180" y1="10" y2="140" stroke="#e5e7eb" />
      {carryMedianYd ? (
        <line
          x1="18"
          x2="344"
          y1={140 - (carryMedianYd / maxCarry) * 120}
          y2={140 - (carryMedianYd / maxCarry) * 120}
          stroke={accent}
          strokeDasharray="5 5"
          strokeOpacity="0.8"
        />
      ) : null}
      {visibleShots.map((shot, index) => {
        const x = 180 + ((shot.sideCarryYd ?? 0) / maxSide) * 145;
        const y = 140 - ((shot.carryYd ?? 0) / maxCarry) * 120;
        return <circle key={index} cx={x} cy={y} r="4" fill={accent} opacity="0.75" />;
      })}
    </svg>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-panel p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToNearestFive(value: number) {
  return Math.round(value / 5) * 5;
}
