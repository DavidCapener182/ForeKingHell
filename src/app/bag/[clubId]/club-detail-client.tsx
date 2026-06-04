"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Database,
  Gauge,
  ShieldCheck,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

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
  type StockYardage,
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
const STOCK_DECISION_TARGET_SHOTS = 20;

type MetricTone = "green" | "amber" | "red" | "sky" | "neutral";
type ShortGameTouchSummary = ReturnType<typeof calculateShortGameTouchSummary>;
type ClubHealth = {
  label: "Healthy" | "Developing" | "Needs calibration";
  tone: MetricTone;
  badgeClassName: string;
  confidenceDetail: string;
  statusDetail: string;
  dataQuality: string;
  gapping: string;
  dispersion: string;
};
type ClubEvolutionPoint = {
  key: string;
  label: string;
  value: number | null;
  shotCount: number;
};
type MonthChange = {
  currentLabel: string | null;
  previousLabel: string | null;
  carryDeltaYd: number | null;
  coneDeltaYd: number | null;
  confidenceDelta: number | null;
  pathDeltaDeg: number | null;
};

export function ClubDetailClient({
  club,
  children,
}: {
  club: {
    id: string;
    type: string;
    brand: string | null;
    model: string | null;
    shots: AnalysisShot[];
  };
  children?: ReactNode;
}) {
  const accent = clubAccent(club.type);
  const clubModelName = formatClubModelName(club);
  const clubTypeLabel = formatClubType(club.type);
  const clubIdentityName = formatClubIdentityName(club.type);
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
  const recommendedCarry =
    isShortGameTouch && !isSandWedge ? null : displayRecommendedCarry(stock, isShortGameTouch);
  const recommendedDetail =
    stock.coursePlayCarryYd === null ? "Provisional course number" : "Course number";
  const confidenceValue = isShortGameTouch ? touch.under30YdCount : stock.confidenceScore;
  const clubRole = clubRoleLabel(club.type, stock, isShortGameTouch);
  const health = clubHealth(stock, selectedShots, isShortGameTouch);
  const typicalMiss = typicalMissLabel(selectedShots);
  const evolution = useMemo(
    () => buildClubEvolution(orderedShots, club.type),
    [club.type, orderedShots],
  );
  const monthChange = useMemo(
    () => buildMonthChange(orderedShots, club.type),
    [club.type, orderedShots],
  );

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
            label: isShortGameTouch ? "Touch" : "Recommended",
            value: formatMetric(isShortGameTouch ? touch.carryMedianYd : recommendedCarry, " yd"),
            detail: isShortGameTouch ? "Median" : "Play number",
            tone: "green",
          },
          {
            label: isShortGameTouch ? "Full" : "Best",
            value: formatMetric(
              isShortGameTouch
                ? isSandWedge
                  ? stock.bestStockCarryYd
                  : null
                : stock.bestStockCarryYd,
              " yd",
            ),
            detail: isShortGameTouch ? "Stock" : "Stock",
            tone: "sky",
          },
          {
            label: "PB",
            value: formatMetric(stock.personalBestCarryYd, " yd"),
            detail: "Personal best",
            tone: "sky",
          },
          { label: "Shots", value: shotCount, detail: "Range", tone: "amber" },
          {
            label: isShortGameTouch ? "Under 30" : "Health",
            value: isShortGameTouch ? touch.under30YdCount.toString() : `${stock.confidenceScore}%`,
            detail: health.label,
            tone: "pink",
          },
        ]}
      />

      <header className="premium-hero hidden p-6 sm:block lg:p-8">
        <div className="space-y-7">
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

          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
            <div className="space-y-7">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {clubModelName === clubTypeLabel ? "Unspecified model" : clubModelName}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <h1 className="text-5xl font-semibold tracking-normal text-balance lg:text-6xl">
                    {clubIdentityName}
                  </h1>
                  <Badge
                    className={cn("mb-1 w-fit border px-3 py-1 text-sm", health.badgeClassName)}
                  >
                    {health.label}
                  </Badge>
                </div>
                <p className="max-w-2xl text-xl font-medium leading-8 text-[#254434]">{clubRole}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <HeroYardage
                  label={isShortGameTouch ? "Touch median" : "Recommended"}
                  value={formatWholeYards(
                    isShortGameTouch ? touch.carryMedianYd : recommendedCarry,
                  )}
                  detail={isShortGameTouch ? "Short-game control" : recommendedDetail}
                  featured
                />
                <HeroYardage
                  label={isShortGameTouch ? "Full stock" : "Best stock"}
                  value={formatWholeYards(
                    isShortGameTouch
                      ? isSandWedge
                        ? stock.bestStockCarryYd
                        : null
                      : stock.bestStockCarryYd,
                  )}
                  detail={isShortGameTouch ? "Full swing" : "Clean-sample median"}
                />
                <HeroYardage
                  label="Personal best"
                  value={formatWholeYards(stock.personalBestCarryYd)}
                  detail="Longest clean carry"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <HeroTrait
                  icon={ShieldCheck}
                  label={isShortGameTouch ? "Touch count" : "Confidence"}
                  value={isShortGameTouch ? confidenceValue.toString() : `${confidenceValue}%`}
                  detail={health.confidenceDetail}
                  tone={health.tone}
                />
                <HeroTrait
                  icon={Target}
                  label="Typical miss"
                  value={typicalMiss.label}
                  detail={typicalMiss.detail}
                  tone={typicalMiss.tone}
                />
                <HeroTrait
                  icon={CheckCircle2}
                  label="Current status"
                  value={health.label}
                  detail={health.statusDetail}
                  tone={health.tone}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-lg bg-[#0B7A3B] px-5 text-white shadow-sm hover:bg-[#064E3B]"
                >
                  <a href="#club-shot-history">
                    Review {selectedShots.length} shot{selectedShots.length === 1 ? "" : "s"}
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-lg bg-white/70">
                  <a href="#club-dispersion">Open dispersion</a>
                </Button>
              </div>
            </div>
            <ClubArtwork
              clubType={club.type}
              brand={club.brand}
              model={club.model}
              alt=""
              className="hidden h-44 w-full max-w-60 justify-self-end xl:block"
              imageClassName="px-6 py-6"
              showGroundLine={false}
              priority
              sizes="240px"
            />
          </div>
        </div>
      </header>

      {selectedShots.length > 0 ? (
        <ClubAnalysisTabs
          clubType={club.type}
          clubModelName={clubModelName}
          clubTypeLabel={clubTypeLabel}
          shots={selectedShots}
          afterDispersion={
            <>
              {children}
              <ClubIntelligence
                clubType={club.type}
                isShortGameTouch={isShortGameTouch}
                isSandWedge={isSandWedge}
                selectedRange={selectedRange.description}
                stock={stock}
                touch={touch}
                latestShotDate={latestShotDate}
                health={health}
              />
              <ClubDevelopmentPanel evolution={evolution} monthChange={monthChange} />
              {hasWedgeRoles ? <WedgeRoleSummaryGrid summaries={stock.shotRoleSummaries} /> : null}
            </>
          }
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

function HeroYardage({
  label,
  value,
  detail,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 shadow-sm",
        featured
          ? "border-emerald-200 bg-[#0B7A3B] text-white shadow-emerald-950/10"
          : "border-white/70 bg-white/72 text-[#111827]",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          featured ? "text-white/78" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="mt-2 text-4xl font-semibold tracking-normal">{value}</p>
      <p className={cn("mt-2 text-sm", featured ? "text-white/76" : "text-muted-foreground")}>
        {detail}
      </p>
    </div>
  );
}

function HeroTrait({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
}) {
  return (
    <div className={cn("rounded-lg border p-4 shadow-sm", tonePanelClass(tone))}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", toneTextClass(tone))} />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function ClubIntelligence({
  clubType,
  isShortGameTouch,
  isSandWedge,
  selectedRange,
  stock,
  touch,
  latestShotDate,
  health,
}: {
  clubType: string;
  isShortGameTouch: boolean;
  isSandWedge: boolean;
  selectedRange: string;
  stock: StockYardage;
  touch: ShortGameTouchSummary;
  latestShotDate: string;
  health: ClubHealth;
}) {
  const cleanShots = isShortGameTouch && !isSandWedge ? touch.sampleSize : stock.sampleSize;
  const excludedShots = isShortGameTouch
    ? Math.max(0, stock.rawSampleSize - touch.sampleSize)
    : stock.stockExclusionCount;
  const decisionReady =
    isShortGameTouch && !isSandWedge
      ? touch.sampleSize >= 15
      : stock.sampleSize >= STOCK_DECISION_TARGET_SHOTS &&
        stock.confidenceScore >= 85 &&
        stock.coursePlayCarryYd !== null;
  const needsShots = isShortGameTouch
    ? Math.max(0, 15 - touch.sampleSize)
    : Math.max(0, STOCK_DECISION_TARGET_SHOTS - stock.sampleSize);
  const progressValue = isShortGameTouch
    ? Math.min(100, (touch.sampleSize / 15) * 100)
    : stock.confidenceScore;
  const rangeValue = isShortGameTouch
    ? `${formatMetric(touch.carryP25Yd)}-${formatMetric(touch.carryP75Yd)} yd`
    : formatRange(stock.carryP25Yd, stock.carryP75Yd);
  const recommendedCarry =
    isShortGameTouch && !isSandWedge ? null : displayRecommendedCarry(stock, isShortGameTouch);

  return (
    <Card className="premium-card" id="club-intelligence">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl tracking-normal">Club Intelligence</CardTitle>
            <CardDescription>
              {isShortGameTouch
                ? "Touch control, full-stock separation and data quality in one read."
                : `Rolling stock yardage from ${selectedRange}, with health and decision readiness.`}
            </CardDescription>
          </div>
          <Badge className={cn("w-fit border px-3 py-1", health.badgeClassName)}>
            Club Health: {health.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <IntelligenceMetric
            icon={Target}
            label={isShortGameTouch ? "Touch median" : "Recommended"}
            value={formatWholeYards(isShortGameTouch ? touch.carryMedianYd : recommendedCarry)}
            detail={
              isShortGameTouch
                ? "Touch control"
                : stock.coursePlayCarryYd === null
                  ? "Provisional"
                  : "Course number"
            }
            tone="green"
          />
          <IntelligenceMetric
            icon={Gauge}
            label={isShortGameTouch ? "Full stock" : "Best Stock"}
            value={formatWholeYards(
              isShortGameTouch
                ? isSandWedge
                  ? stock.bestStockCarryYd
                  : null
                : stock.bestStockCarryYd,
            )}
            detail="Clean median"
            tone="sky"
          />
          <IntelligenceMetric
            icon={TrendingUp}
            label="Personal Best"
            value={formatWholeYards(stock.personalBestCarryYd)}
            detail="Longest clean carry"
            tone="neutral"
          />
          <IntelligenceMetric
            icon={BarChart3}
            label={isShortGameTouch ? "Touch count" : "Confidence"}
            value={isShortGameTouch ? touch.sampleSize.toString() : `${stock.confidenceScore}%`}
            detail={health.confidenceDetail}
            tone={health.tone}
          />
          <IntelligenceMetric
            icon={Database}
            label="Data Quality"
            value={health.dataQuality}
            detail={`${cleanShots} clean · ${excludedShots} excluded`}
            tone={cleanShots >= 8 ? "green" : cleanShots >= 4 ? "amber" : "red"}
          />
          <IntelligenceMetric
            icon={CheckCircle2}
            label="Decision Ready"
            value={decisionReady ? "Yes" : "No"}
            detail={needsShots > 0 ? `Needs ${needsShots} more clean` : "Ready for play number"}
            tone={decisionReady ? "green" : "amber"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="apple-panel-strong p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-semibold">
                {isShortGameTouch ? "Touch + full-stock health" : stock.label}
              </span>
              <span className="text-muted-foreground">
                {cleanShots} clean / {stock.rawSampleSize} total
              </span>
            </div>
            <Progress value={progressValue} className="mt-3" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DataChip label="Range" value={rangeValue} />
              <DataChip
                label={isShortGameTouch ? "Full launch" : "Launch avg"}
                value={
                  isShortGameTouch && !isSandWedge
                    ? "--"
                    : formatMetric(stock.averageLaunchAngleDeg, " deg")
                }
              />
              <DataChip label="Last shot" value={latestShotDate} />
              <DataChip
                label={isShortGameTouch ? "Under 30" : "Ball speed"}
                value={
                  isShortGameTouch
                    ? touch.under30YdCount.toString()
                    : formatMetric(stock.averageBallSpeedMph, " mph")
                }
              />
            </div>
          </div>

          <div className="apple-panel-strong p-4">
            <p className="text-sm font-semibold">Club Health</p>
            <div className="mt-3 grid gap-2">
              <HealthRow
                label="Confidence"
                value={isShortGameTouch ? "Touch sample" : `${stock.confidenceScore}%`}
                tone={health.tone}
              />
              <HealthRow label="Data quality" value={health.dataQuality} tone={health.tone} />
              <HealthRow
                label="Gapping"
                value={health.gapping}
                tone={health.gapping === "Good" ? "green" : "amber"}
              />
              <HealthRow
                label="Dispersion"
                value={health.dispersion}
                tone={
                  health.dispersion === "Stable"
                    ? "green"
                    : health.dispersion === "Playable"
                      ? "amber"
                      : health.dispersion === "Wide"
                        ? "red"
                        : "neutral"
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-[#F8FAF6] p-4">
          <p className="text-sm font-semibold">
            {isShortGameTouch ? "Role separation" : "Best-stock filter reasons"}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isShortGameTouch
              ? shortGameStockNote(clubType)
              : `${formatStockExclusionReasons(stock.stockExclusionReasons)}. Best Stock is the median of the selected top-20 clean stock sample, while Personal Best keeps the single longest clean full-role carry visible without making it the play number.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function IntelligenceMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
}) {
  return (
    <div className={cn("rounded-lg border p-3", tonePanelClass(tone))}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", toneTextClass(tone))} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-normal">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function DataChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/82 p-3 ring-1 ring-slate-200/80">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function HealthRow({ label, value, tone }: { label: string; value: string; tone: MetricTone }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-slate-200/80">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold", toneTextClass(tone))}>{value}</span>
    </div>
  );
}

function ClubDevelopmentPanel({
  evolution,
  monthChange,
}: {
  evolution: ClubEvolutionPoint[];
  monthChange: MonthChange;
}) {
  const maxEvolution = Math.max(1, ...evolution.map((point) => point.value ?? 0));

  return (
    <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-2xl tracking-normal">Club Evolution</CardTitle>
          <CardDescription>Monthly stock-carry movement for the selected club.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {evolution.length > 0 ? (
            evolution.map((point) => (
              <div key={point.key} className="apple-panel-strong p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-muted-foreground">{point.label}</p>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                    {point.shotCount}
                  </span>
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-normal">
                  {formatWholeYards(point.value)}
                </p>
                <div className="mt-4 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#0B7A3B]"
                    style={{ width: `${Math.max(8, ((point.value ?? 0) / maxEvolution) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="apple-panel-strong p-4 text-sm text-muted-foreground sm:col-span-3">
              Monthly evolution appears after this club has dated carry shots.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-2xl tracking-normal">What Changed?</CardTitle>
          <CardDescription>
            {monthChange.previousLabel && monthChange.currentLabel
              ? `${monthChange.currentLabel} compared with ${monthChange.previousLabel}.`
              : "Needs another month of shots before a club-only comparison is meaningful."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ChangeMetric
            label="Carry"
            value={formatDelta(monthChange.carryDeltaYd, " yd")}
            tone={deltaTone(monthChange.carryDeltaYd, "higher")}
          />
          <ChangeMetric
            label="Shot cone"
            value={formatDelta(monthChange.coneDeltaYd, " yd")}
            tone={deltaTone(monthChange.coneDeltaYd, "lower")}
          />
          <ChangeMetric
            label="Confidence"
            value={formatDelta(monthChange.confidenceDelta, "%")}
            tone={deltaTone(monthChange.confidenceDelta, "higher")}
          />
          <ChangeMetric
            label="Path"
            value={formatDelta(monthChange.pathDeltaDeg, " deg")}
            tone="sky"
          />
        </CardContent>
      </Card>
    </section>
  );
}

function ChangeMetric({ label, value, tone }: { label: string; value: string; tone: MetricTone }) {
  return (
    <div className={cn("rounded-lg border p-4", tonePanelClass(tone))}>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-3xl font-semibold tracking-normal", toneTextClass(tone))}>
        {value}
      </p>
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

function formatClubIdentityName(clubType: string) {
  const normalized = clubType.toLowerCase();

  if (/^[1-9]i$/.test(normalized)) {
    return `${normalized[0]} Iron`;
  }

  if (/^[1-9]w$/.test(normalized)) {
    return `${normalized[0]} Wood`;
  }

  if (/^[1-9]h$/.test(normalized)) {
    return `${normalized[0]} Hybrid`;
  }

  const wedgeNames: Record<string, string> = {
    pw: "Pitching Wedge",
    gw: "Gap Wedge",
    aw: "Approach Wedge",
    sw: "Sand Wedge",
    lw: "Lob Wedge",
  };

  return wedgeNames[normalized] ?? formatClubType(clubType);
}

function clubRoleLabel(clubType: string, stock: StockYardage, isShortGameTouch: boolean) {
  if (isShortGameTouch) {
    return stock.sampleSize >= 8 ? "Trusted Scoring Touch Club" : "Developing Scoring Club";
  }

  if (["pw", "gw", "aw", "sw", "lw"].includes(clubType.toLowerCase())) {
    return stock.confidenceScore >= 70 ? "Trusted Scoring Club" : "Developing Scoring Club";
  }

  if (/^[6-9]i$/.test(clubType.toLowerCase())) {
    return stock.confidenceScore >= 70 ? "Trusted Scoring Club" : "Developing Approach Club";
  }

  if (/^[3-5]i$/.test(clubType.toLowerCase()) || clubType.endsWith("h")) {
    return stock.confidenceScore >= 70 ? "Trusted Approach Club" : "Developing Approach Club";
  }

  return stock.confidenceScore >= 70 ? "Trusted Tee Club" : "Developing Distance Club";
}

function clubHealth(
  stock: StockYardage,
  shots: AnalysisShot[],
  isShortGameTouch: boolean,
): ClubHealth {
  const cleanShots = isShortGameTouch
    ? shots.filter((shot) => shot.carryYd !== null).length
    : stock.sampleSize;
  const sideSpread = shotConeWidth(shots);
  const hasEnoughData = cleanShots >= 8;
  const confidence = isShortGameTouch
    ? Math.min(100, Math.round((cleanShots / 15) * 100))
    : stock.confidenceScore;
  const label =
    confidence >= 70 && hasEnoughData
      ? "Healthy"
      : confidence >= 40 || cleanShots >= 5
        ? "Developing"
        : "Needs calibration";
  const tone: MetricTone = label === "Healthy" ? "green" : label === "Developing" ? "amber" : "red";
  const badgeClassName =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800";

  return {
    label,
    tone,
    badgeClassName,
    confidenceDetail: isShortGameTouch ? `${cleanShots} touch shots` : `${stock.label} sample`,
    statusDetail:
      label === "Healthy"
        ? "Stable enough to trust"
        : label === "Developing"
          ? "Keep building clean shots"
          : "Needs a fresh baseline",
    dataQuality: cleanShots >= 12 ? "Strong" : cleanShots >= 8 ? "Good" : "Building",
    gapping: stock.coursePlayCarryYd === null ? "Check below" : "Good",
    dispersion:
      sideSpread === null
        ? "Building"
        : sideSpread <= 24
          ? "Stable"
          : sideSpread <= 45
            ? "Playable"
            : "Wide",
  };
}

function typicalMissLabel(shots: AnalysisShot[]) {
  const sides = numericValues(shots.map((shot) => shot.sideCarryYd));
  const medianSide = medianNumber(sides);

  if (medianSide === null || Math.abs(medianSide) < 4) {
    return {
      label: "Mostly straight",
      detail: "Median side near target",
      tone: "green" as const,
    };
  }

  const direction = medianSide > 0 ? "push" : "pull";
  const absoluteSide = Math.abs(medianSide);

  if (absoluteSide < 10) {
    return {
      label: `Small ${direction}`,
      detail: `${formatMetric(absoluteSide, " yd")} median side`,
      tone: "green" as const,
    };
  }

  if (absoluteSide < 22) {
    return {
      label: direction === "push" ? "Right miss" : "Left miss",
      detail: `${formatMetric(absoluteSide, " yd")} median side`,
      tone: "amber" as const,
    };
  }

  return {
    label: direction === "push" ? "Big right miss" : "Big left miss",
    detail: `${formatMetric(absoluteSide, " yd")} median side`,
    tone: "red" as const,
  };
}

function buildClubEvolution(shots: AnalysisShot[], clubType: string): ClubEvolutionPoint[] {
  const groups = shotsByMonth(shots);

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-3)
    .map(([key, monthShots]) => {
      const stock = calculateStockYardage(monthShots, monthShots.length, { clubType });

      return {
        key,
        label: monthLabel(key),
        value:
          stock.bestStockCarryYd ??
          medianNumber(numericValues(monthShots.map((shot) => shot.carryYd))),
        shotCount: monthShots.length,
      };
    });
}

function buildMonthChange(shots: AnalysisShot[], clubType: string): MonthChange {
  const groups = [...shotsByMonth(shots).entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const latest = groups.at(-1);
  const previous = groups.at(-2);

  if (!latest || !previous) {
    return {
      currentLabel: latest ? monthLabel(latest[0]) : null,
      previousLabel: null,
      carryDeltaYd: null,
      coneDeltaYd: null,
      confidenceDelta: null,
      pathDeltaDeg: null,
    };
  }

  const latestStock = calculateStockYardage(latest[1], latest[1].length, { clubType });
  const previousStock = calculateStockYardage(previous[1], previous[1].length, { clubType });

  return {
    currentLabel: monthLabel(latest[0]),
    previousLabel: monthLabel(previous[0]),
    carryDeltaYd: delta(latestStock.bestStockCarryYd, previousStock.bestStockCarryYd),
    coneDeltaYd: delta(shotConeWidth(latest[1]), shotConeWidth(previous[1])),
    confidenceDelta: latestStock.confidenceScore - previousStock.confidenceScore,
    pathDeltaDeg: delta(
      averageNumber(numericValues(latest[1].map((shot) => shot.clubPathDeg))),
      averageNumber(numericValues(previous[1].map((shot) => shot.clubPathDeg))),
    ),
  };
}

function shotsByMonth(shots: AnalysisShot[]) {
  const groups = new Map<string, AnalysisShot[]>();

  for (const shot of shots) {
    const date = new Date(shot.shotAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthShots = groups.get(key) ?? [];
    monthShots.push(shot);
    groups.set(key, monthShots);
  }

  return groups;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
    new Date(year, (month || 1) - 1, 1),
  );
}

function shotConeWidth(shots: AnalysisShot[]) {
  const sides = numericValues(shots.map((shot) => shot.sideCarryYd));

  if (sides.length === 0) {
    return null;
  }

  return roundOne(percentileNumber(sides.map(Math.abs), 0.75) * 2);
}

function shortGameStockNote(clubType: string) {
  if (clubType === "sw") {
    return "SW stock uses full-role shots from 75 yd and above. Pitch and chip windows stay in touch analysis.";
  }

  return "Round chips and pitches stay in touch analysis, not best-stock yardage.";
}

function tonePanelClass(tone: MetricTone) {
  if (tone === "green") {
    return "border-emerald-200 bg-emerald-50/72";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-50/72";
  }

  if (tone === "red") {
    return "border-red-200 bg-red-50/72";
  }

  if (tone === "sky") {
    return "border-sky-200 bg-sky-50/72";
  }

  return "border-slate-200 bg-white/78";
}

function toneTextClass(tone: MetricTone) {
  if (tone === "green") {
    return "text-emerald-700";
  }

  if (tone === "amber") {
    return "text-amber-700";
  }

  if (tone === "red") {
    return "text-red-700";
  }

  if (tone === "sky") {
    return "text-sky-700";
  }

  return "text-slate-700";
}

function deltaTone(value: number | null, goodDirection: "higher" | "lower"): MetricTone {
  if (value === null || Math.abs(value) < 0.5) {
    return "neutral";
  }

  if (goodDirection === "higher") {
    return value > 0 ? "green" : "amber";
  }

  return value < 0 ? "green" : "amber";
}

function formatWholeYards(value: number | null) {
  return value === null ? "--" : `${Math.round(value)} yd`;
}

function displayRecommendedCarry(stock: StockYardage, isShortGameTouch: boolean) {
  if (stock.coursePlayCarryYd !== null) {
    return stock.coursePlayCarryYd;
  }

  if (isShortGameTouch || stock.bestStockCarryYd === null || stock.sampleSize < 5) {
    return null;
  }

  return Math.floor(stock.bestStockCarryYd / 5) * 5;
}

function formatDelta(value: number | null, suffix: string) {
  if (value === null) {
    return "--";
  }

  const rounded = Math.abs(value) >= 10 ? Math.round(value) : Number(value.toFixed(1));
  const sign = rounded > 0 ? "+" : "";

  return `${sign}${numberFormatter.format(rounded)}${suffix}`;
}

function delta(current: number | null, previous: number | null) {
  return current === null || previous === null ? null : roundOne(current - previous);
}

function numericValues(values: Array<number | null | undefined>) {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

function medianNumber(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return percentileNumber(values, 0.5);
}

function averageNumber(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return roundOne(values.reduce((total, value) => total + value, 0) / values.length);
}

function percentileNumber(values: number[], percentile: number) {
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return roundOne(ordered[lower]);
  }

  const weight = position - lower;

  return roundOne(ordered[lower] * (1 - weight) + ordered[upper] * weight);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
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
