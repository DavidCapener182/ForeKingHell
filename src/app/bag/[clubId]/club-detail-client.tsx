"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, Brain, Database, Gauge, Target, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ClubArtwork } from "@/components/visuals/club-artwork";
import { MobileCompactPageHeader } from "@/components/premium";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import {
  clubAccent,
  formatClubModelName,
  formatClubType,
  isShortGameTouchClubType,
} from "@/lib/club-format";
import { calculateShortGameTouchSummary } from "@/lib/short-game";
import {
  calculateStockYardage,
  type StockShotRole,
  type StockShotRoleSummary,
} from "@/lib/stock-yardage";
import { cn } from "@/lib/utils";
import { ClubAnalysisTabs, type AnalysisShot } from "./club-analysis-tabs";

type ShotRange = "all" | "month3" | "month2" | "month1" | "thisMonth" | "week" | "today";

const RANGE_OPTIONS: Array<{
  value: ShotRange;
  label: string;
  compactLabel: string;
  description: string;
}> = [
  { value: "all", label: "All time", compactLabel: "All", description: "all full shots" },
  {
    value: "month3",
    label: "Last 3 months",
    compactLabel: "3 mo",
    description: "shots from the last 3 months",
  },
  {
    value: "month2",
    label: "Last 2 months",
    compactLabel: "2 mo",
    description: "shots from the last 2 months",
  },
  {
    value: "month1",
    label: "Last month",
    compactLabel: "1 mo",
    description: "shots from the last month",
  },
  {
    value: "thisMonth",
    label: "This month",
    compactLabel: "Month",
    description: "shots from this month",
  },
  { value: "week", label: "This week", compactLabel: "Week", description: "shots from this week" },
  { value: "today", label: "Today", compactLabel: "Today", description: "shots from today" },
];
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const WEDGE_ROLE_ORDER: StockShotRole[] = ["full", "pitch", "chip-touch"];

export function ClubDetailClient({
  club,
}: {
  club: {
    id: string;
    type: string;
    brand: string | null;
    model: string | null;
    shots: AnalysisShot[];
  };
}) {
  const accent = clubAccent(club.type);
  const clubModelName = formatClubModelName(club);
  const clubTypeLabel = formatClubType(club.type);
  const [shotRange, setShotRange] = useState<ShotRange>("thisMonth");
  const selectedRange =
    RANGE_OPTIONS.find((option) => option.value === shotRange) ?? RANGE_OPTIONS[0];
  const orderedShots = useMemo(
    () =>
      [...club.shots].sort((left, right) => {
        const dateDifference = new Date(right.shotAt).getTime() - new Date(left.shotAt).getTime();

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return Number(right.shotNumber ?? 0) - Number(left.shotNumber ?? 0);
      }),
    [club.shots],
  );
  const selectedShots = useMemo(
    () => filterShotsForRange(orderedShots, shotRange, new Date()),
    [orderedShots, shotRange],
  );
  const stock = useMemo(
    () => calculateStockYardage(selectedShots, selectedShots.length, { clubType: club.type }),
    [club.type, selectedShots],
  );
  const touch = useMemo(
    () =>
      calculateShortGameTouchSummary(selectedShots, selectedShots.length, { clubType: club.type }),
    [club.type, selectedShots],
  );
  const isShortGameTouch = isShortGameTouchClubType(club.type);
  const isSandWedge = club.type === "sw";
  const hasWedgeRoles =
    ["pw", "gw", "aw", "sw", "lw"].includes(club.type.toLowerCase()) &&
    stock.shotRoleSummaries.length > 0;
  const latestShotDate = selectedShots[0]?.shotAt ? formatDate(selectedShots[0].shotAt) : "--";
  const shotCount =
    shotRange !== "all"
      ? `${selectedShots.length}/${orderedShots.length}`
      : selectedShots.length.toString();

  return (
    <>
      <MobileCompactPageHeader
        eyebrow={
          <Badge className="w-fit text-white hover:opacity-90" style={{ background: accent }}>
            Club analysis
          </Badge>
        }
        title={clubModelName}
        description={clubModelName === clubTypeLabel ? "Unspecified model" : clubTypeLabel}
        metricLabel={isShortGameTouch ? "Touch median" : "Best stock"}
        metricValue={formatMetric(
          isShortGameTouch ? touch.carryMedianYd : stock.bestStockCarryYd,
          " yd",
        )}
        metricDetail={`${selectedShots.length} in ${selectedRange.compactLabel}`}
        visual={
          <ClubArtwork
            clubType={club.type}
            brand={club.brand}
            model={club.model}
            alt=""
            className="h-full w-full rounded-xl"
            sizes="64px"
          />
        }
        action={
          <Button
            asChild
            size="sm"
            className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            <Link href={`/bag/${club.id}/analytics`} prefetch={false}>
              Coach
            </Link>
          </Button>
        }
      />

      <div className="sm:hidden">
        <RangeToggle value={shotRange} onChange={setShotRange} />
      </div>

      <MobileMetricStrip
        items={[
          {
            label: isShortGameTouch ? "Touch" : "Best",
            value: formatMetric(
              isShortGameTouch ? touch.carryMedianYd : stock.bestStockCarryYd,
              " yd",
            ),
            detail: isShortGameTouch ? "Median" : "Stock",
            tone: "green",
          },
          {
            label: "PB",
            value: formatMetric(stock.personalBestCarryYd, " yd"),
            detail: "Personal best",
            tone: "sky",
          },
          {
            label: "Recommended",
            value: formatMetric(
              isShortGameTouch && !isSandWedge ? null : stock.coursePlayCarryYd,
              " yd",
            ),
            detail: "Play number",
            tone: "amber",
          },
          { label: "Shots", value: shotCount, detail: "Range", tone: "amber" },
          {
            label: isShortGameTouch ? "Under 30" : "Trust",
            value: isShortGameTouch ? touch.under30YdCount.toString() : `${stock.confidenceScore}%`,
            detail: "Confidence",
            tone: "pink",
          },
        ]}
      />

      <header className="premium-hero hidden p-5 sm:block sm:p-7">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Badge className="w-fit text-white hover:opacity-90" style={{ background: accent }}>
              Club analysis
            </Badge>
            <div className="w-full max-w-3xl lg:flex-1">
              <RangeToggle value={shotRange} onChange={setShotRange} />
            </div>
            <Button asChild variant="outline" size="sm" className="w-fit rounded-xl bg-white/70">
              <Link href={`/bag/${club.id}/analytics`} prefetch={false}>
                <Brain className="size-4" />
                Advanced analytics
              </Link>
            </Button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-stretch">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <div className="space-y-2">
                  <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                    {clubModelName}
                  </h1>
                  <p className="text-base leading-7 text-muted-foreground">
                    {clubModelName === clubTypeLabel ? "Unspecified model" : clubTypeLabel}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px] xl:min-w-0">
                <StatTile
                  label={isShortGameTouch ? "Touch median" : "Best stock"}
                  value={formatMetric(
                    isShortGameTouch ? touch.carryMedianYd : stock.bestStockCarryYd,
                    " yd",
                  )}
                  icon={Target}
                />
                <StatTile
                  label={isShortGameTouch ? "Full stock" : "Recommended"}
                  value={formatMetric(
                    isShortGameTouch
                      ? isSandWedge
                        ? stock.bestStockCarryYd
                        : null
                      : stock.coursePlayCarryYd,
                    " yd",
                  )}
                  icon={Gauge}
                />
                <StatTile label="Shots" value={shotCount} icon={Database} />
                <StatTile
                  label={isShortGameTouch ? "Under 30" : "Confidence"}
                  value={
                    isShortGameTouch ? touch.under30YdCount.toString() : `${stock.confidenceScore}%`
                  }
                  icon={BarChart3}
                />
              </div>
            </div>
            <ClubArtwork
              clubType={club.type}
              brand={club.brand}
              model={club.model}
              alt=""
              className="hidden h-full min-h-36 xl:block"
              priority
              sizes="240px"
            />
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="text-2xl tracking-normal">Stock yardage</CardTitle>
            <CardDescription>
              {isShortGameTouch
                ? isSandWedge
                  ? "Touch shots stay separate from the full-stock SW carry."
                  : "Round chips and pitches are separated from full-swing stock yardage."
                : `Rolling median from ${selectedRange.description}, with MAD outlier filtering.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-sm text-muted-foreground">
                {isShortGameTouch ? "Touch median" : "Best stock carry"}
              </p>
              <p className="text-6xl font-semibold tracking-normal">
                {formatMetric(isShortGameTouch ? touch.carryMedianYd : stock.bestStockCarryYd)}
                <span className="ml-2 text-lg text-muted-foreground">yd</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SmallMetric
                label={isShortGameTouch ? "Full PB" : "Personal best"}
                value={formatMetric(stock.personalBestCarryYd, " yd")}
              />
              {!isShortGameTouch ? (
                <SmallMetric
                  label="Recommended"
                  value={formatMetric(stock.coursePlayCarryYd, " yd")}
                />
              ) : null}
              {!isShortGameTouch ? (
                <SmallMetric
                  label="Latest reliable"
                  value={formatMetric(stock.latestReliableCarryYd, " yd")}
                />
              ) : null}
              {!isShortGameTouch ? (
                <SmallMetric
                  label="Latest range"
                  value={formatRange(
                    stock.latestReliableCarryP25Yd,
                    stock.latestReliableCarryP75Yd,
                  )}
                />
              ) : null}
              <SmallMetric
                label={isShortGameTouch ? "Lower touch" : "Average"}
                value={formatMetric(isShortGameTouch ? touch.carryP25Yd : stock.carryMeanYd, " yd")}
              />
              <SmallMetric
                label={isShortGameTouch ? "Upper touch" : "Good carry"}
                value={formatMetric(isShortGameTouch ? touch.carryP75Yd : stock.carryP75Yd, " yd")}
              />
              <SmallMetric
                label={isShortGameTouch ? "Longest touch" : "Total"}
                value={formatMetric(
                  isShortGameTouch ? touch.longestCarryYd : stock.totalMedianYd,
                  " yd",
                )}
              />
              <SmallMetric label="Left miss" value={formatMetric(stock.dispersionLeftYd, " yd")} />
              <SmallMetric
                label={isShortGameTouch ? "Under 30" : "Right miss"}
                value={
                  isShortGameTouch
                    ? touch.under30YdCount.toString()
                    : formatMetric(stock.dispersionRightYd, " yd")
                }
              />
              <SmallMetric
                label={isShortGameTouch ? "Full stock" : "Ball speed"}
                value={
                  isShortGameTouch
                    ? isSandWedge
                      ? formatMetric(stock.bestStockCarryYd, " yd")
                      : "--"
                    : formatMetric(stock.averageBallSpeedMph, " mph")
                }
              />
            </div>

            {hasWedgeRoles ? <WedgeRoleSummaryGrid summaries={stock.shotRoleSummaries} /> : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {isShortGameTouch
                    ? isSandWedge
                      ? "Touch + full stock"
                      : "Short-game touch"
                    : stock.label}
                </span>
                <span className="text-muted-foreground">
                  {isShortGameTouch && !isSandWedge
                    ? `${touch.sampleSize} touch / ${stock.rawSampleSize} total`
                    : isSandWedge
                      ? `${touch.sampleSize} touch / ${stock.sampleSize} stock`
                      : `${stock.sampleSize} clean / ${stock.rawSampleSize} total`}
                </span>
              </div>
              <Progress
                value={
                  isShortGameTouch && !isSandWedge
                    ? Math.min(100, (touch.sampleSize / 50) * 100)
                    : stock.confidenceScore
                }
              />
            </div>
            {isShortGameTouch ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {club.type === "sw"
                  ? "SW stock uses full-role shots from 75 yd and above. Pitch and chip windows stay in touch analysis."
                  : "Round chips and pitches stay in touch analysis, not best-stock yardage."}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="text-2xl tracking-normal">Data health</CardTitle>
            <CardDescription>
              {isShortGameTouch
                ? "Distance-control spread for short-game shots."
                : "Recommended waits for a stable latest sample before it becomes decision-ready."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <HealthBlock
              label={isShortGameTouch ? "Touch shots" : "Excluded shots"}
              value={(isShortGameTouch ? touch.sampleSize : stock.stockExclusionCount).toString()}
            />
            <HealthBlock
              label={isShortGameTouch ? "Full launch" : "Launch average"}
              value={
                isShortGameTouch && !isSandWedge
                  ? "--"
                  : formatMetric(stock.averageLaunchAngleDeg, " deg")
              }
            />
            <HealthBlock
              label={isShortGameTouch ? "Touch range" : "Best-stock range"}
              value={
                isShortGameTouch
                  ? `${formatMetric(touch.carryP25Yd)}-${formatMetric(touch.carryP75Yd)} yd`
                  : formatRange(stock.carryP25Yd, stock.carryP75Yd)
              }
            />
            <HealthBlock label="Last shot" value={latestShotDate} />
            <div className="apple-panel-strong p-4 sm:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Best-stock filter reasons</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {formatStockExclusionReasons(stock.stockExclusionReasons)}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Best Stock is the median of the selected top-20 clean stock sample. Personal Best
                keeps the single longest clean full-role carry visible without making that the play
                number.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {selectedShots.length > 0 ? (
        <ClubAnalysisTabs
          clubType={club.type}
          clubModelName={clubModelName}
          clubTypeLabel={clubTypeLabel}
          shots={selectedShots}
        />
      ) : (
        <Card className="premium-card">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Target className="size-8" style={{ color: accent }} />
            <div>
              <p className="text-lg font-medium">
                {orderedShots.length > 0 ? "No shots in this range" : "No shots for this club yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {orderedShots.length > 0
                  ? "Switch range to see older dispersion, trajectory, and club data."
                  : "Import launch-monitor shots to unlock dispersion, trajectory, and club data."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function RangeToggle({
  value,
  onChange,
}: {
  value: ShotRange;
  onChange: (value: ShotRange) => void;
}) {
  return (
    <div aria-label="Shot date range" className="apple-panel w-full max-w-full p-1">
      <div className="grid min-w-0 grid-cols-7 gap-1">
        {RANGE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "default" : "ghost"}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 min-w-0 rounded-lg px-1 text-xs sm:px-1.5 lg:px-2",
              value === option.value && "bg-[#0B7A3B] text-white",
            )}
            title={option.label}
          >
            <span className="truncate sm:hidden">{option.compactLabel}</span>
            <span className="hidden truncate sm:inline">{option.label}</span>
          </Button>
        ))}
      </div>
    </div>
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
    <div className="apple-panel-strong p-3">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <p className="text-xs font-medium">{label}</p>
        <Icon className="size-4" />
      </div>
      <p className="text-2xl font-semibold tracking-normal sm:text-3xl">{value}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-panel-strong p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function HealthBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-panel-strong p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function WedgeRoleSummaryGrid({ summaries }: { summaries: StockShotRoleSummary[] }) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
      <div>
        <p className="text-sm font-semibold">Wedge roles</p>
        <p className="text-xs text-muted-foreground">Full, pitch, and chip/touch are separated.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {WEDGE_ROLE_ORDER.map((role) => (
          <WedgeRoleMini key={role} role={role} summary={roleSummaryFor(summaries, role)} />
        ))}
      </div>
    </div>
  );
}

function WedgeRoleMini({
  role,
  summary,
}: {
  role: StockShotRole;
  summary: StockShotRoleSummary | null;
}) {
  return (
    <div className="rounded-md bg-white/80 p-2">
      <p className="text-xs font-medium text-muted-foreground">{wedgeRoleLabel(role)}</p>
      <p className="mt-1 text-lg font-semibold tracking-normal">
        {summary === null || summary.carryMedianYd === null
          ? "--"
          : formatMetric(summary.carryMedianYd, " yd")}
      </p>
      <p className="text-xs text-muted-foreground">
        {summary
          ? `${summary.sampleSize} shots · ${formatRange(summary.carryP25Yd, summary.carryP75Yd)}`
          : "No shots"}
      </p>
    </div>
  );
}

function roleSummaryFor(summaries: StockShotRoleSummary[], role: StockShotRole) {
  return summaries.find((summary) => summary.role === role) ?? null;
}

function wedgeRoleLabel(role: StockShotRole) {
  if (role === "chip-touch") {
    return "Chip/touch";
  }

  return role[0].toUpperCase() + role.slice(1);
}

function formatStockExclusionReasons(
  reasons: ReturnType<typeof calculateStockYardage>["stockExclusionReasons"],
) {
  if (reasons.length === 0) {
    return "No current stock exclusions.";
  }

  return reasons
    .slice(0, 4)
    .map((reason) => `${reason.label}: ${reason.count}`)
    .join(" · ");
}

function formatMetric(value: number | null, suffix = "") {
  return value === null ? "--" : `${numberFormatter.format(value)}${suffix}`;
}

function formatRange(low: number | null, high: number | null) {
  if (low === null || high === null) {
    return "--";
  }

  return `${formatMetric(low)}-${formatMetric(high)} yd`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function filterShotsForRange(shots: AnalysisShot[], range: ShotRange, now: Date) {
  if (range === "all") {
    return shots;
  }

  const start = startForRange(range, now);
  const startTime = start.getTime();

  return shots.filter((shot) => new Date(shot.shotAt).getTime() >= startTime);
}

function startForRange(range: Exclude<ShotRange, "all">, now: Date) {
  if (range === "today") {
    return startOfDay(now);
  }

  if (range === "week") {
    return startOfWeek(now);
  }

  if (range === "thisMonth") {
    return startOfMonth(now);
  }

  return subtractMonths(now, monthsForRange(range));
}

function monthsForRange(range: Extract<ShotRange, "month3" | "month2" | "month1">) {
  if (range === "month3") {
    return 3;
  }

  if (range === "month2") {
    return 2;
  }

  return 1;
}

function subtractMonths(value: Date, months: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() - months);
  return startOfDay(date);
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
}

function startOfMonth(value: Date) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
