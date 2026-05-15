"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Brain,
  Database,
  Gauge,
  Target,
  type LucideIcon,
} from "lucide-react";

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
import { calculateStockYardage } from "@/lib/stock-yardage";
import { cn } from "@/lib/utils";
import { ClubAnalysisTabs, type AnalysisShot } from "./club-analysis-tabs";

type ShotRange = "all" | "month3" | "month2" | "month1" | "thisMonth" | "week" | "today";

const RANGE_OPTIONS: Array<{ value: ShotRange; label: string; compactLabel: string; description: string }> = [
  { value: "all", label: "All time", compactLabel: "All", description: "all full shots" },
  { value: "month3", label: "Last 3 months", compactLabel: "3 mo", description: "shots from the last 3 months" },
  { value: "month2", label: "Last 2 months", compactLabel: "2 mo", description: "shots from the last 2 months" },
  { value: "month1", label: "Last month", compactLabel: "1 mo", description: "shots from the last month" },
  { value: "thisMonth", label: "This month", compactLabel: "Month", description: "shots from this month" },
  { value: "week", label: "This week", compactLabel: "Week", description: "shots from this week" },
  { value: "today", label: "Today", compactLabel: "Today", description: "shots from today" },
];
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

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
  const selectedRange = RANGE_OPTIONS.find((option) => option.value === shotRange) ?? RANGE_OPTIONS[0];
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
    () => calculateShortGameTouchSummary(selectedShots, selectedShots.length, { clubType: club.type }),
    [club.type, selectedShots],
  );
  const isShortGameTouch = isShortGameTouchClubType(club.type);
  const latestShotDate = selectedShots[0]?.shotAt ? formatDate(selectedShots[0].shotAt) : "--";
  const shotCount = shotRange !== "all"
    ? `${selectedShots.length}/${orderedShots.length}`
    : selectedShots.length.toString();

  return (
    <>
      <MobileCompactPageHeader
        eyebrow={<Badge className="w-fit text-white hover:opacity-90" style={{ background: accent }}>Club analysis</Badge>}
        title={clubModelName}
        description={clubModelName === clubTypeLabel ? "Unspecified model" : clubTypeLabel}
        metricLabel={isShortGameTouch ? "Touch median" : "Stock carry"}
        metricValue={formatMetric(isShortGameTouch ? touch.carryMedianYd : stock.carryMedianYd, " yd")}
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
          <Button asChild size="sm" className="rounded-xl bg-[#111827] text-white">
            <Link href={`/bag/${club.id}/analytics`} prefetch={false}>Coach</Link>
          </Button>
        }
      />

      <div className="sm:hidden">
        <RangeToggle value={shotRange} onChange={setShotRange} />
      </div>

      <MobileMetricStrip
        items={[
          {
            label: isShortGameTouch ? "Touch" : "Carry",
            value: formatMetric(isShortGameTouch ? touch.carryMedianYd : stock.carryMedianYd, " yd"),
            detail: "Stock",
            tone: "green",
          },
          {
            label: "Play",
            value: formatMetric(isShortGameTouch ? null : stock.recommendedPlayNumberYd, " yd"),
            detail: "Number",
            tone: "sky",
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
                  label={isShortGameTouch ? "Touch median" : "Stock carry"}
                  value={formatMetric(isShortGameTouch ? touch.carryMedianYd : stock.carryMedianYd, " yd")}
                  icon={Target}
                />
                <StatTile
                  label={isShortGameTouch ? "Full stock" : "Play number"}
                  value={formatMetric(isShortGameTouch ? null : stock.recommendedPlayNumberYd, " yd")}
                  icon={Gauge}
                />
                <StatTile label="Shots" value={shotCount} icon={Database} />
                <StatTile
                  label={isShortGameTouch ? "Under 30" : "Confidence"}
                  value={isShortGameTouch ? touch.under30YdCount.toString() : `${stock.confidenceScore}%`}
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
                ? "Round chips and pitches are separated from full-swing stock yardage."
                : `Rolling median from ${selectedRange.description}, with MAD outlier filtering.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-sm text-muted-foreground">Carry median</p>
              <p className="text-6xl font-semibold tracking-normal">
                {formatMetric(isShortGameTouch ? touch.carryMedianYd : stock.carryMedianYd)}
                <span className="ml-2 text-lg text-muted-foreground">yd</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                value={formatMetric(isShortGameTouch ? touch.longestCarryYd : stock.totalMedianYd, " yd")}
              />
              <SmallMetric label="Left miss" value={formatMetric(stock.dispersionLeftYd, " yd")} />
              <SmallMetric
                label={isShortGameTouch ? "Under 30" : "Right miss"}
                value={isShortGameTouch ? touch.under30YdCount.toString() : formatMetric(stock.dispersionRightYd, " yd")}
              />
              <SmallMetric
                label={isShortGameTouch ? "Full stock" : "Ball speed"}
                value={isShortGameTouch ? "--" : formatMetric(stock.averageBallSpeedMph, " mph")}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{isShortGameTouch ? "Short-game touch" : stock.label}</span>
                <span className="text-muted-foreground">
                  {isShortGameTouch
                    ? `${touch.sampleSize} touch / ${stock.rawSampleSize} total`
                    : `${stock.sampleSize} clean / ${stock.rawSampleSize} total`}
                </span>
              </div>
              <Progress value={isShortGameTouch ? Math.min(100, (touch.sampleSize / 50) * 100) : stock.confidenceScore} />
            </div>
            {isShortGameTouch ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                Full-stock SW only builds from non-round full swings. Round SW shots stay in touch analysis.
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
                : "The stock number stays conservative until the sample is stable."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <HealthBlock
              label={isShortGameTouch ? "Touch shots" : "Excluded shots"}
              value={(isShortGameTouch ? touch.sampleSize : stock.excludedCount).toString()}
            />
            <HealthBlock
              label={isShortGameTouch ? "Full launch" : "Launch average"}
              value={isShortGameTouch ? "--" : formatMetric(stock.averageLaunchAngleDeg, " deg")}
            />
            <HealthBlock
              label={isShortGameTouch ? "Touch range" : "Carry range"}
              value={
                isShortGameTouch
                  ? `${formatMetric(touch.carryP25Yd)}-${formatMetric(touch.carryP75Yd)} yd`
                  : `${formatMetric(stock.carryP25Yd)}-${formatMetric(stock.carryP75Yd)} yd`
              }
            />
            <HealthBlock label="Last shot" value={latestShotDate} />
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
                  : "Import Rapsodo CSVs to unlock dispersion, trajectory, and club data."}
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
    <div
      aria-label="Shot date range"
      className="apple-panel w-full max-w-full p-1"
    >
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
              value === option.value && "bg-[#111827] text-white",
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

function formatMetric(value: number | null, suffix = "") {
  return value === null ? "--" : `${numberFormatter.format(value)}${suffix}`;
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
