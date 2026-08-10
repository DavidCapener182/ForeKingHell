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
import { EmptyState } from "@/components/app/empty-state";
import {
  DesktopTableWorkbenchControls,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { DataTableFrame, MobileFilterSheet } from "@/components/premium";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  speed: "Speed",
  mileage: "Mileage",
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
const shortMonthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
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
const defaultUnlockLedgerLimit = 40;
const unlockLedgerPageSize = 40;
const defaultCatalogueLimit = 72;
const cataloguePageSize = 72;
const defaultStatusFilter = "all";
const defaultHideCompleted = true;
type MobileAchievementTab = "next" | "cabinet" | "catalogue" | "calendar";

const achievementUnlockColumns: DesktopWorkbenchColumn[] = [
  { id: "achievement", label: "Achievement", locked: true },
  { id: "unlocked", label: "Unlocked" },
  { id: "tier", label: "Tier" },
  { id: "xp", label: "XP" },
  { id: "category", label: "Category" },
  { id: "source", label: "Source" },
  { id: "action", label: "Action", locked: true },
];

const mobileAchievementTabs: Array<{ id: MobileAchievementTab; label: string }> = [
  { id: "next", label: "Next" },
  { id: "cabinet", label: "Cabinet" },
  { id: "catalogue", label: "Catalogue" },
  { id: "calendar", label: "Calendar" },
];

export function AchievementsClient({ data, focusAchievementId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialCalendarDay = latestUnlockedDayFromAchievements(data.achievements);
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter);
  const [typeFilter, setTypeFilter] = useState("all");
  const [clubFilter, setClubFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(defaultHideCompleted);
  const [query, setQuery] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileAchievementTab>("next");
  const [catalogueLimit, setCatalogueLimit] = useState(defaultCatalogueLimit);
  const [dismissedFocusId, setDismissedFocusId] = useState<string | null>(null);
  const focusedAchievementId =
    focusAchievementId && dismissedFocusId !== focusAchievementId ? focusAchievementId : "";
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

  const unlockCalendar = useMemo(() => buildUnlockCalendar(data.achievements), [data.achievements]);
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

  const trackedClubTypeSet = useMemo(() => new Set(data.trackedClubTypes), [data.trackedClubTypes]);

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
  const unlockLedger = useMemo(
    () =>
      data.achievements
        .filter((achievement) => achievement.unlocked)
        .sort((left, right) => {
          const leftTime = left.unlockedAt ? new Date(left.unlockedAt).getTime() : 0;
          const rightTime = right.unlockedAt ? new Date(right.unlockedAt).getTime() : 0;
          return rightTime - leftTime;
        }),
    [data.achievements],
  );
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
  }, [
    clubFilter,
    data.achievements,
    focusedAchievementId,
    hideCompleted,
    query,
    statusFilter,
    tierFilter,
    typeFilter,
  ]);
  const isFiltered =
    statusFilter !== defaultStatusFilter ||
    typeFilter !== "all" ||
    clubFilter !== "all" ||
    tierFilter !== "all" ||
    hideCompleted !== defaultHideCompleted ||
    Boolean(query.trim()) ||
    Boolean(focusedAchievementId);
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
  const shownAchievements = focusedAchievementId
    ? filteredAchievements.slice(0, 1)
    : filteredAchievements.slice(0, catalogueLimit);
  const remainingFilteredAchievementCount = Math.max(
    0,
    filteredAchievements.length - shownAchievements.length,
  );
  const nextUnlock =
    data.achievements
      .filter((achievement) => !achievement.unlocked)
      .sort((left, right) => (right.progressPercent ?? -1) - (left.progressPercent ?? -1))[0] ??
    null;
  const mobileShownAchievements = shownAchievements.slice(0, 12);

  function clearFilters() {
    setDismissedFocusId(focusAchievementId);
    setStatusFilter(defaultStatusFilter);
    setTypeFilter("all");
    setClubFilter("all");
    setTierFilter("all");
    setHideCompleted(defaultHideCompleted);
    setQuery("");
    setCatalogueLimit(defaultCatalogueLimit);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setCatalogueLimit(defaultCatalogueLimit);
  }

  function updateTypeFilter(value: string) {
    setTypeFilter(value);
    setCatalogueLimit(defaultCatalogueLimit);
  }

  function updateClubFilter(value: string) {
    setClubFilter(value);
    setCatalogueLimit(defaultCatalogueLimit);
  }

  function updateTierFilter(value: string) {
    setTierFilter(value);
    setCatalogueLimit(defaultCatalogueLimit);
  }

  function toggleHideCompleted() {
    setHideCompleted((current) => !current);
    setCatalogueLimit(defaultCatalogueLimit);
  }

  function showUnlockedAchievements() {
    setHideCompleted(false);
    setStatusFilter("unlocked");
    setCatalogueLimit(defaultCatalogueLimit);
  }

  function showAllAchievements() {
    setHideCompleted(false);
    setStatusFilter("all");
    setCatalogueLimit(defaultCatalogueLimit);
  }

  return (
    <div className="space-y-5">
      <MobileAchievementTabs tab={mobileTab} onTabChange={setMobileTab} />

      <section className={mobileTab === "next" ? "space-y-4" : "hidden sm:block"}>
        <NextUnlockCard
          achievement={nextUnlock}
          totalXp={data.totalXp}
          unlockedCount={data.unlockedCount}
          totalCount={data.totalCount}
        />
      </section>

      <Card className={cn("premium-card", mobileTab === "cabinet" ? "flex" : "hidden sm:flex")}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Trophy cabinet</CardTitle>
              <CardDescription>
                Unlocked achievement tiers from launch monitor and round data.
              </CardDescription>
            </div>
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <Trophy className="size-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <div className="grid sm:grid-cols-2 lg:grid-cols-5">
              {trophyCabinet.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setTierFilter(tier.id)}
                  className={cn(
                    "min-w-0 border-b border-slate-200/70 px-3 py-2.5 text-left transition-colors hover:bg-amber-50/70 sm:border-r",
                    tierFilter === tier.id && "bg-amber-50/80 ring-2 ring-zinc-900/10",
                  )}
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <Badge className={cn("border", tierStyles[tier.id])}>{tier.label}</Badge>
                    <span className="text-xs text-muted-foreground">{tier.completion}%</span>
                  </div>
                  <p className="mt-1 text-base font-semibold tracking-normal">
                    {tier.unlocked.toLocaleString("en-GB")}
                    <span className="text-sm font-medium text-muted-foreground">
                      /{tier.total.toLocaleString("en-GB")}
                    </span>
                  </p>
                  <Progress value={tier.completion} className="mt-2 h-1.5" />
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <section
        className={cn(
          "grid gap-4 lg:grid-cols-[0.85fr_1.15fr]",
          mobileTab === "next" ? "grid" : "hidden sm:grid",
        )}
      >
        <Card
          data-mobile-preserve-dark
          className="border border-zinc-800 bg-[#111827] text-white shadow-[0_18px_44px_rgba(7,17,11,0.18)]"
          style={{
            background:
              "linear-gradient(135deg, rgba(52, 211, 153, 0.14), transparent 42%), #111827",
            boxShadow: "0 18px 44px rgba(7, 17, 11, 0.18)",
          }}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardDescription className="text-zinc-300">Player level</CardDescription>
                <CardTitle className="mt-1 text-3xl font-semibold tracking-normal sm:mt-2 sm:text-5xl">
                  Level {data.level.level}
                </CardTitle>
              </div>
              <div className="grid size-10 place-items-center rounded-lg bg-white/10 sm:size-12">
                <Zap className="size-5 text-emerald-300 sm:size-6" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Metric label="Total XP" value={data.totalXp.toLocaleString("en-GB")} dark />
              <Metric label="Unlocked" value={`${data.unlockedCount}/${data.totalCount}`} dark />
              <Metric
                label="Next level"
                value={`${data.level.progressXp}/${data.level.neededXp}`}
                dark
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-zinc-300">
                <span>XP to level {data.level.level + 1}</span>
                <span>{data.level.progressPercent}%</span>
              </div>
              <Progress
                value={data.level.progressPercent}
                className="bg-white/15 [&_[data-slot=progress-indicator]]:bg-emerald-300"
              />
            </div>
            {data.needsSync || isPending ? (
              <p className="text-sm text-zinc-300">
                {isPending
                  ? "Syncing historical rounds and provider sessions…"
                  : "Achievement sync queued."}
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
            <div
              aria-label="Latest achievements gained list"
              className="max-h-[22rem] space-y-3 overflow-y-auto pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={0}
            >
              {data.recentUnlocks.map((achievement) => (
                <RecentUnlock key={achievement.id} achievement={achievement} />
              ))}
            </div>
            {data.recentUnlocks.length === 0 ? (
              <div className="apple-panel p-4 text-sm text-muted-foreground">
                Import provider sessions or complete round scorecards to start unlocking.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="hidden sm:block">
        <AchievementUnlockLedger achievements={unlockLedger} />
      </section>

      <section
        className={cn(
          "grid gap-3 md:grid-cols-4",
          mobileTab === "next" ? "grid" : "hidden sm:grid",
        )}
      >
        <Metric label="Catalog" value={data.totalCount.toLocaleString("en-GB")} />
        <Metric label="Provider + round" value="Enabled" />
        <Metric
          label="Hidden found"
          value={data.achievements
            .filter((achievement) => achievement.hidden && achievement.unlocked)
            .length.toString()}
        />
        <Metric
          label="Completion"
          value={`${Math.round((data.unlockedCount / Math.max(1, data.totalCount)) * 100)}%`}
        />
      </section>

      <div className={mobileTab === "calendar" ? "block" : "hidden sm:block"}>
        <AchievementUnlockCalendar
          calendar={unlockCalendar}
          monthKey={calendarMonth}
          selectedDay={effectiveCalendarDay}
          onMonthChange={setCalendarMonth}
          onSelectedDayChange={setSelectedCalendarDay}
        />
      </div>

      <Card className={cn("premium-card", mobileTab === "catalogue" ? "flex" : "hidden sm:flex")}>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Achievement catalog</CardTitle>
              <CardDescription>
                Major badges plus generated club metric ladders from launch monitor and round data.
              </CardDescription>
            </div>
          </div>
          <div className="sm:hidden">
            <MobileFilterSheet label="Filter catalogue" activeCount={isFiltered ? 1 : 0}>
              <div className="grid gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => updateQuery(event.target.value)}
                    placeholder="Search achievements"
                    className="pl-9"
                  />
                </div>
                <AchievementSelect
                  label="Achievement type"
                  value={typeFilter}
                  onValueChange={updateTypeFilter}
                  options={typeOptions}
                  allLabel="All types"
                />
                <AchievementSelect
                  label="Club"
                  value={clubFilter}
                  onValueChange={updateClubFilter}
                  options={clubOptions}
                  allLabel="All clubs"
                />
                <AchievementSelect
                  label="Tier"
                  value={tierFilter}
                  onValueChange={updateTierFilter}
                  options={tierOptions}
                  allLabel="All tiers"
                />
                <Button
                  type="button"
                  variant={hideCompleted ? "default" : "outline"}
                  className="h-10 justify-center rounded-lg"
                  onClick={toggleHideCompleted}
                >
                  <EyeOff className="size-4" />
                  Hide completed
                </Button>
              </div>
            </MobileFilterSheet>
          </div>
          <div className="hidden gap-3 sm:grid lg:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(145px,190px)_minmax(145px,190px)_minmax(145px,190px)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Search achievements"
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={updateTypeFilter}>
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
            <Select value={clubFilter} onValueChange={updateClubFilter}>
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
            <Select value={tierFilter} onValueChange={updateTierFilter}>
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
              onClick={toggleHideCompleted}
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
              onClick={showUnlockedAchievements}
            >
              Unlocked
              <span className="ml-1 text-xs opacity-70">
                {data.unlockedCount}/{data.unlockedCount}
              </span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!hideCompleted && statusFilter === "all" ? "default" : "outline"}
              onClick={showAllAchievements}
            >
              All
              <span className="ml-1 text-xs opacity-70">
                {data.unlockedCount}/{data.totalCount}
              </span>
            </Button>
            {isFiltered ? (
              <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                <RotateCcw className="size-4" />
                Reset
              </Button>
            ) : null}
            <span className="text-sm text-muted-foreground">
              Showing {shownAchievements.length.toLocaleString("en-GB")} of{" "}
              {filteredAchievements.length.toLocaleString("en-GB")}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {remainingFilteredAchievementCount > 0 ? (
            <div className="apple-panel mb-4 px-3 py-2 text-sm text-muted-foreground">
              Showing {shownAchievements.length.toLocaleString("en-GB")} of{" "}
              {filteredAchievements.length.toLocaleString("en-GB")} matching achievements.
            </div>
          ) : null}

          <div className="grid gap-3 sm:hidden">
            {mobileShownAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                focused={achievement.id === focusedAchievementId}
              />
            ))}
          </div>
          <div className="hidden gap-3 sm:grid md:grid-cols-2 xl:grid-cols-3">
            {shownAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                focused={achievement.id === focusedAchievementId}
              />
            ))}
          </div>

          {shownAchievements.length > mobileShownAchievements.length ? (
            <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground sm:hidden">
              Showing 12 first. Use filters to narrow the catalogue.
            </p>
          ) : null}

          {remainingFilteredAchievementCount > 0 ? (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {remainingFilteredAchievementCount.toLocaleString("en-GB")} more achievement
                {remainingFilteredAchievementCount === 1 ? "" : "s"} available.
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCatalogueLimit((current) =>
                      Math.min(filteredAchievements.length, current + cataloguePageSize),
                    )
                  }
                >
                  Show {Math.min(cataloguePageSize, remainingFilteredAchievementCount)} more
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setCatalogueLimit(filteredAchievements.length)}
                >
                  Show all
                </Button>
              </div>
            </div>
          ) : null}

          {shownAchievements.length === 0 ? (
            <EmptyState title="No achievements match this filter" />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function AchievementUnlockLedger({ achievements }: { achievements: AchievementView[] }) {
  const [visibleCount, setVisibleCount] = useState(defaultUnlockLedgerLimit);
  const visibleAchievements = achievements.slice(0, visibleCount);
  const remainingCount = Math.max(0, achievements.length - visibleAchievements.length);
  const resultLabel = `${visibleAchievements.length.toLocaleString("en-GB")} of ${achievements.length.toLocaleString("en-GB")} unlocks`;

  return (
    <Card className="premium-card overflow-hidden">
      <Accordion type="single" collapsible>
        <AccordionItem value="achievement-ledger" className="border-0">
          <AccordionTrigger className="px-4 py-3 text-left no-underline hover:no-underline sm:px-5">
            <span className="grid min-w-0 gap-1">
              <span className="text-sm font-semibold tracking-normal text-slate-950">
                XP unlock ledger
              </span>
              <span className="text-sm font-normal leading-5 text-muted-foreground">
                Recent unlocked badges, XP, category and source evidence.
              </span>
            </span>
            <Badge variant="outline" className="ml-auto shrink-0">
              {achievements.length.toLocaleString("en-GB")} unlocks
            </Badge>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/70 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <div className="space-y-3">
              <DesktopTableWorkbenchControls
                viewKey="achievement-unlocks"
                scope="achievements"
                currentViewLabel="Achievement unlock history"
                resultLabel={resultLabel}
                columns={achievementUnlockColumns}
                exportTableId="achievement-unlocks"
                exportFileName="forekinghell-achievement-unlocks.csv"
              />
              {achievements.length === 0 ? (
                <div className="apple-panel p-4 text-sm text-muted-foreground">
                  Import provider sessions or complete round scorecards to start the XP ledger.
                </div>
              ) : (
                <DataTableFrame
                  mainTable
                  mainTableLabel="Achievement unlock ledger table"
                  stickyFirstColumn
                >
                  <Table
                    className="min-w-[880px]"
                    data-workbench-scope="achievements"
                    data-workbench-export-table="achievement-unlocks"
                    aria-describedby="achievement-unlock-ledger-summary"
                  >
                    <TableCaption id="achievement-unlock-ledger-summary" className="sr-only">
                      Achievement unlock ledger with achievement name, unlock date, tier, XP
                      awarded, category, source evidence and action.
                    </TableCaption>
                    <TableHeader className="sticky top-0 z-10 bg-white">
                      <TableRow>
                        <TableHead
                          data-column="achievement"
                          className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                        >
                          Achievement
                        </TableHead>
                        <TableHead data-column="unlocked">Unlocked</TableHead>
                        <TableHead data-column="tier">Tier</TableHead>
                        <TableHead data-column="xp" className="text-right">
                          XP
                        </TableHead>
                        <TableHead data-column="category">Category</TableHead>
                        <TableHead data-column="source">Source</TableHead>
                        <TableHead data-column="action" className="text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleAchievements.map((achievement) => (
                        <TableRow
                          key={achievement.id}
                          tabIndex={0}
                          className="focus-aaa outline-none"
                        >
                          <TableCell
                            data-column="achievement"
                            className="sticky left-0 z-10 max-w-[18rem] bg-white font-medium text-slate-950 shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                          >
                            <span className="block truncate">{achievement.displayName}</span>
                          </TableCell>
                          <TableCell data-column="unlocked">
                            {formatUnlockDate(achievement.unlockedAt)}
                          </TableCell>
                          <TableCell data-column="tier">{tierLabels[achievement.tier]}</TableCell>
                          <TableCell data-column="xp" className="text-right tabular-nums">
                            {achievement.xpAwarded.toLocaleString("en-GB")}
                          </TableCell>
                          <TableCell data-column="category">
                            {categoryLabels[achievement.category] ?? achievement.category}
                          </TableCell>
                          <TableCell data-column="source">
                            {achievement.source
                              ? sourceLabel(achievement.source.kind)
                              : "Older unlock"}
                          </TableCell>
                          <TableCell data-column="action" className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <Link
                                href={
                                  achievement.source?.href ?? `#${achievementDomId(achievement.id)}`
                                }
                                prefetch={false}
                              >
                                {achievement.source?.href ? "Open source" : "Open badge"}
                                <ExternalLink className="size-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DataTableFrame>
              )}
              {remainingCount > 0 ? (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {remainingCount.toLocaleString("en-GB")} older unlock
                    {remainingCount === 1 ? "" : "s"} available.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setVisibleCount((current) =>
                          Math.min(achievements.length, current + unlockLedgerPageSize),
                        )
                      }
                    >
                      Show {Math.min(unlockLedgerPageSize, remainingCount)} more
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setVisibleCount(achievements.length)}
                    >
                      Show all
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
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
  const selectedXp = selectedAchievements.reduce(
    (total, achievement) => total + achievement.xpAwarded,
    0,
  );
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
              className="pb-2 text-center text-[11px] font-medium uppercase tracking-normal text-slate-700"
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
                    !cell.isCurrentMonth &&
                      !cell.isSelected &&
                      "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100",
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
                        cell.isSelected ? "bg-white text-zinc-900" : "bg-emerald-800 text-white",
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
              <div
                aria-label="Selected calendar day achievements"
                className="space-y-2 overflow-y-auto pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ maxHeight: "28rem" }}
                tabIndex={0}
              >
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

function MobileAchievementTabs({
  tab,
  onTabChange,
}: {
  tab: MobileAchievementTab;
  onTabChange: (tab: MobileAchievementTab) => void;
}) {
  return (
    <nav
      aria-label="Achievement views"
      className="sticky top-[4.75rem] z-30 -mx-1 flex gap-2 overflow-x-auto px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
      tabIndex={0}
    >
      {mobileAchievementTabs.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onTabChange(item.id)}
          className={cn(
            "min-h-10 shrink-0 rounded-full border px-3 py-2 text-sm font-medium shadow-sm",
            item.id === tab
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white/90 text-slate-700",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function NextUnlockCard({
  achievement,
  totalXp,
  unlockedCount,
  totalCount,
}: {
  achievement: AchievementView | null;
  totalXp: number;
  unlockedCount: number;
  totalCount: number;
}) {
  return (
    <Card className="premium-card sm:hidden">
      <CardHeader>
        <CardDescription>Next unlock</CardDescription>
        <CardTitle className="text-2xl tracking-normal">
          {achievement ? achievement.displayName : "Start earning XP"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {achievement ? (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              {achievement.displayDescription}
            </p>
            {achievement.progressPercent !== null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{achievement.progressLabel ?? "Progress"}</span>
                  <span>{achievement.progressPercent}%</span>
                </div>
                <Progress value={achievement.progressPercent} />
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Import sessions or save rounds to unlock the first badges.
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Metric label="XP" value={totalXp.toLocaleString("en-GB")} />
          <Metric label="Unlocked" value={`${unlockedCount}/${totalCount}`} />
          <Metric label="Reward" value={achievement ? `${achievement.xp} XP` : "--"} />
        </div>
        <Button
          asChild
          className="w-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          data-primary-action
        >
          <Link href={achievement ? "/today" : "/import"} prefetch={false}>
            {achievement ? "Open today's practice" : "Import data"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function AchievementSelect({
  label,
  value,
  onValueChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ id: string; label: string; total: number; unlocked: number }>;
  allLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 w-full rounded-lg" aria-label={label}>
        <span className="truncate">
          {value === "all"
            ? allLabel
            : (options.find((item) => item.id === value)?.label ?? allLabel)}
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="z-[80]">
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.label} ({item.unlocked}/{item.total})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CalendarUnlockItem({ achievement }: { achievement: AchievementView }) {
  return (
    <div className="apple-panel-strong p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-5">{achievement.displayName}</p>
            <Badge className={cn("border", tierStyles[achievement.tier])}>
              {tierLabels[achievement.tier]}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {achievement.displayDescription}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-emerald-800">
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
            <Badge className={cn("border", tierStyles[achievement.tier])}>
              {tierLabels[achievement.tier]}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {achievement.displayDescription}
          </p>
        </div>
        <div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right">
          <div className="flex items-center gap-1 sm:justify-end">
            <CalendarDays className="size-3.5" />
            <span>{formatUnlockDate(achievement.unlockedAt)}</span>
          </div>
          <p className="mt-1 font-medium text-foreground">
            {achievement.xpAwarded.toLocaleString("en-GB")} XP
          </p>
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
    <Dialog>
      <DialogTrigger asChild>
        <Card
          id={achievementDomId(achievement.id)}
          role="button"
          tabIndex={0}
          className={cn(
            "apple-panel-strong flex min-h-40 cursor-pointer flex-col justify-between p-4 text-left transition hover:border-emerald-300",
            achievement.unlocked ? "border-emerald-300" : "border-border",
            focused && "ring-2 ring-emerald-500/40",
          )}
        >
          <AchievementCardBody achievement={achievement} />
        </Card>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{achievement.displayName}</DialogTitle>
          <DialogDescription>{achievement.displayDescription}</DialogDescription>
        </DialogHeader>
        <AchievementCardBody achievement={achievement} />
      </DialogContent>
    </Dialog>
  );
}

function AchievementCardBody({ achievement }: { achievement: AchievementView }) {
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <AchievementBadgeIcon achievement={achievement} />
          <Badge className={cn("border", tierStyles[achievement.tier])}>
            {tierLabels[achievement.tier]}
          </Badge>
        </div>
        <div>
          <p className="text-base font-semibold leading-6">{achievement.displayName}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {achievement.displayDescription}
          </p>
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
              <span>{achievement.progressLabel ?? "Next unlock"}</span>
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
    </>
  );
}

function AchievementBadgeIcon({ achievement }: { achievement: AchievementView }) {
  const locked = achievement.hidden && !achievement.unlocked;
  const color =
    achievement.tier === "diamond"
      ? "#4f46e5"
      : achievement.tier === "platinum"
        ? "#0891b2"
        : achievement.tier === "gold"
          ? "#d97706"
          : achievement.tier === "silver"
            ? "#64748b"
            : "#b45309";

  return (
    <div
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-xl border border-white/80 bg-white shadow-sm",
        achievement.unlocked ? "ring-2 ring-emerald-100" : "opacity-85",
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="size-10">
        <path
          d="M32 5 L51 15 V30 C51 44 42 55 32 59 C22 55 13 44 13 30 V15 Z"
          fill={locked ? "#e5e7eb" : color}
          opacity={achievement.unlocked ? "0.92" : "0.72"}
        />
        <circle cx="32" cy="31" r="12" fill="white" opacity="0.86" />
        {locked ? (
          <Lock x="25" y="24" width="14" height="14" color="#71717a" />
        ) : achievement.unlocked ? (
          <CheckCircle2 x="23" y="22" width="18" height="18" color={color} />
        ) : (
          <Award x="23" y="22" width="18" height="18" color={color} />
        )}
      </svg>
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

  if (kind === "speed") {
    return "Speed session";
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
    <div
      className={cn(
        "min-w-0 rounded-lg border p-2 sm:p-3",
        dark ? "border-white/10 bg-white/5" : "bg-white/80",
      )}
    >
      <p
        className={cn(
          "truncate text-xs font-medium",
          dark ? "text-zinc-300" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="mt-1 flex min-w-0 items-center gap-2 text-xl font-semibold tracking-normal sm:text-2xl">
        {label === "Catalog" ? <Trophy className="size-5 text-amber-500" /> : null}
        <span className="min-w-0 truncate">{value}</span>
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
