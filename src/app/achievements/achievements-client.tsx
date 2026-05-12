"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  EyeOff,
  Lock,
  RotateCcw,
  Search,
  Trophy,
  Zap,
} from "lucide-react";

import { syncAchievementsAction } from "@/app/achievements/actions";
import { notifyAchievementUnlocks } from "@/components/achievement-notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { achievementDomId } from "@/lib/alert-links";
import type { AchievementPageData, AchievementView } from "@/lib/achievements/service";
import type { AchievementTier } from "@/lib/achievements/types";
import { cn } from "@/lib/utils";

type Props = {
  data: AchievementPageData;
  focusAchievementId: string | null;
};

const categoryLabels: Record<string, string> = {
  data: "Data",
  power: "Power",
  accuracy: "Accuracy",
  launch: "Launch",
  strike: "Strike",
  driver: "Driver",
  fiveWood: "5W",
  gapping: "Gapping",
  consistency: "Consistency",
  coach: "Coach",
  progress: "Progress",
  scoring: "Scoring",
  putting: "Putting",
  shortGame: "Short Game",
  roundStats: "Round Stats",
  hidden: "Hidden",
};

const clubOrder = [
  "driver",
  "3w",
  "5w",
  "7w",
  "3h",
  "4h",
  "5h",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "pw",
  "gw",
  "sw",
  "lw",
];

const clubLabels: Record<string, string> = {
  driver: "Driver",
  "3w": "3W",
  "5w": "5W",
  "7w": "7W",
  "3h": "3H",
  "4h": "4H",
  "5h": "5H",
  "4i": "4i",
  "5i": "5i",
  "6i": "6i",
  "7i": "7i",
  "8i": "8i",
  "9i": "9i",
  pw: "PW",
  gw: "GW",
  sw: "SW",
  lw: "LW",
};

const tierStyles: Record<AchievementTier, string> = {
  bronze: "border-amber-700/20 bg-amber-50 text-amber-900",
  silver: "border-slate-400/30 bg-slate-100 text-slate-800",
  gold: "border-yellow-600/20 bg-yellow-50 text-yellow-900",
  platinum: "border-cyan-600/20 bg-cyan-50 text-cyan-900",
  diamond: "border-indigo-600/20 bg-indigo-50 text-indigo-900",
  hidden: "border-zinc-700/20 bg-zinc-100 text-zinc-800",
};

const tierLabels: Record<AchievementTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Master",
  hidden: "Hidden",
};

const trophyTiers: AchievementTier[] = ["diamond", "platinum", "gold", "silver", "bronze"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortWeekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const calendarGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: "0.25rem",
} as const;

const calendarCellStyle = {
  aspectRatio: "1 / 1",
  minHeight: "2.5rem",
  width: "100%",
} as const;

export function AchievementsClient({ data, focusAchievementId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialCalendarDay = latestUnlockedDayFromAchievements(data.achievements);
  const [statusFilter, setStatusFilter] = useState("unlocked");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clubFilter, setClubFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [query, setQuery] = useState("");
  const [dismissedFocusId, setDismissedFocusId] = useState<string | null>(null);
  const focusedAchievementId = focusAchievementId && dismissedFocusId !== focusAchievementId ? focusAchievementId : "";
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(initialCalendarDay);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    monthKeyFromDayKey(initialCalendarDay ?? dayKeyFromDate(new Date())),
  );

  useEffect(() => {
    if (!data.needsSync) {
      return;
    }

    startTransition(async () => {
      const result = await syncAchievementsAction();

      if (result.unlockedAchievements.length > 0) {
        notifyAchievementUnlocks(result.unlockedAchievements);
      }

      router.refresh();
    });
  }, [data.needsSync, router]);

  const unlockCalendar = useMemo(
    () => buildUnlockCalendar(data.achievements),
    [data.achievements],
  );
  const effectiveCalendarDay = selectedCalendarDay ?? unlockCalendar.latestDay;

  const typeOptions = useMemo(
    () =>
      data.categorySummaries.map((summary) => ({
        id: summary.category,
        label: categoryLabels[summary.category] ?? summary.category,
        total: summary.total,
        unlocked: summary.unlocked,
      })),
    [data.categorySummaries],
  );

  const trackedClubTypeSet = useMemo(
    () => new Set(data.trackedClubTypes),
    [data.trackedClubTypes],
  );

  const clubOptions = useMemo(() => {
    const clubCounts = new Map<string, { total: number; unlocked: number }>();

    for (const achievement of data.achievements) {
      for (const clubType of achievement.clubTypes ?? []) {
        if (!trackedClubTypeSet.has(clubType)) {
          continue;
        }

        const current = clubCounts.get(clubType) ?? { total: 0, unlocked: 0 };
        current.total += 1;
        current.unlocked += achievement.unlocked ? 1 : 0;
        clubCounts.set(clubType, current);
      }
    }

    return [...clubCounts.entries()]
      .sort(([left], [right]) => clubSortValue(left) - clubSortValue(right))
      .map(([clubType, counts]) => ({
        id: clubType,
        label: clubLabels[clubType] ?? clubType.toUpperCase(),
        ...counts,
      }));
  }, [data.achievements, trackedClubTypeSet]);

  const tierOptions = useMemo(
    () =>
      trophyTiers.map((tier) => {
        const achievements = data.achievements.filter((achievement) => achievement.tier === tier);

        return {
          id: tier,
          label: tierLabels[tier],
          total: achievements.length,
          unlocked: achievements.filter((achievement) => achievement.unlocked).length,
        };
      }),
    [data.achievements],
  );

  const trophyCabinet = tierOptions.map((tier) => ({
    ...tier,
    completion: Math.round((tier.unlocked / Math.max(1, tier.total)) * 100),
  }));
  const focusedAchievement = focusedAchievementId
    ? data.achievements.find((achievement) => achievement.id === focusedAchievementId)
    : null;

  const filteredAchievements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return data.achievements.filter((achievement) => {
      if (focusedAchievementId) {
        return achievement.id === focusedAchievementId;
      }

      if (hideCompleted && achievement.unlocked) {
        return false;
      }

      if (!hideCompleted && statusFilter === "unlocked" && !achievement.unlocked) {
        return false;
      }

      if (typeFilter !== "all" && achievement.category !== typeFilter) {
        return false;
      }

      if (clubFilter !== "all" && !(achievement.clubTypes ?? []).includes(clubFilter)) {
        return false;
      }

      if (tierFilter !== "all" && achievement.tier !== tierFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const clubText = (achievement.clubTypes ?? [])
        .map((clubType) => clubLabels[clubType] ?? clubType)
        .join(" ");

      return `${achievement.name} ${achievement.description} ${achievement.category} ${achievement.triggerType} ${clubText}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [clubFilter, data.achievements, focusedAchievementId, hideCompleted, query, statusFilter, tierFilter, typeFilter]);
  const isFiltered = statusFilter !== "unlocked" || typeFilter !== "all" || clubFilter !== "all" || tierFilter !== "all" || hideCompleted || Boolean(query.trim()) || Boolean(focusedAchievementId);
  const selectedTypeLabel =
    typeFilter === "all"
      ? "All types"
      : (typeOptions.find((item) => item.id === typeFilter)?.label ?? "All types");
  const selectedClubLabel =
    clubFilter === "all"
      ? "All clubs"
      : (clubOptions.find((item) => item.id === clubFilter)?.label ?? "All clubs");
  const selectedTierLabel =
    tierFilter === "all"
      ? "All tiers"
      : (tierOptions.find((item) => item.id === tierFilter)?.label ?? "All tiers");
  const shownAchievements =
    !query.trim() && filteredAchievements.length > 360 ? filteredAchievements.slice(0, 360) : filteredAchievements;

  function clearFilters() {
    setDismissedFocusId(focusAchievementId);
    setStatusFilter("unlocked");
    setTypeFilter("all");
    setClubFilter("all");
    setTierFilter("all");
    setHideCompleted(false);
    setQuery("");
  }

  return (
    <div className="space-y-5">
      <Card className="premium-card">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Trophy cabinet</CardTitle>
              <CardDescription>Unlocked achievement tiers from Rapsodo and round data.</CardDescription>
            </div>
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <Trophy className="size-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {trophyCabinet.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => setTierFilter(tier.id)}
                className={cn(
                  "apple-panel-strong p-3 text-left transition-colors hover:border-amber-300",
                  tierFilter === tier.id ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge className={cn("border", tierStyles[tier.id])}>{tier.label}</Badge>
                  <span className="text-xs text-muted-foreground">{tier.completion}%</span>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-normal">
                  {tier.unlocked.toLocaleString("en-GB")}
                  <span className="text-sm font-medium text-muted-foreground">/{tier.total.toLocaleString("en-GB")}</span>
                </p>
                <Progress value={tier.completion} className="mt-3 h-1.5" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="premium-card border-zinc-900 bg-[#111827] text-white">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardDescription className="text-zinc-300">Player level</CardDescription>
                <CardTitle className="mt-2 text-5xl font-semibold tracking-normal">
                  Level {data.level.level}
                </CardTitle>
              </div>
              <div className="grid size-12 place-items-center rounded-lg bg-white/10">
                <Zap className="size-6 text-emerald-300" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Total XP" value={data.totalXp.toLocaleString("en-GB")} dark />
              <Metric label="Unlocked" value={`${data.unlockedCount}/${data.totalCount}`} dark />
              <Metric label="Next level" value={`${data.level.progressXp}/${data.level.neededXp}`} dark />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-zinc-300">
                <span>XP to level {data.level.level + 1}</span>
                <span>{data.level.progressPercent}%</span>
              </div>
              <Progress value={data.level.progressPercent} className="bg-white/15 [&_[data-slot=progress-indicator]]:bg-emerald-300" />
            </div>
            {data.needsSync || isPending ? (
              <p className="text-sm text-zinc-300">
                {isPending ? "Syncing historical rounds and Rapsodo sessions..." : "Achievement sync queued."}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Latest achievements gained</CardTitle>
            <CardDescription>Last 10 unlocks with source evidence where available.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-2">
              {data.recentUnlocks.map((achievement) => (
                <RecentUnlock key={achievement.id} achievement={achievement} />
              ))}
            </div>
            {data.recentUnlocks.length === 0 ? (
              <div className="apple-panel p-4 text-sm text-muted-foreground">
                Import Rapsodo sessions or complete round scorecards to start unlocking.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Catalog" value={data.totalCount.toLocaleString("en-GB")} />
        <Metric label="Rapsodo + round" value="Enabled" />
        <Metric label="Hidden found" value={data.achievements.filter((achievement) => achievement.hidden && achievement.unlocked).length.toString()} />
        <Metric label="Completion" value={`${Math.round((data.unlockedCount / Math.max(1, data.totalCount)) * 100)}%`} />
      </section>

      <AchievementUnlockCalendar
        calendar={unlockCalendar}
        monthKey={calendarMonth}
        selectedDay={effectiveCalendarDay}
        onMonthChange={setCalendarMonth}
        onSelectedDayChange={setSelectedCalendarDay}
      />

      <Card className="premium-card">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Achievement catalog</CardTitle>
              <CardDescription>
                Major badges plus generated club metric ladders from real Rapsodo and round data.
              </CardDescription>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(145px,190px)_minmax(145px,190px)_minmax(145px,190px)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search achievements"
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 w-full rounded-lg" aria-label="Achievement type">
                <span className="truncate">{selectedTypeLabel}</span>
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="z-[80]">
                <SelectItem value="all">All types</SelectItem>
                {typeOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label} ({item.unlocked}/{item.total})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={clubFilter} onValueChange={setClubFilter}>
              <SelectTrigger className="h-10 w-full rounded-lg" aria-label="Club">
                <span className="truncate">{selectedClubLabel}</span>
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="z-[80]">
                <SelectItem value="all">All clubs</SelectItem>
                {clubOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label} ({item.unlocked}/{item.total})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="h-10 w-full rounded-lg" aria-label="Tier">
                <span className="truncate">{selectedTierLabel}</span>
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="z-[80]">
                <SelectItem value="all">All tiers</SelectItem>
                {tierOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label} ({item.unlocked}/{item.total})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={hideCompleted ? "default" : "outline"}
              className="h-10 justify-center rounded-lg"
              onClick={() => setHideCompleted((current) => !current)}
            >
              <EyeOff className="size-4" />
              Hide completed
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {focusedAchievement ? (
              <Badge className="border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-50">
                Focused unlock: {focusedAchievement.displayName}
              </Badge>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={!hideCompleted && statusFilter === "unlocked" ? "default" : "outline"}
              onClick={() => setStatusFilter("unlocked")}
            >
              Unlocked
              <span className="ml-1 text-xs opacity-70">{data.unlockedCount}/{data.unlockedCount}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!hideCompleted && statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              All
              <span className="ml-1 text-xs opacity-70">{data.unlockedCount}/{data.totalCount}</span>
            </Button>
            {isFiltered ? (
              <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                <RotateCcw className="size-4" />
                Reset
              </Button>
            ) : null}
            <span className="text-sm text-muted-foreground">
              Showing {shownAchievements.length.toLocaleString("en-GB")} of {filteredAchievements.length.toLocaleString("en-GB")}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!query.trim() && filteredAchievements.length > shownAchievements.length ? (
            <div className="apple-panel mb-4 px-3 py-2 text-sm text-muted-foreground">
              Showing the first {shownAchievements.length.toLocaleString("en-GB")} achievements. Use search, club, type, or tier filters to narrow the full {filteredAchievements.length.toLocaleString("en-GB")} set.
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shownAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                focused={achievement.id === focusedAchievementId}
              />
            ))}
          </div>

          {shownAchievements.length === 0 ? (
            <div className="apple-panel p-8 text-center text-sm text-muted-foreground">
              No achievements match this filter.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function AchievementUnlockCalendar({
  calendar,
  monthKey,
  selectedDay,
  onMonthChange,
  onSelectedDayChange,
}: {
  calendar: UnlockCalendar;
  monthKey: string;
  selectedDay: string | null;
  onMonthChange: (monthKey: string) => void;
  onSelectedDayChange: (dayKey: string) => void;
}) {
  const selectedAchievements = selectedDay ? (calendar.byDay.get(selectedDay) ?? []) : [];
  const selectedXp = selectedAchievements.reduce((total, achievement) => total + achievement.xpAwarded, 0);
  const cells = buildCalendarCells(monthKey, calendar.byDay, selectedDay);

  return (
    <Card className="premium-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Unlock calendar</CardTitle>
            <CardDescription>Select a day to see which achievements were unlocked.</CardDescription>
          </div>
          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <CalendarDays className="size-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="apple-panel p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() => onMonthChange(addMonths(monthKey, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <p className="text-sm font-semibold">{formatMonthLabel(monthKey)}</p>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Next month"
                onClick={() => onMonthChange(addMonths(monthKey, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div
              className="pb-2 text-center text-[11px] font-medium uppercase tracking-normal text-muted-foreground"
              style={calendarGridStyle}
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div style={calendarGridStyle}>
              {cells.map((cell) => (
                <button
                  key={cell.dayKey}
                  type="button"
                  onClick={() => onSelectedDayChange(cell.dayKey)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border text-sm transition-colors",
                    cell.isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : cell.unlockCount > 0
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                        : "border-border bg-white hover:bg-[#f3f4f6]",
                    !cell.isCurrentMonth && !cell.isSelected && "text-muted-foreground opacity-50",
                  )}
                  style={calendarCellStyle}
                  aria-pressed={cell.isSelected}
                  aria-label={`${formatDayLabel(cell.dayKey)}: ${cell.unlockCount} achievement${cell.unlockCount === 1 ? "" : "s"} unlocked`}
                >
                  <span className="font-medium">{cell.dayNumber}</span>
                  {cell.unlockCount > 0 ? (
                    <span
                      className={cn(
                        "mt-0.5 rounded-full px-1.5 text-[10px] font-semibold leading-4",
                        cell.isSelected ? "bg-white text-zinc-900" : "bg-emerald-600 text-white",
                      )}
                    >
                      {cell.unlockCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="apple-panel p-3">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {selectedDay ? formatSelectedDayLabel(selectedDay) : "No day selected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedAchievements.length > 0
                    ? `${selectedAchievements.length.toLocaleString("en-GB")} unlocks, ${selectedXp.toLocaleString("en-GB")} XP`
                    : "Choose a marked day from the calendar."}
                </p>
              </div>
              {calendar.latestDay ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onSelectedDayChange(calendar.latestDay as string);
                    onMonthChange(monthKeyFromDayKey(calendar.latestDay as string));
                  }}
                >
                  Latest day
                </Button>
              ) : null}
            </div>

            {selectedAchievements.length > 0 ? (
              <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "28rem" }}>
                {selectedAchievements.map((achievement) => (
                  <CalendarUnlockItem key={achievement.id} achievement={achievement} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-white/90 p-5 text-sm text-muted-foreground ring-1 ring-slate-200/80">
                No achievements unlocked on this day.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarUnlockItem({ achievement }: { achievement: AchievementView }) {
  return (
    <div className="apple-panel-strong p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-5">{achievement.displayName}</p>
            <Badge className={cn("border", tierStyles[achievement.tier])}>{tierLabels[achievement.tier]}</Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{achievement.displayDescription}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-emerald-700">
          {achievement.xpAwarded.toLocaleString("en-GB")} XP
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{formatUnlockTime(achievement.unlockedAt)}</span>
        {achievement.source?.href ? (
          <Link
            href={achievement.source.href}
            className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
          >
            Open source
            <ExternalLink className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function RecentUnlock({ achievement }: { achievement: AchievementView }) {
  const source = achievement.source;

  return (
    <div className="apple-panel-strong p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-5">{achievement.displayName}</p>
            <Badge className={cn("border", tierStyles[achievement.tier])}>{tierLabels[achievement.tier]}</Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{achievement.displayDescription}</p>
        </div>
        <div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right">
          <div className="flex items-center gap-1 sm:justify-end">
            <CalendarDays className="size-3.5" />
            <span>{formatUnlockDate(achievement.unlockedAt)}</span>
          </div>
          <p className="mt-1 font-medium text-foreground">{achievement.xpAwarded.toLocaleString("en-GB")} XP</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-white/90 px-3 py-2 ring-1 ring-slate-200/80">
        {source ? (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {sourceLabel(source.kind)}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium">{source.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{source.detail}</p>
              </div>
              {source.href ? (
                <Link
                  href={source.href}
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium text-foreground hover:bg-[#f3f4f6]"
                >
                  Open source
                  <ExternalLink className="size-3.5" />
                </Link>
              ) : null}
            </div>
            {source.stats.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {source.stats.map((stat) => (
                  <span
                    key={`${achievement.id}-${stat.label}`}
                    className="inline-flex min-h-7 items-center gap-1 rounded-lg bg-slate-50/90 px-2 text-xs ring-1 ring-slate-200/80"
                  >
                    <span className="text-muted-foreground">{stat.label}</span>
                    <span className="font-medium">{stat.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Source evidence was not recorded for this older unlock.
          </p>
        )}
      </div>
    </div>
  );
}

function AchievementCard({
  achievement,
  focused,
}: {
  achievement: AchievementView;
  focused: boolean;
}) {
  return (
    <div
      id={achievementDomId(achievement.id)}
      className={cn(
        "apple-panel-strong flex min-h-40 flex-col justify-between p-4",
        achievement.unlocked ? "border-emerald-300" : "border-border",
        focused && "ring-2 ring-emerald-500/40",
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg", achievement.unlocked ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500")}>
            {achievement.hidden && !achievement.unlocked ? (
              <Lock className="size-5" />
            ) : achievement.unlocked ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <Award className="size-5" />
            )}
          </div>
          <Badge className={cn("border", tierStyles[achievement.tier])}>{tierLabels[achievement.tier]}</Badge>
        </div>
        <div>
          <p className="text-base font-semibold leading-6">{achievement.displayName}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{achievement.displayDescription}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {achievement.unlocked ? (
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span>Unlocked</span>
            <span>{achievement.xpAwarded.toLocaleString("en-GB")} XP</span>
          </div>
        ) : achievement.progressPercent !== null ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{achievement.progressLabel ?? "Progress"}</span>
              <span>{achievement.progressPercent}%</span>
            </div>
            <Progress value={achievement.progressPercent} />
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-slate-50/90 px-3 py-2 text-sm text-muted-foreground">
            <span>{categoryLabels[achievement.category] ?? achievement.category}</span>
            <span>{achievement.xp} XP</span>
          </div>
        )}
      </div>
    </div>
  );
}

function sourceLabel(kind: NonNullable<AchievementView["source"]>["kind"]) {
  if (kind === "shot") {
    return "Source shot";
  }

  if (kind === "round") {
    return "Source round";
  }

  if (kind === "session") {
    return "Source session";
  }

  if (kind === "stock") {
    return "Stock yardage";
  }

  if (kind === "progress") {
    return "Progress source";
  }

  return "Source data";
}

function formatUnlockDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Metric({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", dark ? "border-white/10 bg-white/5" : "bg-white/80")}>
      <p className={cn("text-xs font-medium", dark ? "text-zinc-300" : "text-muted-foreground")}>{label}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-normal">
        {label === "Catalog" ? <Trophy className="size-5 text-amber-500" /> : null}
        {value}
      </p>
    </div>
  );
}

function clubSortValue(clubType: string) {
  const index = clubOrder.indexOf(clubType);
  return index === -1 ? clubOrder.length : index;
}

type UnlockCalendar = {
  byDay: Map<string, AchievementView[]>;
  latestDay: string | null;
};

type CalendarCell = {
  dayKey: string;
  dayNumber: number;
  unlockCount: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
};

function buildUnlockCalendar(achievements: AchievementView[]): UnlockCalendar {
  const byDay = new Map<string, AchievementView[]>();

  for (const achievement of achievements) {
    const unlockedDate = unlockedDateForAchievement(achievement);

    if (!unlockedDate) {
      continue;
    }

    const dayKey = dayKeyFromDate(unlockedDate);
    const dayAchievements = byDay.get(dayKey) ?? [];
    dayAchievements.push(achievement);
    byDay.set(dayKey, dayAchievements);
  }

  for (const dayAchievements of byDay.values()) {
    dayAchievements.sort((left, right) => unlockTime(right) - unlockTime(left));
  }

  const latestDay = latestUnlockedDayFromAchievements(achievements);

  return { byDay, latestDay };
}

function buildCalendarCells(
  monthKey: string,
  achievementsByDay: Map<string, AchievementView[]>,
  selectedDay: string | null,
): CalendarCell[] {
  const firstOfMonth = parseDayKey(`${monthKey}-01`);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dayKey = dayKeyFromDate(date);

    return {
      dayKey,
      dayNumber: date.getDate(),
      unlockCount: achievementsByDay.get(dayKey)?.length ?? 0,
      isCurrentMonth: monthKeyFromDayKey(dayKey) === monthKey,
      isSelected: dayKey === selectedDay,
    };
  });
}

function latestUnlockedDayFromAchievements(achievements: AchievementView[]) {
  let latestTime = Number.NEGATIVE_INFINITY;
  let latestDay: string | null = null;

  for (const achievement of achievements) {
    const unlockedDate = unlockedDateForAchievement(achievement);

    if (!unlockedDate) {
      continue;
    }

    const time = unlockedDate.getTime();

    if (time > latestTime) {
      latestTime = time;
      latestDay = dayKeyFromDate(unlockedDate);
    }
  }

  return latestDay;
}

function unlockedDateForAchievement(achievement: AchievementView) {
  if (!achievement.unlockedAt) {
    return null;
  }

  const date = new Date(achievement.unlockedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unlockTime(achievement: AchievementView) {
  const date = unlockedDateForAchievement(achievement);
  return date?.getTime() ?? 0;
}

function dayKeyFromDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthKeyFromDayKey(dayKey: string) {
  return dayKey.slice(0, 7);
}

function parseDayKey(dayKey: string) {
  const [year = "1970", month = "01", day = "01"] = dayKey.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function addMonths(monthKey: string, amount: number) {
  const date = parseDayKey(`${monthKey}-01`);
  date.setMonth(date.getMonth() + amount);
  return monthKeyFromDayKey(dayKeyFromDate(date));
}

function formatMonthLabel(monthKey: string) {
  const date = parseDayKey(`${monthKey}-01`);
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function formatSelectedDayLabel(dayKey: string) {
  const date = parseDayKey(dayKey);
  return `${weekdayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDayLabel(dayKey: string) {
  const date = parseDayKey(dayKey);
  return `${shortWeekdayNames[date.getDay()]}, ${String(date.getDate()).padStart(2, "0")} ${shortMonthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function formatUnlockTime(value: string | null) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
