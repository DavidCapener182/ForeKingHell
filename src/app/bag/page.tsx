import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BarChart3,
  Database,
  Gauge,
  Trophy,
  Target,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { and, asc, count, desc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
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

        <header className="premium-hero p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                Bag map
              </Badge>
              <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                Stock yardages
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                Rolling median carry, outlier filtering, dispersion, and confidence by club.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 lg:min-w-[520px]">
              <StatTile label="Clubs" value={bag.length.toString()} icon={Database} />
              <StatTile label="Shots" value={totalShots.toString()} icon={BarChart3} />
              <StatTile label="Confidence" value={`${averageConfidence}%`} icon={Gauge} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
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
          </div>
        </header>

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
                    <p className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
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
      </div>
    </main>
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
  sampleSize: number;
  confidenceScore: number;
  confidenceLabel: string;
};

function buildGappingRows(bag: BagClub[]): GappingRow[] {
  const stockBag = bag.filter((club) => !club.isShortGameTouch);

  return stockBag.map((club, index) => {
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
      sampleSize: club.stock.sampleSize,
      confidenceScore: club.stock.confidenceScore,
      confidenceLabel: club.stock.label,
    };
  });
}

function CarryGappingTable({ rows }: { rows: GappingRow[] }) {
  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="text-2xl tracking-normal">Carry gapping</CardTitle>
        <CardDescription>
          Stock carry by club, with the gap to the next shorter club.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Club</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Carry</TableHead>
              <TableHead className="text-right">Play</TableHead>
              <TableHead className="text-right">Gap</TableHead>
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
                <TableCell className="text-right">{row.sampleSize}</TableCell>
                <TableCell className="text-right">
                  <span className="font-medium">{row.confidenceScore}%</span>
                  <span className="ml-2 text-muted-foreground">{row.confidenceLabel}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[8px] border bg-[#f9fafb] p-3">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <p className="text-xs font-medium">{label}</p>
        <Icon className="size-4" />
      </div>
      <p className="text-3xl font-semibold tracking-normal">{value}</p>
    </div>
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
    <svg viewBox="0 0 360 150" className="h-36 w-full rounded-[8px] border bg-[#f9fafb]">
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
    <div className="rounded-[8px] border bg-[#f9fafb] p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}
