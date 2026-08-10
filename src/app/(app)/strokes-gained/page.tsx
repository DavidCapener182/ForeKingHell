import Link from "next/link";
import Image from "next/image";
import { and, asc, desc, eq, gt, gte, isNull, lt, lte, type SQL } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Equal,
  Flag,
  ListFilter,
  Sigma,
  Sprout,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  ActiveFilterChips,
  DataPanel,
  DataPair,
  DataTableFrame,
  MobileDataList,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileRouteTabs } from "@/components/mobile-sports";
import { PageArtwork } from "@/components/visuals/page-artwork";
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
import {
  DesktopInsightRail,
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  commonAiPrompts,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import { sessions, strokesGainedShotEvents } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  DEFAULT_STROKES_GAINED_BASELINE_BUCKETS,
  summarizeStrokesGained,
} from "@/lib/strokes-gained";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
type StrokesGainedEvent = Awaited<ReturnType<typeof getStrokesGainedData>>["events"][number];
type SortMode = "recent" | "gains" | "losses" | "hole" | "category";
type SgResultFilter = "" | "gain" | "loss" | "pending";

type StrokesGainedFilters = {
  sessionId: string;
  category: string;
  hole: string;
  startLie: string;
  endLie: string;
  from: string;
  to: string;
  sg: SgResultFilter;
  sort: SortMode;
};

type CategorySummary = {
  category: string;
  label: string;
  coachingLabel: string;
  eventCount: number;
  sampleSize: number;
  pendingCount: number;
  total: number | null;
  average: number | null;
};

type RoundSummary = {
  sessionId: string;
  courseName: string | null;
  sessionDate: Date;
  eventCount: number;
  total: number | null;
  average: number | null;
  sampleSize: number;
  categoryTotals: CategorySummary[];
};

type HoleSummary = {
  holeNumber: number;
  eventCount: number;
  total: number | null;
  average: number | null;
  sampleSize: number;
  pendingCount: number;
  gainCount: number;
  lossCount: number;
  swing: number;
};

const ANALYSIS_LIMIT = 200;
const CATEGORY_DEFINITIONS = [
  { category: "tee", label: "Tee", coachingLabel: "Tee shots" },
  { category: "approach", label: "Approach", coachingLabel: "Approach play" },
  { category: "short_game", label: "Short game", coachingLabel: "Short game" },
  { category: "putting", label: "Putting", coachingLabel: "Putting" },
] as const;
const SORT_MODES: SortMode[] = ["recent", "gains", "losses", "hole", "category"];
const SG_RESULT_FILTERS: SgResultFilter[] = ["", "gain", "loss", "pending"];
const LIE_ORDER = ["tee", "fairway", "rough", "green", "holed"];

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const signedSgFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const integerFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const strokesGainedWorkbenchPrompts = [
  {
    label: "Explain scoring leaks",
    prompt:
      "Explain my ForeKingHell strokes-gained page using only the visible category, round, hole and event-table evidence. Do not invent missing numbers.",
    icon: Sigma,
  },
  {
    label: "What cost strokes?",
    prompt:
      "Identify what cost strokes from the visible strokes-gained evidence. Cite phase, hole and shot-event examples where available.",
    icon: TrendingDown,
  },
  {
    label: "Build phase practice plan",
    prompt:
      "Build a practice plan from the visible strokes-gained leak. Keep it golfer-facing and mark any low-confidence recommendation.",
    icon: Target,
  },
  {
    label: "Save this insight",
    prompt:
      "Save the clearest strokes-gained insight with cited visible evidence, confidence, and the next action.",
    icon: ListFilter,
  },
  ...commonAiPrompts("strokes-gained board").slice(3, 4),
];
const strokesGainedEventColumns: DesktopWorkbenchColumn[] = [
  { id: "round", label: "Round", locked: true },
  { id: "hole", label: "Hole" },
  { id: "category", label: "Category" },
  { id: "from", label: "From" },
  { id: "to", label: "To" },
  { id: "distance", label: "Distance" },
  { id: "expected-before", label: "Expected before" },
  { id: "expected-after", label: "Expected after" },
  { id: "sg", label: "SG" },
  { id: "status", label: "Status", locked: true },
];
const strokesGainedSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Biggest scoring leaks",
    href: "/strokes-gained?sg=loss&sort=losses#events",
    detail: "Losing events first, ready for coach review.",
  },
  {
    title: "Tee-shot value",
    href: "/strokes-gained?category=tee#events",
    detail: "Driver and tee-shot events only.",
  },
  {
    title: "Pending calculations",
    href: "/strokes-gained?sg=pending#events",
    detail: "Events that still need deterministic expected-strokes data.",
  },
];

export default async function StrokesGainedPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseFilters(await searchParams);
  const data = await getStrokesGainedData(filters);
  const analysis = buildStrokesGainedAnalysis(data.events);
  const activeCategory =
    analysis.categories.find((category) => category.category === filters.category) ?? null;
  const scopedEvents = activeCategory
    ? data.events.filter((event) => event.category === activeCategory.category)
    : data.events;
  const scopedRounds = buildRoundSummaries(scopedEvents);
  const scopedHoles = buildHoleSummaries(scopedEvents);
  const scopedFiniteEvents = scopedEvents.filter(
    (event) => typeof event.strokesGained === "number",
  );
  const scopedGains = [...scopedFiniteEvents]
    .sort((a, b) => (b.strokesGained ?? 0) - (a.strokesGained ?? 0))
    .slice(0, 3);
  const scopedLosses = [...scopedFiniteEvents]
    .sort((a, b) => (a.strokesGained ?? 0) - (b.strokesGained ?? 0))
    .slice(0, 3);
  const filteredEvents = filterEvents(data.events, filters);
  const filterOptions = buildFilterOptions(data.events);
  const activeFilterChips = buildActiveFilterChips(filters, filterOptions.sessions);
  const railFocus = activeCategory ?? analysis.weakestCategory ?? analysis.bestCategory;
  const railSampleSize = activeCategory?.sampleSize ?? analysis.totals.sampleSize;
  const railPendingCount = activeCategory?.pendingCount ?? analysis.pendingCount;
  const railEventCount = activeCategory?.eventCount ?? data.events.length;
  const railTotal = activeCategory?.total ?? analysis.totals.total;

  return (
    <PageShell>
      <div className="lg:hidden">
        <MobileRouteTabs group="dashboard" activeKey="strokes" sticky={false} />
      </div>

      <DesktopWorkbenchLayout
        scope="strokes-gained"
        rail={
          <DesktopInsightRail
            title="AI strokes-gained rail"
            description="Phase leaks, calculated sample and shot-event evidence stay visible while reviewing the board."
            metrics={[
              {
                label: "Current view",
                value: activeCategory ? activeCategory.label : "All phases",
                detail: activeCategory
                  ? `${activeCategory.label} is filtered across ${integerFormatter.format(activeCategory.eventCount)} mapped events.`
                  : "Tee, approach, short game and putting are shown together.",
                tone: activeCategory ? toneForSg(activeCategory.total) : "sky",
              },
              {
                label: "Total SG",
                value: formatSg(railTotal, "No data"),
                detail: `Across ${integerFormatter.format(railSampleSize)} calculated events.`,
                tone: toneForSg(railTotal),
              },
              {
                label: "Coverage",
                value: coveragePercentLabel(railSampleSize, railEventCount),
                detail: `${integerFormatter.format(railPendingCount)} pending or unmapped events need deterministic expected-strokes data.`,
                tone: railPendingCount > 0 ? "amber" : "green",
              },
              {
                label: activeCategory ? "Active phase" : "Main leak",
                value: railFocus ? railFocus.label : "No data",
                detail: railFocus
                  ? `${formatSg(railFocus.total, "No data")} from ${integerFormatter.format(railFocus.sampleSize)} calculated events.`
                  : "Map shot-to-hole rounds before asking AI for a diagnosis.",
                tone: toneForSg(railFocus?.total ?? null),
              },
            ]}
            evidence={[
              `${integerFormatter.format(railSampleSize)} calculated events from ${integerFormatter.format(railEventCount)} mapped shot events.`,
              analysis.bestCategory
                ? `${analysis.bestCategory.label} is the best phase at ${formatSg(analysis.bestCategory.total, "No data")}.`
                : "No best phase is available yet.",
              analysis.weakestCategory
                ? `${analysis.weakestCategory.label} is the weakest phase at ${formatSg(analysis.weakestCategory.total, "No data")}.`
                : "No weakest phase is available yet.",
              `${integerFormatter.format(analysis.pendingCount)} events are pending or unmapped before AI analysis.`,
            ]}
            prompts={strokesGainedWorkbenchPrompts}
            actions={[
              {
                label: "Round history",
                href: "/rounds",
                detail: "Open scorecards behind the strokes-gained sample.",
                icon: Flag,
              },
              {
                label: "Coach desk",
                href: "/coach",
                detail: "Turn the leak into a practice diagnosis.",
                icon: Brain,
              },
              {
                label: "Data Chat",
                href: "/data-chat",
                detail: "Ask for a cited explanation.",
                icon: Sigma,
              },
            ]}
          />
        }
      >
        <div className="hidden items-center justify-between gap-4 lg:flex">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard" prefetch={false}>
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/coach" prefetch={false}>
              <Brain className="size-4" />
              Coach
            </Link>
          </Button>
        </div>

        <PageHeader
          eyebrow={<StatusPill tone="sky">Expected-strokes baseline</StatusPill>}
          title={activeCategory ? `${activeCategory.label} strokes gained` : "Strokes gained"}
          description={
            <>
              <span className="lg:hidden">{mobileHeroDescription(analysis, activeCategory)}</span>
              <span className="hidden lg:inline">{heroDescription(analysis, activeCategory)}</span>
            </>
          }
          metrics={heroMetrics(analysis, data.events.length, activeCategory)}
          visual={
            <PageArtwork
              variant="strokesGained"
              alt=""
              className="h-full min-h-44 w-full aspect-auto"
              imageClassName="scale-[1.05] object-[52%_62%] opacity-90 saturate-[1.04]"
              priority
            />
          }
        />

        <div className="grid min-w-0 gap-4 lg:hidden">
          <MobileScoringDiagnosis
            analysis={analysis}
            activeCategory={activeCategory}
            totalEvents={data.events.length}
          />

          <CalculationCoverageStrip analysis={analysis} totalEvents={data.events.length} />

          <CategoryNavTabs categories={analysis.categories} activeCategory={activeCategory} />

          <PracticeThisFirstCard summary={activeCategory ?? analysis.weakestCategory} />

          <MobileCategorySummary
            categories={analysis.categories}
            activeCategory={activeCategory}
            bestCategory={analysis.bestCategory}
            weakestCategory={analysis.weakestCategory}
          />

          <MobileStrokesGainedDisclosures
            analysis={analysis}
            activeCategory={activeCategory}
            gains={activeCategory ? scopedGains : analysis.biggestGains}
            losses={activeCategory ? scopedLosses : analysis.biggestLosses}
            rounds={activeCategory ? scopedRounds : analysis.rounds}
            holes={activeCategory ? scopedHoles : analysis.holes}
          />
        </div>

        <div className="hidden lg:contents">
          <CalculationCoverageStrip analysis={analysis} totalEvents={data.events.length} />

          <CategoryNavTabs categories={analysis.categories} activeCategory={activeCategory} />

          <CategoryCards
            categories={analysis.categories}
            activeCategory={activeCategory}
            bestCategory={analysis.bestCategory}
            weakestCategory={analysis.weakestCategory}
          />

          <CategoryBreakdown
            categories={analysis.categories}
            total={analysis.totals.total}
            categoryTotal={analysis.categoryTotal}
            pendingCount={analysis.pendingCount}
          />

          <GainLossWaterfall categories={analysis.categories} />

          <PracticeThisFirstCard summary={activeCategory ?? analysis.weakestCategory} />

          <MainScoringLeak
            summary={activeCategory ?? analysis.weakestCategory}
            events={data.events}
            focusCategory={activeCategory}
          />

          <ShotHighlights
            gains={activeCategory ? scopedGains : analysis.biggestGains}
            losses={activeCategory ? scopedLosses : analysis.biggestLosses}
            focusCategory={activeCategory}
          />

          <RoundTrendPanel
            rounds={activeCategory ? scopedRounds : analysis.rounds}
            bestCategory={analysis.bestCategory}
            weakestCategory={analysis.weakestCategory}
            focusCategory={activeCategory}
          />

          <HoleImpactPanel
            holes={activeCategory ? scopedHoles : analysis.holes}
            focusCategory={activeCategory}
          />
        </div>

        <RecentShotEventsPanel
          events={filteredEvents}
          totalEvents={data.events.length}
          filters={filters}
          filterOptions={filterOptions}
          activeFilterChips={activeFilterChips}
        />
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

async function getStrokesGainedData(filters: StrokesGainedFilters) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const conditions: SQL[] = [eq(strokesGainedShotEvents.userId, userId)];

  if (filters.sessionId) conditions.push(eq(strokesGainedShotEvents.sessionId, filters.sessionId));
  if (filters.category) conditions.push(eq(strokesGainedShotEvents.category, filters.category));
  if (filters.hole) conditions.push(eq(strokesGainedShotEvents.holeNumber, Number(filters.hole)));
  if (filters.startLie) conditions.push(eq(strokesGainedShotEvents.startLie, filters.startLie));
  if (filters.endLie) conditions.push(eq(strokesGainedShotEvents.endLie, filters.endLie));
  if (filters.from) conditions.push(gte(sessions.date, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters.to) conditions.push(lte(sessions.date, new Date(`${filters.to}T23:59:59.999Z`)));
  if (filters.sg === "gain") conditions.push(gt(strokesGainedShotEvents.strokesGained, 0));
  if (filters.sg === "loss") conditions.push(lt(strokesGainedShotEvents.strokesGained, 0));
  if (filters.sg === "pending") conditions.push(isNull(strokesGainedShotEvents.strokesGained));

  const orderBy =
    filters.sort === "gains"
      ? [desc(strokesGainedShotEvents.strokesGained), desc(strokesGainedShotEvents.createdAt)]
      : filters.sort === "losses"
        ? [asc(strokesGainedShotEvents.strokesGained), desc(strokesGainedShotEvents.createdAt)]
        : filters.sort === "hole"
          ? [
              asc(strokesGainedShotEvents.holeNumber),
              asc(strokesGainedShotEvents.strokeNumber),
              desc(strokesGainedShotEvents.createdAt),
            ]
          : filters.sort === "category"
            ? [asc(strokesGainedShotEvents.category), asc(strokesGainedShotEvents.strokesGained)]
            : [desc(strokesGainedShotEvents.createdAt)];
  const events = await db
    .select({
      id: strokesGainedShotEvents.id,
      sessionId: strokesGainedShotEvents.sessionId,
      courseName: sessions.courseName,
      sessionDate: sessions.date,
      holeNumber: strokesGainedShotEvents.holeNumber,
      strokeNumber: strokesGainedShotEvents.strokeNumber,
      category: strokesGainedShotEvents.category,
      startLie: strokesGainedShotEvents.startLie,
      endLie: strokesGainedShotEvents.endLie,
      startDistanceYd: strokesGainedShotEvents.startDistanceYd,
      endDistanceYd: strokesGainedShotEvents.endDistanceYd,
      penaltyStrokes: strokesGainedShotEvents.penaltyStrokes,
      strokesGained: strokesGainedShotEvents.strokesGained,
      createdAt: strokesGainedShotEvents.createdAt,
    })
    .from(strokesGainedShotEvents)
    .innerJoin(sessions, eq(sessions.id, strokesGainedShotEvents.sessionId))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(ANALYSIS_LIMIT);

  return { events };
}

function buildStrokesGainedAnalysis(events: StrokesGainedEvent[]) {
  const totals = summarizeStrokesGained(events.map((event) => event.strokesGained));
  const categories = buildCategorySummaries(events);
  const calculatedCategories = categories.filter((category) => category.sampleSize > 0);
  const bestCategory = [...calculatedCategories].sort(descendingTotal)[0] ?? null;
  const weakestCategory = [...calculatedCategories].sort(ascendingTotal)[0] ?? null;
  const finiteEvents = events.filter((event) => typeof event.strokesGained === "number");
  const categoryTotal = roundOne(
    categories.reduce((sum, category) => sum + (category.total ?? 0), 0),
  );

  return {
    totals,
    categories,
    categoryTotal,
    pendingCount: Math.max(0, events.length - totals.sampleSize),
    bestCategory,
    weakestCategory,
    rounds: buildRoundSummaries(events),
    holes: buildHoleSummaries(events),
    biggestGains: [...finiteEvents]
      .sort((a, b) => (b.strokesGained ?? 0) - (a.strokesGained ?? 0))
      .slice(0, 3),
    biggestLosses: [...finiteEvents]
      .sort((a, b) => (a.strokesGained ?? 0) - (b.strokesGained ?? 0))
      .slice(0, 3),
  };
}

function buildCategorySummaries(events: StrokesGainedEvent[]) {
  const categoryDefinitions = [...CATEGORY_DEFINITIONS];
  const knownCategorySet = new Set<string>(
    categoryDefinitions.map((definition) => definition.category),
  );
  const extraCategories = [...new Set(events.map((event) => event.category))]
    .filter((category) => !knownCategorySet.has(category))
    .sort()
    .map((category) => ({
      category,
      label: titleCase(category),
      coachingLabel: titleCase(category),
    }));

  return [...categoryDefinitions, ...extraCategories].map((definition) => {
    const categoryEvents = events.filter((event) => event.category === definition.category);
    const summary = summarizeStrokesGained(categoryEvents.map((event) => event.strokesGained));

    return {
      ...definition,
      eventCount: categoryEvents.length,
      sampleSize: summary.sampleSize,
      pendingCount: Math.max(0, categoryEvents.length - summary.sampleSize),
      total: summary.total,
      average: summary.average,
    };
  });
}

function buildRoundSummaries(events: StrokesGainedEvent[]) {
  const grouped = new Map<string, StrokesGainedEvent[]>();

  for (const event of events) {
    grouped.set(event.sessionId, [...(grouped.get(event.sessionId) ?? []), event]);
  }

  return [...grouped.entries()]
    .map(([sessionId, roundEvents]) => {
      const firstEvent = roundEvents[0];
      const summary = summarizeStrokesGained(roundEvents.map((event) => event.strokesGained));

      return {
        sessionId,
        courseName: firstEvent?.courseName ?? null,
        sessionDate: firstEvent?.sessionDate ?? new Date(0),
        eventCount: roundEvents.length,
        total: summary.total,
        average: summary.average,
        sampleSize: summary.sampleSize,
        categoryTotals: buildCategorySummaries(roundEvents).filter((category) =>
          CATEGORY_DEFINITIONS.some((definition) => definition.category === category.category),
        ),
      };
    })
    .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());
}

function buildHoleSummaries(events: StrokesGainedEvent[]) {
  const grouped = new Map<number, StrokesGainedEvent[]>();

  for (const event of events) {
    if (typeof event.holeNumber !== "number") {
      continue;
    }

    grouped.set(event.holeNumber, [...(grouped.get(event.holeNumber) ?? []), event]);
  }

  return [...grouped.entries()]
    .map(([holeNumber, holeEvents]) => {
      const summary = summarizeStrokesGained(holeEvents.map((event) => event.strokesGained));
      const calculatedValues = holeEvents
        .map((event) => event.strokesGained)
        .filter(isFiniteNumber);
      const highestValue = calculatedValues.length ? Math.max(...calculatedValues) : 0;
      const lowestValue = calculatedValues.length ? Math.min(...calculatedValues) : 0;

      return {
        holeNumber,
        eventCount: holeEvents.length,
        total: summary.total,
        average: summary.average,
        sampleSize: summary.sampleSize,
        pendingCount: Math.max(0, holeEvents.length - summary.sampleSize),
        gainCount: calculatedValues.filter((value) => value > 0).length,
        lossCount: calculatedValues.filter((value) => value < 0).length,
        swing: roundOne(highestValue - lowestValue),
      };
    })
    .filter((summary) => summary.sampleSize > 0);
}

function MobileScoringDiagnosis({
  analysis,
  activeCategory,
  totalEvents,
}: {
  analysis: ReturnType<typeof buildStrokesGainedAnalysis>;
  activeCategory: CategorySummary | null;
  totalEvents: number;
}) {
  const mainLeak = analysis.weakestCategory;
  const hasNegativeLeak = (mainLeak?.total ?? 0) < 0;

  return (
    <section className="grid min-w-0 gap-2" aria-labelledby="mobile-sg-diagnosis-title">
      <IOSSectionHeader
        title={<span id="mobile-sg-diagnosis-title">Scoring diagnosis</span>}
        description="The answer first; supporting evidence stays available below."
      />
      <IOSGroupedList label="Strokes gained diagnosis">
        {activeCategory ? (
          <>
            <IOSListRow
              label={activeCategory.label}
              value={<SgValue value={activeCategory.total} />}
              detail={`${integerFormatter.format(activeCategory.sampleSize)} calculated from ${integerFormatter.format(activeCategory.eventCount)} mapped events`}
              status={
                <IOSInlineStatus
                  label={
                    activeCategory.total === null
                      ? "Building baseline"
                      : scoringSignalLabel(activeCategory.total)
                  }
                  tone={scoringSignalTone(activeCategory.total)}
                />
              }
            />
            <IOSListRow
              label="Category role"
              value={categoryStatus(activeCategory, analysis.bestCategory, mainLeak)}
              detail={categoryRoleDetail(activeCategory)}
            />
          </>
        ) : (
          <>
            <IOSListRow
              label={hasNegativeLeak ? "Main scoring leak" : "Current focus"}
              value={mainLeak?.label ?? "No data"}
              detail={
                mainLeak
                  ? `${formatSg(mainLeak.total, "No data")} across ${integerFormatter.format(mainLeak.sampleSize)} calculated events`
                  : `${integerFormatter.format(totalEvents)} mapped events; complete shot-to-hole data to identify the first leak.`
              }
              status={
                <IOSInlineStatus
                  label={
                    mainLeak?.total === null || mainLeak?.total === undefined
                      ? "Building baseline"
                      : scoringSignalLabel(mainLeak.total)
                  }
                  tone={scoringSignalTone(mainLeak?.total ?? null)}
                />
              }
            />
            <IOSListRow
              label="Strongest phase"
              value={analysis.bestCategory?.label ?? "No data"}
              detail={
                analysis.bestCategory
                  ? `${formatSg(analysis.bestCategory.total, "No data")} across ${integerFormatter.format(analysis.bestCategory.sampleSize)} calculated events`
                  : "No calculated phase is available yet."
              }
            />
          </>
        )}
      </IOSGroupedList>
    </section>
  );
}

function MobileCategorySummary({
  categories,
  activeCategory,
  bestCategory,
  weakestCategory,
}: {
  categories: CategorySummary[];
  activeCategory: CategorySummary | null;
  bestCategory: CategorySummary | null;
  weakestCategory: CategorySummary | null;
}) {
  return (
    <section className="grid min-w-0 gap-2" aria-labelledby="mobile-sg-phases-title">
      <IOSSectionHeader
        title={<span id="mobile-sg-phases-title">Scoring phases</span>}
        description="Open a phase-specific view without loading every chart."
      />
      <IOSGroupedList label="Strokes gained scoring phases">
        {categories.map((category) => {
          const status = categoryStatus(category, bestCategory, weakestCategory);
          const active = activeCategory?.category === category.category;

          return (
            <IOSListRow
              key={category.category}
              label={category.label}
              value={<SgValue value={category.total} />}
              detail={`${integerFormatter.format(category.sampleSize)} calculated · ${integerFormatter.format(category.pendingCount)} pending`}
              href={`/strokes-gained?category=${category.category}`}
              ariaLabel={`${category.label}: ${formatSg(category.total, "No data")}. ${status}.`}
              status={
                <IOSInlineStatus
                  label={active ? `Current · ${status}` : status}
                  tone={categorySignalTone(category, bestCategory)}
                />
              }
            />
          );
        })}
      </IOSGroupedList>
    </section>
  );
}

function MobileStrokesGainedDisclosures({
  analysis,
  activeCategory,
  gains,
  losses,
  rounds,
  holes,
}: {
  analysis: ReturnType<typeof buildStrokesGainedAnalysis>;
  activeCategory: CategorySummary | null;
  gains: StrokesGainedEvent[];
  losses: StrokesGainedEvent[];
  rounds: RoundSummary[];
  holes: HoleSummary[];
}) {
  const calculatedPhaseCount = analysis.categories.filter(
    (category) => category.sampleSize > 0,
  ).length;

  return (
    <section className="grid min-w-0 gap-2" aria-labelledby="mobile-sg-evidence-title">
      <IOSSectionHeader
        title={<span id="mobile-sg-evidence-title">Supporting evidence</span>}
        description="Open one section at a time when you need the detail."
      />
      <IOSDisclosureGroup
        label="Strokes gained supporting evidence"
        items={[
          {
            value: "phase-detail",
            title: "Phase detail",
            summary: `${integerFormatter.format(calculatedPhaseCount)}/${integerFormatter.format(analysis.categories.length)} · ${formatSg(analysis.categoryTotal)}`,
            description: "Category bars and the gain/loss waterfall",
            contentClassName:
              "grid min-w-0 gap-3 px-2 [&_.premium-card]:min-w-0 [&_.premium-card]:shadow-none [&_a]:min-h-11",
            content: (
              <>
                <CategoryBreakdown
                  categories={analysis.categories}
                  total={analysis.totals.total}
                  categoryTotal={analysis.categoryTotal}
                  pendingCount={analysis.pendingCount}
                />
                <GainLossWaterfall categories={analysis.categories} compactMobile />
              </>
            ),
          },
          {
            value: "shot-evidence",
            title: "Shot evidence",
            summary: `${integerFormatter.format(gains.length)} gains · ${integerFormatter.format(losses.length)} losses`,
            description: "The shots creating and costing the most value",
            contentClassName:
              "grid min-w-0 gap-3 px-2 [&_.premium-card]:min-w-0 [&_.premium-card]:shadow-none",
            content: (
              <ShotHighlights gains={gains} losses={losses} focusCategory={activeCategory} />
            ),
          },
          {
            value: "round-trend",
            title: "Round trend",
            summary: pluralise(rounds.length, "round"),
            description: "How the current signal changes by round",
            contentClassName:
              "grid min-w-0 gap-3 px-2 [&_.premium-card]:min-w-0 [&_.premium-card]:shadow-none",
            content: (
              <RoundTrendPanel
                rounds={rounds}
                bestCategory={analysis.bestCategory}
                weakestCategory={analysis.weakestCategory}
                focusCategory={activeCategory}
              />
            ),
          },
          {
            value: "hole-impact",
            title: "Hole impact",
            summary: pluralise(holes.length, "hole"),
            description: "Best, costliest and most volatile holes",
            contentClassName:
              "grid min-w-0 gap-3 px-2 [&_.premium-card]:min-w-0 [&_.premium-card]:shadow-none",
            content: <HoleImpactPanel holes={holes} focusCategory={activeCategory} />,
          },
        ]}
      />
    </section>
  );
}

function CategoryCards({
  categories,
  activeCategory,
  bestCategory,
  weakestCategory,
}: {
  categories: CategorySummary[];
  activeCategory: CategorySummary | null;
  bestCategory: CategorySummary | null;
  weakestCategory: CategorySummary | null;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {categories.map((category) => (
        <CategoryCard
          key={category.category}
          category={category}
          active={activeCategory?.category === category.category}
          bestCategory={bestCategory}
          weakestCategory={weakestCategory}
        />
      ))}
    </section>
  );
}

function CategoryCard({
  category,
  active,
  bestCategory,
  weakestCategory,
}: {
  category: CategorySummary;
  active: boolean;
  bestCategory: CategorySummary | null;
  weakestCategory: CategorySummary | null;
}) {
  const href =
    category.eventCount > 0 || category.category === "putting"
      ? `/strokes-gained?category=${category.category}`
      : "/strokes-gained";
  const isDataGap = category.sampleSize === 0;
  const highPending = hasHighPendingCount(category);

  return (
    <Link href={href} prefetch={false} className="block">
      <Card
        className={cn(
          "premium-card grid min-h-44 content-between gap-3 border p-3 transition-colors",
          categoryCardClassName(category),
          active ? "ring-2 ring-sky-300" : "hover:border-sky-300",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">{category.label}</p>
            <p
              className={cn(
                "mt-1.5 text-2xl font-semibold tracking-normal tabular-nums",
                sgTextClassName(category.total),
              )}
            >
              {formatSg(category.total, "No data")}
            </p>
          </div>
          <div
            className={cn(
              "grid size-9 place-items-center rounded-md ring-1",
              categoryIconClassName(category),
            )}
          >
            <Target className="size-5" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p
            className={cn(
              "text-sm font-semibold",
              highPending || isDataGap ? "text-amber-800" : sgTextClassName(category.total),
            )}
          >
            {categoryStatus(category, bestCategory, weakestCategory)}
          </p>
          <p className="text-xs leading-4 text-muted-foreground">{categoryCardDetail(category)}</p>
          {category.pendingCount > 0 ? (
            <p
              className={cn(
                "text-[11px] leading-4",
                highPending ? "font-medium text-amber-800" : "text-muted-foreground",
              )}
            >
              {integerFormatter.format(category.pendingCount)} pending or unmapped
              {highPending ? " - check coverage before over-reading" : ""}
            </p>
          ) : null}
          <p className="text-[11px] font-medium leading-4 text-slate-700">
            {categoryRecommendation(category)}
          </p>
        </div>
      </Card>
    </Link>
  );
}

function CalculationCoverageStrip({
  analysis,
  totalEvents,
}: {
  analysis: ReturnType<typeof buildStrokesGainedAnalysis>;
  totalEvents: number;
}) {
  const calculatedPercent =
    totalEvents > 0 ? Math.round((analysis.totals.sampleSize / totalEvents) * 100) : 0;
  const putting = analysis.categories.find((category) => category.category === "putting");
  const puttingMissing = !putting || putting.sampleSize === 0;

  return (
    <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Calculation coverage</p>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            {integerFormatter.format(analysis.totals.sampleSize)} /{" "}
            {integerFormatter.format(totalEvents)} events calculated ·{" "}
            {integerFormatter.format(analysis.pendingCount)} pending or unmapped
            {puttingMissing ? " · Putting not available yet" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            tone={calculatedPercent >= 80 ? "green" : calculatedPercent >= 60 ? "amber" : "pink"}
          >
            {integerFormatter.format(calculatedPercent)}% calculated
          </StatusPill>
          <StatusPill tone={analysis.pendingCount > 0 ? "amber" : "green"}>
            {integerFormatter.format(analysis.pendingCount)} pending
          </StatusPill>
          <StatusPill tone={puttingMissing ? "slate" : "green"}>
            {puttingMissing ? "Putting data missing" : "Putting calculated"}
          </StatusPill>
        </div>
      </div>
    </section>
  );
}

function CategoryNavTabs({
  categories,
  activeCategory,
}: {
  categories: CategorySummary[];
  activeCategory: CategorySummary | null;
}) {
  const items = [
    { label: "Overall", href: "/strokes-gained", active: activeCategory === null },
    ...categories.map((category) => ({
      label: category.label,
      href: `/strokes-gained?category=${category.category}`,
      active: activeCategory?.category === category.category,
    })),
  ];

  return (
    <nav
      aria-label="Strokes gained views"
      tabIndex={0}
      className="flex max-w-full gap-1 overflow-x-auto border-b border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch={false}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative flex min-h-11 shrink-0 items-center px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none lg:min-h-9",
            item.active
              ? "text-foreground after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:bg-foreground"
              : "",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function CategoryBreakdown({
  categories,
  total,
  categoryTotal,
  pendingCount,
}: {
  categories: CategorySummary[];
  total: number | null;
  categoryTotal: number;
  pendingCount: number;
}) {
  const maxAbsTotal = Math.max(1, ...categories.map((category) => Math.abs(category.total ?? 0)));
  const discrepancy = total === null ? null : roundOne(categoryTotal - total);
  const categorySumLabel =
    total === null
      ? "No data"
      : discrepancy !== null && Math.abs(discrepancy) >= 0.1
        ? `${formatSg(categoryTotal)} (${formatSg(discrepancy)} delta)`
        : formatSg(categoryTotal, "No data");

  return (
    <DataPanel>
      <SectionHeader
        title="Category breakdown"
        description="Where mapped shot events are gaining or losing value against the expected-strokes baseline."
        action={<BarChart3 className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid gap-3 p-4">
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]">
          <span>← Losing strokes</span>
          <span className="rounded-full border border-border bg-card px-2 py-1 text-muted-foreground shadow-sm sm:px-3">
            0 baseline
          </span>
          <span>Gaining strokes →</span>
        </div>
        <div className="grid gap-2.5 md:grid-cols-2">
          {categories.map((category) => (
            <CategoryBarRow key={category.category} category={category} maxAbsTotal={maxAbsTotal} />
          ))}
        </div>
        <div className="grid gap-2.5 border-t border-border pt-3 sm:grid-cols-3">
          <CategorySummaryTile
            icon={CheckCircle2}
            tone="green"
            label="Calculated"
            value={`${integerFormatter.format(categories.reduce((sum, category) => sum + category.sampleSize, 0))}`}
          />
          <CategorySummaryTile
            icon={Clock3}
            tone="amber"
            label="Pending / unmapped"
            value={integerFormatter.format(pendingCount)}
          />
          <CategorySummaryTile
            icon={Sigma}
            tone="green"
            label="Total category SG"
            value={categorySumLabel}
            valueClassName={sgTextClassName(total)}
          />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function CategoryBarRow({
  category,
  maxAbsTotal,
}: {
  category: CategorySummary;
  maxAbsTotal: number;
}) {
  const total = category.total;
  const width =
    total === null ? 0 : Math.max(4, Math.min(100, (Math.abs(total) / maxAbsTotal) * 100));
  const visual = categoryVisual(category.category);

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg border",
              visual.iconTileClassName,
            )}
          >
            <Target className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{category.label}</p>
            <p className="truncate text-xs leading-4 text-muted-foreground">
              {category.sampleSize > 0
                ? `${integerFormatter.format(category.sampleSize)} calculated · ${integerFormatter.format(category.pendingCount)} pending`
                : "No calculated events"}
            </p>
          </div>
        </div>
        <p className={cn("shrink-0 text-base font-bold tabular-nums", sgTextClassName(total))}>
          {formatSg(total, "No data")}
        </p>
      </div>
      <div className="mt-2 grid h-2.5 grid-cols-2 overflow-hidden rounded-full border border-border bg-secondary shadow-inner">
        <div className="flex items-center justify-end border-r border-muted-foreground">
          {total !== null && total < 0 ? (
            <span
              className="h-full rounded-l-full bg-[linear-gradient(90deg,#E5483F,#B42318)]"
              style={{ width: `${width}%` }}
            />
          ) : null}
        </div>
        <div className="flex items-center justify-start">
          {total !== null && total >= 0 ? (
            <span
              className="h-full rounded-r-full bg-[linear-gradient(90deg,#087A3D,#0B8F4A)]"
              style={{ width: `${width}%` }}
            />
          ) : null}
        </div>
      </div>
      {hasHighPendingCount(category) ? (
        <p className="mt-1.5 text-xs font-semibold leading-4 text-amber-800">High pending count</p>
      ) : null}
    </div>
  );
}

function CategorySummaryTile({
  icon: Icon,
  tone,
  label,
  value,
  valueClassName,
}: {
  icon: LucideIcon;
  tone: "green" | "amber" | "slate";
  label: string;
  value: string;
  valueClassName?: string;
}) {
  const toneClassName =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/55 dark:text-amber-300"
        : "bg-secondary text-muted-foreground";

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <span className={cn("grid size-8 place-items-center rounded-full", toneClassName)}>
        <Icon className="size-4" />
      </span>
      <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums text-foreground", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

function categoryVisual(category: string) {
  if (category === "tee") {
    return {
      iconTileClassName:
        "border-red-100 bg-red-50 text-[#B42318] dark:border-red-900/60 dark:bg-red-950/45 dark:text-red-300",
    };
  }

  if (category === "approach") {
    return {
      iconTileClassName:
        "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/45 dark:text-emerald-300",
    };
  }

  if (category === "short_game") {
    return {
      iconTileClassName:
        "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-300",
    };
  }

  return { iconTileClassName: "border-border bg-secondary text-muted-foreground" };
}

function GainLossWaterfall({
  categories,
  compactMobile = false,
}: {
  categories: CategorySummary[];
  compactMobile?: boolean;
}) {
  const calculated = categories.filter((category) => typeof category.total === "number");
  const values = calculated.map((category) => category.total ?? 0);
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));
  const barWidth = calculated.length > 0 ? 680 / calculated.length : 680;
  const bestCategory = [...calculated].sort(
    (left, right) => (right.total ?? 0) - (left.total ?? 0),
  )[0];
  const weakestCategory = [...calculated].sort(
    (left, right) => (left.total ?? 0) - (right.total ?? 0),
  )[0];
  const totalSg = calculated.reduce((sum, category) => sum + (category.total ?? 0), 0);
  const waterfallSummary =
    calculated.length > 0
      ? `The waterfall covers ${calculated.length} calculated scoring categories with ${formatSg(totalSg)} total category value. ${
          bestCategory
            ? `${bestCategory.label} is strongest at ${formatSg(bestCategory.total)}.`
            : ""
        } ${
          weakestCategory
            ? `${weakestCategory.label} is weakest at ${formatSg(weakestCategory.total)}.`
            : ""
        }`.trim()
      : "No calculated strokes-gained categories are available yet.";
  const waterfallRows = categories.map((category) => ({
    _key: category.category,
    category: category.label,
    total: formatSg(category.total),
    average: formatSg(category.average),
    calculatedEvents: integerFormatter.format(category.sampleSize),
    pendingEvents: integerFormatter.format(category.pendingCount),
  }));

  return (
    <DataPanel>
      <SectionHeader
        title="Gain/loss waterfall"
        description="How each category moves the round total before the table evidence."
        action={<Sigma className="size-5 text-emerald-700" />}
      />
      <CardContent>
        {calculated.length > 0 ? (
          <div className="grid min-w-0 gap-3 overflow-hidden rounded-lg border border-border bg-secondary/35 p-3 md:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] md:items-stretch">
            <svg
              viewBox="0 0 760 150"
              role="img"
              aria-label="Strokes gained waterfall"
              className={cn(
                "w-full self-center text-foreground",
                compactMobile ? "h-auto min-h-28 max-w-full" : "h-32",
              )}
            >
              <line x1="40" x2="720" y1="68" y2="68" className="stroke-border" strokeWidth="2" />
              {calculated.map((category, index) => {
                const value = category.total ?? 0;
                const height = Math.max(8, (Math.abs(value) / maxAbs) * 38);
                const x = 48 + index * barWidth;
                const y = value >= 0 ? 68 - height : 68;
                const fill = value >= 0 ? "#087A3D" : "#DC2626";

                return (
                  <g key={category.category}>
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(48, barWidth - 28)}
                      height={height}
                      rx="10"
                      fill={fill}
                      opacity="0.9"
                    />
                    <text
                      x={x + Math.max(48, barWidth - 28) / 2}
                      y={value >= 0 ? y - 10 : y + height + 22}
                      textAnchor="middle"
                      className="fill-foreground"
                      fontSize="22"
                      fontWeight="800"
                    >
                      {formatSg(value)}
                    </text>
                    <text
                      x={x + Math.max(48, barWidth - 28) / 2}
                      y="132"
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize="18"
                      fontWeight="700"
                    >
                      {category.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <ChartAccessibleFallback
              title="Strokes gained waterfall"
              summary={waterfallSummary}
              columns={[
                { key: "category", label: "Category" },
                { key: "total", label: "Total SG" },
                { key: "average", label: "Average SG" },
                { key: "calculatedEvents", label: "Calculated events" },
                { key: "pendingEvents", label: "Pending events" },
              ]}
              rows={waterfallRows}
              className={cn("h-full", compactMobile && "[&>details]:hidden")}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-secondary/35 p-6 text-center text-sm leading-6 text-muted-foreground">
            Add calculated strokes-gained events to draw the gain/loss waterfall.
          </div>
        )}
      </CardContent>
    </DataPanel>
  );
}

function PracticeThisFirstCard({ summary }: { summary: CategorySummary | null }) {
  const title = summary ? `${summary.label}: practice this first` : "Practice this first";
  const total = summary?.total ?? null;
  const hasCalculatedSignal = total !== null && (summary?.sampleSize ?? 0) > 0;

  return (
    <DataPanel>
      <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_auto] md:items-center">
        <div>
          <StatusPill tone={total !== null && total < 0 ? "pink" : "amber"}>
            Scoring priority
          </StatusPill>
          <h2 className="mt-2 text-xl font-bold leading-7 tracking-normal text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {practiceRecommendation(summary?.category)}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <DataPair label="SG total" value={total === null ? "--" : formatSg(total)} />
          <DataPair
            label="Sample"
            value={summary ? integerFormatter.format(summary.sampleSize) : "--"}
          />
          <DataPair label="Confidence" value={hasCalculatedSignal ? "Actionable" : "Building"} />
        </div>
        <Button asChild className="min-h-11 rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <Link href="/coach#more-drills" prefetch={false}>
            <Target className="size-4" />
            Start drill
          </Link>
        </Button>
      </CardContent>
    </DataPanel>
  );
}

function MainScoringLeak({
  summary,
  events,
  focusCategory,
}: {
  summary: CategorySummary | null;
  events: StrokesGainedEvent[];
  focusCategory: CategorySummary | null;
}) {
  const leakEvents = summary ? events.filter((event) => event.category === summary.category) : [];
  const hasData = summary !== null && summary.sampleSize > 0;
  const hasLeak = summary !== null && summary.total !== null && summary.total < 0;
  const hasGain = summary !== null && summary.total !== null && summary.total > 0;
  const roughCount = leakEvents.filter((event) => event.endLie === "rough").length;
  const penaltyCount = leakEvents.filter((event) => event.penaltyStrokes > 0).length;
  const lossCount = leakEvents.filter(
    (event) => typeof event.strokesGained === "number" && event.strokesGained < 0,
  ).length;
  const gainCount = leakEvents.filter(
    (event) => typeof event.strokesGained === "number" && event.strokesGained > 0,
  ).length;
  const neutralCount = summary ? Math.max(0, summary.sampleSize - lossCount - gainCount) : 0;
  const sectionTitle = focusCategory ? `${focusCategory.label} diagnosis` : "Main scoring leak";
  const sectionDescription = focusCategory
    ? "The selected category translated into the next scoring decision."
    : "The weakest category translated into practice priority.";
  const artwork = summary ? scoringLeakArtwork(summary.category) : null;

  return (
    <DataPanel>
      <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg border",
              hasLeak
                ? "border-red-100 bg-red-50 text-[#B42318]"
                : hasGain
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : "border-amber-100 bg-amber-50 text-amber-700",
            )}
          >
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-6 tracking-normal text-[#111827]">
              {sectionTitle}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#667085]">{sectionDescription}</p>
          </div>
        </div>
        <span
          className={cn(
            "hidden size-11 shrink-0 place-items-center rounded-lg border sm:grid",
            hasLeak
              ? "border-red-100 bg-red-50 text-[#B42318]"
              : hasGain
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-amber-100 bg-amber-50 text-amber-700",
          )}
        >
          <AlertTriangle className="size-5" />
        </span>
      </div>
      <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="grid overflow-hidden rounded-lg border border-red-100 bg-[linear-gradient(135deg,#FFF5F5_0%,#FFFFFF_58%,#FFF8F8_100%)] sm:grid-cols-[minmax(15rem,0.85fr)_minmax(0,1.15fr)]">
          {artwork ? (
            <div className="relative aspect-[3/2] min-h-44 overflow-hidden border-b border-red-100 bg-[#77944C] sm:border-r sm:border-b-0">
              <Image
                src={artwork.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 24vw, (min-width: 640px) 42vw, 100vw"
                className={cn("object-cover", artwork.className)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/8 via-transparent to-white/10" />
            </div>
          ) : null}
          <div className="p-4 sm:self-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#B42318]">Verdict</p>
            <p className="mt-2 text-xl font-bold leading-7 tracking-normal text-[#111827]">
              {summary && summary.sampleSize === 0
                ? `${summary.label} cannot be judged yet.`
                : hasLeak && summary
                  ? `${summary.label} shots are costing `
                  : hasGain && summary
                    ? `${summary.label} is gaining `
                    : "No negative category has separated yet."}
              {hasLeak && summary ? (
                <span className="text-[#B42318]">{formatSg(summary.total)}</span>
              ) : null}
              {hasGain && summary ? (
                <span className="text-emerald-700">{formatSg(summary.total)} strokes</span>
              ) : null}
              {summary && (hasLeak || hasGain) ? "." : null}
            </p>
            <p className="mt-2 text-sm leading-5 text-[#667085]">
              {hasData && summary
                ? `${integerFormatter.format(summary.eventCount)} ${summary.label.toLowerCase()} events were analysed. ${integerFormatter.format(lossCount)} calculated shots lost value and ${integerFormatter.format(gainCount)} gained value.`
                : summary?.category === "putting"
                  ? "Add putt distances to mapped rounds before judging putting strokes gained."
                  : "Keep mapping complete rounds so the next scoring leak is based on enough calculated events."}
            </p>
          </div>
        </div>
        <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-base font-bold leading-6 text-[#111827]">Likely causes</p>
          <div className="mt-2">
            {summary && hasData ? (
              <div className="grid grid-cols-2 gap-2">
                <CauseStat
                  icon={Users}
                  value={summary.eventCount}
                  label={`${summary.label.toLowerCase()} events`}
                />
                <CauseStat icon={TrendingDown} value={lossCount} label="losing shots" tone="pink" />
                <CauseStat icon={TrendingUp} value={gainCount} label="gaining shots" tone="green" />
                <CauseStat icon={Equal} value={neutralCount} label="neutral shots" />
                {roughCount > 0 ? (
                  <CauseStat icon={Sprout} value={roughCount} label="rough finishes" tone="amber" />
                ) : null}
                {penaltyCount > 0 ? (
                  <CauseStat
                    icon={AlertTriangle}
                    value={penaltyCount}
                    label="penalties"
                    tone="pink"
                  />
                ) : null}
                {summary.pendingCount > 0 ? (
                  <CauseStat
                    icon={Clock3}
                    value={summary.pendingCount}
                    label="pending"
                    tone="amber"
                  />
                ) : null}
              </div>
            ) : summary?.category === "putting" ? (
              <div className="grid gap-2 text-sm leading-5 text-[#667085]">
                <p>No mapped putting events have calculated SG yet.</p>
                <p>Add first-putt and finish distances for each green.</p>
              </div>
            ) : (
              <p className="text-sm leading-5 text-[#667085]">
                Add mapped shot events to identify the category causing damage.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function scoringLeakArtwork(category: string) {
  if (category === "approach") {
    return {
      src: "/assets/generated/strokes-leak-approach-v3.png",
      className: "object-[50%_56%]",
    };
  }

  if (category === "short_game") {
    return {
      src: "/assets/generated/strokes-leak-short-game-v3.png",
      className: "object-[50%_56%]",
    };
  }

  if (category === "putting") {
    return {
      src: "/assets/generated/strokes-leak-putting-v3.png",
      className: "object-[50%_56%]",
    };
  }

  return {
    src: "/assets/generated/strokes-leak-tee-v3.png",
    className: "object-center",
  };
}

function CauseStat({
  icon: Icon,
  value,
  label,
  tone = "slate",
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  tone?: "green" | "pink" | "amber" | "slate";
}) {
  const toneClassName =
    tone === "green"
      ? "border-emerald-100 bg-emerald-50/70 text-emerald-700"
      : tone === "pink"
        ? "border-red-100 bg-red-50/70 text-[#B42318]"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50/80 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div
      className={cn(
        "grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-2",
        toneClassName,
      )}
    >
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none tracking-normal tabular-nums text-[#111827]">
          {integerFormatter.format(value)}
        </p>
        <p className="mt-1 truncate text-xs leading-4 text-[#667085]">{label}</p>
      </div>
      <Icon className="size-5" />
    </div>
  );
}

function ShotHighlights({
  gains,
  losses,
  focusCategory,
}: {
  gains: StrokesGainedEvent[];
  losses: StrokesGainedEvent[];
  focusCategory: CategorySummary | null;
}) {
  const prefix = focusCategory ? `${focusCategory.label} ` : "";

  return (
    <section className="grid items-start gap-4 md:grid-cols-2">
      <ShotHighlightPanel
        title={`${prefix}Biggest gains`}
        description="The shots that created the most scoring value."
        events={gains}
        tone="gain"
        icon={<TrendingUp className="size-5 text-[#087A3D]" />}
      />
      <ShotHighlightPanel
        title={`${prefix}Biggest losses`}
        description="The shots that hurt the card most."
        events={losses}
        tone="loss"
        icon={<TrendingDown className="size-5 text-[#B42318]" />}
      />
    </section>
  );
}

function ShotHighlightPanel({
  title,
  description,
  events,
  tone,
  icon,
}: {
  title: string;
  description: string;
  events: StrokesGainedEvent[];
  tone: "gain" | "loss";
  icon: React.ReactNode;
}) {
  return (
    <DataPanel>
      <SectionHeader title={title} description={description} action={icon} />
      <CardContent>
        <MobileDataList
          className="gap-2"
          empty={
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No calculated shot events yet.
            </p>
          }
        >
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/rounds/${event.sessionId}`}
              prefetch={false}
              className={cn(
                "block rounded-md border bg-card p-3 transition-colors motion-reduce:transition-none",
                tone === "gain"
                  ? "border-emerald-200 hover:border-emerald-400 dark:border-emerald-900/70"
                  : "border-red-200 hover:border-red-400 dark:border-red-900/70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={toneForSg(event.strokesGained)}>
                      {titleCase(event.category)}
                    </StatusPill>
                    <span className="text-sm font-semibold text-foreground">
                      Hole {event.holeNumber ?? "?"}
                    </span>
                  </div>
                  <p
                    className="mt-1 truncate text-sm leading-5 text-muted-foreground"
                    title={
                      shotCostNote(event)
                        ? `${formatPosition(event.startDistanceYd, event.startLie)} -> ${formatPosition(event.endDistanceYd, event.endLie)} · ${shotCostNote(event)}`
                        : undefined
                    }
                  >
                    {formatPosition(event.startDistanceYd, event.startLie)} -&gt;{" "}
                    {formatPosition(event.endDistanceYd, event.endLie)}
                    {shotCostNote(event) ? ` · ${shotCostNote(event)}` : null}
                  </p>
                </div>
                <SgValue value={event.strokesGained} className="text-lg" />
              </div>
            </Link>
          ))}
        </MobileDataList>
      </CardContent>
    </DataPanel>
  );
}

function RoundTrendPanel({
  rounds,
  bestCategory,
  weakestCategory,
  focusCategory,
}: {
  rounds: RoundSummary[];
  bestCategory: CategorySummary | null;
  weakestCategory: CategorySummary | null;
  focusCategory: CategorySummary | null;
}) {
  const displayedRounds = rounds.slice(0, 6);
  const maxAbsTotal = Math.max(1, ...displayedRounds.map((round) => Math.abs(round.total ?? 0)));

  return (
    <DataPanel>
      <SectionHeader
        title={focusCategory ? `${focusCategory.label} SG by round` : "SG by round"}
        description={
          rounds.length > 0
            ? `Latest ${Math.min(6, rounds.length)} of ${integerFormatter.format(rounds.length)} mapped rounds.`
            : "No mapped rounds yet."
        }
        action={<Flag className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid gap-4">
        <p className="rounded-md border border-border bg-secondary/55 px-3 py-2 text-sm leading-6 text-muted-foreground">
          {roundSignal(rounds, bestCategory, weakestCategory, focusCategory)}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {displayedRounds.map((round) => (
            <Link
              key={round.sessionId}
              href={`/rounds/${round.sessionId}`}
              prefetch={false}
              className="grid gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:border-sky-400 motion-reduce:transition-none"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {round.courseName ?? "Mapped round"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(round.sessionDate)}
                  </p>
                </div>
                <SgValue value={round.total} className="shrink-0 text-lg" />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {roundCategoryLine(round, focusCategory)}
              </p>
              <SgHorizontalBar value={round.total} maxAbs={maxAbsTotal} />
            </Link>
          ))}
          {rounds.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Add mapped shot-to-hole events to build a round trend.
            </p>
          ) : null}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function HoleImpactPanel({
  holes,
  focusCategory,
}: {
  holes: HoleSummary[];
  focusCategory: CategorySummary | null;
}) {
  const bestHoles = [...holes].sort(descendingTotal).slice(0, 3);
  const costliestHoles = [...holes].sort(ascendingTotal).slice(0, 3);
  const mostVolatile = [...holes].sort((a, b) => b.swing - a.swing)[0] ?? null;
  const needsReview = costliestHoles[0] ?? null;

  return (
    <DataPanel>
      <SectionHeader
        title="Hole impact"
        description={
          focusCategory
            ? `${focusCategory.label} scoring impact by hole.`
            : "Best, costliest and most volatile holes from the calculated events."
        }
        action={<Target className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HoleImpactList title="Best holes" holes={bestHoles} />
        <HoleImpactList title="Costliest holes" holes={costliestHoles} />
        <HoleImpactSingle
          title="Most volatile"
          hole={mostVolatile}
          detail={
            mostVolatile
              ? `${integerFormatter.format(mostVolatile.gainCount)} gains and ${integerFormatter.format(mostVolatile.lossCount)} losses`
              : "No calculated hole events yet."
          }
        />
        <HoleImpactSingle
          title="Needs review"
          hole={needsReview}
          detail={
            needsReview
              ? `${focusCategory?.label ?? "Tee"} pressure is highest here.`
              : "No calculated hole events yet."
          }
          action={
            needsReview
              ? `Review ${focusCategory?.label.toLowerCase() ?? "tee"} strategy`
              : undefined
          }
        />
      </CardContent>
    </DataPanel>
  );
}

function HoleImpactList({ title, holes }: { title: string; holes: HoleSummary[] }) {
  const maxAbsTotal = Math.max(1, ...holes.map((hole) => Math.abs(hole.total ?? 0)));

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2 grid gap-2">
        {holes.length > 0 ? (
          holes.map((hole) => (
            <div
              key={hole.holeNumber}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm"
            >
              <span className="font-medium">Hole {hole.holeNumber}</span>
              <SgMiniBar value={hole.total} maxAbs={maxAbsTotal} />
              <SgValue value={hole.total} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No calculated hole events yet.</p>
        )}
      </div>
    </div>
  );
}

function HoleImpactSingle({
  title,
  hole,
  detail,
  action,
}: {
  title: string;
  hole: HoleSummary | null;
  detail: string;
  action?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hole ? (
        <div className="mt-2 grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Hole {hole.holeNumber}</span>
            <SgValue value={hole.total} />
          </div>
          <p className="text-sm leading-5 text-muted-foreground">{detail}</p>
          <p className="text-xs text-muted-foreground">
            {integerFormatter.format(hole.sampleSize)} calculated ·{" "}
            {integerFormatter.format(hole.pendingCount)} pending
          </p>
          {action ? (
            <Link
              href="/coach#more-drills"
              prefetch={false}
              className="inline-flex min-h-11 items-center text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              {action}
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}

function RecentShotEventsPanel({
  events,
  totalEvents,
  filters,
  filterOptions,
  activeFilterChips,
}: {
  events: StrokesGainedEvent[];
  totalEvents: number;
  filters: StrokesGainedFilters;
  filterOptions: FilterOptions;
  activeFilterChips: Array<{ label: string; href: string }>;
}) {
  return (
    <DataPanel id="events">
      <details open={activeFilterChips.length > 0} className="group">
        <summary className="ios-grouped-row flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-16 lg:gap-4 lg:py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-[15px] font-medium leading-5 text-foreground lg:text-lg lg:font-semibold">
              Recent shot events
            </span>
            <span className="mt-0.5 block text-[13px] leading-[1.15rem] text-muted-foreground lg:text-sm">
              {integerFormatter.format(events.length)} matching rows from{" "}
              {integerFormatter.format(totalEvents)} mapped events.
            </span>
          </span>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground lg:rounded-lg lg:border lg:border-border lg:bg-card lg:px-3 lg:font-semibold">
            <ListFilter className="hidden size-4 lg:block" aria-hidden />
            <span className="lg:hidden">{integerFormatter.format(events.length)}</span>
            <span className="hidden lg:inline">Expand table</span>
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden
            />
          </span>
        </summary>
        <CardContent className="grid min-w-0 gap-4 border-t border-border p-3 lg:p-6">
          <QuickFilters filters={filters} />
          <StrokesGainedFilterForm filters={filters} options={filterOptions} />
          {activeFilterChips.length > 0 ? <ActiveFilterChips items={activeFilterChips} /> : null}
          <div className="hidden lg:block">
            <DesktopTableWorkbenchControls
              viewKey="strokes-gained-events"
              scope="strokes-gained"
              currentViewLabel={strokesGainedCurrentViewLabel(filters, activeFilterChips)}
              resultLabel={`${integerFormatter.format(events.length)} rows`}
              columns={strokesGainedEventColumns}
              suggestedViews={strokesGainedSuggestedViews}
              exportTableId="strokes-gained-events"
              exportFileName="forekinghell-strokes-gained-events.csv"
            />
          </div>
          <StrokesGainedEventTable events={events} />
        </CardContent>
      </details>
    </DataPanel>
  );
}

function strokesGainedCurrentViewLabel(
  filters: StrokesGainedFilters,
  activeFilterChips: Array<{ label: string; href: string }>,
) {
  if (activeFilterChips.length > 0) {
    return activeFilterChips.map((chip) => chip.label).join(" · ");
  }

  if (filters.sort === "gains") {
    return "Biggest gaining events";
  }

  if (filters.sort === "losses") {
    return "Biggest losing events";
  }

  if (filters.sort === "hole") {
    return "Events by hole";
  }

  if (filters.sort === "category") {
    return "Events by category";
  }

  return "Recent strokes-gained events";
}

function QuickFilters({ filters }: { filters: StrokesGainedFilters }) {
  const scopedCategory = filters.category || undefined;
  const shortcuts = [
    { label: "All", href: "/strokes-gained#events" },
    { label: "Gains", href: shortcutHref({ category: scopedCategory, sg: "gain", sort: "gains" }) },
    {
      label: "Losses",
      href: shortcutHref({ category: scopedCategory, sg: "loss", sort: "losses" }),
    },
    { label: "Pending", href: shortcutHref({ category: scopedCategory, sg: "pending" }) },
    { label: "Tee", href: shortcutHref({ category: "tee" }) },
    { label: "Approach", href: shortcutHref({ category: "approach" }) },
    { label: "Short game", href: shortcutHref({ category: "short_game" }) },
    { label: "Putting", href: shortcutHref({ category: "putting" }) },
  ];

  return (
    <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
      {shortcuts.map((shortcut) => (
        <Button
          key={shortcut.label}
          asChild
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0 lg:min-h-9"
        >
          <Link href={shortcut.href} prefetch={false}>
            {shortcut.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

type FilterOptions = {
  sessions: Array<{ id: string; label: string }>;
  categories: Array<{ value: string; label: string }>;
  holes: number[];
  startLies: string[];
  endLies: string[];
};

function StrokesGainedFilterForm({
  filters,
  options,
}: {
  filters: StrokesGainedFilters;
  options: FilterOptions;
}) {
  const inputClassName =
    "min-h-11 w-full min-w-0 max-w-full rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-sm lg:min-h-0";

  return (
    <form
      method="get"
      className="apple-panel grid min-w-0 grid-cols-2 gap-3 overflow-hidden p-3 md:grid-cols-3 xl:grid-cols-6"
    >
      <label className="col-span-2 grid min-w-0 gap-1 text-sm font-medium md:col-span-1">
        Round
        <select name="sessionId" defaultValue={filters.sessionId} className={inputClassName}>
          <option value="">All rounds</option>
          {options.sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.label}
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 grid min-w-0 gap-1 text-sm font-medium md:col-span-1">
        Category
        <select name="category" defaultValue={filters.category} className={inputClassName}>
          <option value="">All categories</option>
          {options.categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">
        Hole
        <select name="hole" defaultValue={filters.hole} className={inputClassName}>
          <option value="">All holes</option>
          {options.holes.map((hole) => (
            <option key={hole} value={hole.toString()}>
              Hole {hole}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">
        Start lie
        <select name="startLie" defaultValue={filters.startLie} className={inputClassName}>
          <option value="">Any start lie</option>
          {options.startLies.map((lie) => (
            <option key={lie} value={lie}>
              {titleCase(lie)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">
        End lie
        <select name="endLie" defaultValue={filters.endLie} className={inputClassName}>
          <option value="">Any end lie</option>
          {options.endLies.map((lie) => (
            <option key={lie} value={lie}>
              {titleCase(lie)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">
        SG result
        <select name="sg" defaultValue={filters.sg} className={inputClassName}>
          <option value="">All SG results</option>
          <option value="gain">Gains only</option>
          <option value="loss">Losses only</option>
          <option value="pending">Not calculated</option>
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">
        From
        <input type="date" name="from" defaultValue={filters.from} className={inputClassName} />
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">
        To
        <input type="date" name="to" defaultValue={filters.to} className={inputClassName} />
      </label>
      <label className="col-span-2 grid min-w-0 gap-1 text-sm font-medium md:col-span-1">
        Sort
        <select name="sort" defaultValue={filters.sort} className={inputClassName}>
          <option value="recent">Most recent</option>
          <option value="gains">Biggest gains</option>
          <option value="losses">Biggest losses</option>
          <option value="hole">By hole</option>
          <option value="category">By category</option>
        </select>
      </label>
      <div className="col-span-2 grid grid-cols-2 items-end gap-2 md:col-span-3 md:flex xl:col-span-6">
        <Button type="submit" className="min-h-11">
          Apply filters
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/strokes-gained#events" prefetch={false}>
            Reset
          </Link>
        </Button>
      </div>
    </form>
  );
}

function StrokesGainedEventTable({ events }: { events: StrokesGainedEvent[] }) {
  return (
    <DataTableFrame
      mainTable
      mainTableLabel="Strokes gained event table"
      stickyFirstColumn
      mobile={
        <IOSGroupedList label="Recent strokes gained events">
          {events.length > 0 ? (
            events.map((event) => (
              <IOSListRow
                key={event.id}
                label={`${holeShotLabel(event)} · ${titleCase(event.category)}`}
                value={<SgValue value={event.strokesGained} />}
                detail={
                  <>
                    {event.courseName ?? "Round"} · {formatDate(event.sessionDate)}
                    <br />
                    {formatPosition(event.startDistanceYd, event.startLie)} →{" "}
                    {formatPosition(event.endDistanceYd, event.endLie)}
                  </>
                }
                status={
                  <IOSInlineStatus
                    label={event.strokesGained === null ? "Pending" : "Calculated"}
                    tone={event.strokesGained === null ? "attention" : "neutral"}
                  />
                }
                href={`/rounds/${event.sessionId}`}
                ariaLabel={`${titleCase(event.category)}, ${holeShotLabel(event)}, ${formatSg(event.strokesGained)}, ${event.courseName ?? "Round"}`}
              />
            ))
          ) : (
            <IOSListRow
              label="No matching events"
              detail="Adjust or reset the current filters to see shot evidence."
            />
          )}
        </IOSGroupedList>
      }
    >
      <div className="max-h-[560px] overflow-auto">
        <Table
          data-workbench-scope="strokes-gained"
          data-workbench-export-table="strokes-gained-events"
          aria-describedby="strokes-gained-events-summary"
        >
          <TableCaption id="strokes-gained-events-summary" className="sr-only">
            Recent strokes-gained event table showing round, hole, category, start and end position,
            distance change, expected strokes, strokes gained and calculation status.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead
                data-column="round"
                className="sticky left-0 top-0 z-20 bg-card shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Round
              </TableHead>
              <TableHead data-column="hole" className="sticky top-0 z-10 bg-card">
                Hole
              </TableHead>
              <TableHead data-column="category" className="sticky top-0 z-10 bg-card">
                Category
              </TableHead>
              <TableHead data-column="from" className="sticky top-0 z-10 bg-card">
                From
              </TableHead>
              <TableHead data-column="to" className="sticky top-0 z-10 bg-card">
                To
              </TableHead>
              <TableHead data-column="distance" className="sticky top-0 z-10 bg-card">
                Distance
              </TableHead>
              <TableHead
                data-column="expected-before"
                className="sticky top-0 z-10 bg-card text-right"
              >
                Expected before
              </TableHead>
              <TableHead
                data-column="expected-after"
                className="sticky top-0 z-10 bg-card text-right"
              >
                Expected after
              </TableHead>
              <TableHead data-column="sg" className="sticky top-0 z-10 bg-card text-right">
                SG
              </TableHead>
              <TableHead data-column="status" className="sticky top-0 z-10 bg-card">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length > 0 ? (
              events.map((event) => (
                <TableRow key={event.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="round"
                    className="sticky left-0 z-10 min-w-48 bg-card shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <Link
                      href={`/rounds/${event.sessionId}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {event.courseName ?? "Round"}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(event.sessionDate)}
                    </p>
                  </TableCell>
                  <TableCell data-column="hole" className="whitespace-nowrap">
                    {holeShotLabel(event)}
                  </TableCell>
                  <TableCell data-column="category">{titleCase(event.category)}</TableCell>
                  <TableCell data-column="from" className="min-w-44">
                    {formatPosition(event.startDistanceYd, event.startLie)}
                  </TableCell>
                  <TableCell data-column="to" className="min-w-44">
                    {formatPosition(event.endDistanceYd, event.endLie)}
                  </TableCell>
                  <TableCell data-column="distance" className="whitespace-nowrap">
                    {formatDistanceChange(event)}
                  </TableCell>
                  <TableCell data-column="expected-before" className="text-right tabular-nums">
                    {formatExpectedStrokes(expectedStrokesForEvent(event, "start"))}
                  </TableCell>
                  <TableCell data-column="expected-after" className="text-right tabular-nums">
                    {formatExpectedStrokes(expectedStrokesForEvent(event, "end"))}
                  </TableCell>
                  <TableCell data-column="sg" className="text-right">
                    <SgValue value={event.strokesGained} />
                  </TableCell>
                  <TableCell data-column="status">
                    <StatusPill tone={event.strokesGained === null ? "amber" : "green"}>
                      {event.strokesGained === null ? "Pending" : "Calculated"}
                    </StatusPill>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  No event rows match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </DataTableFrame>
  );
}

function SgValue({ value, className }: { value: number | null; className?: string }) {
  return (
    <span className={cn("font-semibold tabular-nums", sgTextClassName(value), className)}>
      {formatSg(value)}
    </span>
  );
}

function heroDescription(
  analysis: ReturnType<typeof buildStrokesGainedAnalysis>,
  activeCategory: CategorySummary | null,
) {
  const eventText = `${integerFormatter.format(analysis.totals.sampleSize)} calculated events from ${integerFormatter.format(analysis.totals.sampleSize + analysis.pendingCount)} mapped shot events`;
  const roundText = pluralise(analysis.rounds.length, "round");

  if (activeCategory) {
    if (activeCategory.sampleSize === 0) {
      return `${activeCategory.label} cannot be judged yet because there are no calculated events. Measured against your expected-strokes baseline. Positive numbers gained value; negative numbers lost value.`;
    }

    const categoryResult =
      activeCategory.total !== null && activeCategory.total < 0
        ? `${activeCategory.label} is costing ${formatSg(activeCategory.total)} strokes.`
        : `${activeCategory.label} is gaining ${formatSg(activeCategory.total, "0.0")} strokes.`;

    return `${categoryResult} ${integerFormatter.format(activeCategory.sampleSize)} calculated events are mapped to this category, with ${integerFormatter.format(activeCategory.pendingCount)} pending or unmapped. Positive numbers gained value; negative numbers lost value.`;
  }

  if (!analysis.bestCategory) {
    return `Map shot-to-hole rounds to build a strokes-gained review. Measured against your expected-strokes baseline. ${eventText}.`;
  }

  if (analysis.weakestCategory?.total !== null && analysis.weakestCategory.total < 0) {
    return `${analysis.bestCategory.label} is carrying your scoring, but ${analysis.weakestCategory.label} is the main leak. You gained ${formatSg(analysis.totals.total, "0.0")} strokes across ${integerFormatter.format(analysis.totals.sampleSize)} calculated events. ${analysis.bestCategory.label} produced most of the gain, while ${analysis.weakestCategory.label} cost ${formatSg(analysis.weakestCategory.total)}. Positive numbers gained value; negative numbers lost value.`;
  }

  return `${analysis.bestCategory.label} is the clearest strength so far. No negative category has separated across ${eventText} and ${roundText}. Positive numbers gained value; negative numbers lost value.`;
}

function mobileHeroDescription(
  analysis: ReturnType<typeof buildStrokesGainedAnalysis>,
  activeCategory: CategorySummary | null,
) {
  if (activeCategory) {
    if (activeCategory.sampleSize === 0) {
      return `${activeCategory.label} does not yet have calculated events.`;
    }

    return activeCategory.total !== null && activeCategory.total < 0
      ? `${activeCategory.label} is costing ${formatSg(activeCategory.total)} strokes across ${integerFormatter.format(activeCategory.sampleSize)} calculated events.`
      : `${activeCategory.label} is gaining ${formatSg(activeCategory.total, "0.0")} strokes across ${integerFormatter.format(activeCategory.sampleSize)} calculated events.`;
  }

  if (!analysis.bestCategory) {
    return "Map shot-to-hole rounds to build this scoring review.";
  }

  if (analysis.weakestCategory?.total !== null && analysis.weakestCategory.total < 0) {
    return `${analysis.weakestCategory.label} is the main scoring leak; ${analysis.bestCategory.label} is the strongest phase.`;
  }

  return `${analysis.bestCategory.label} is the clearest strength; no negative phase has separated.`;
}

function heroMetrics(
  analysis: ReturnType<typeof buildStrokesGainedAnalysis>,
  totalEvents: number,
  activeCategory: CategorySummary | null,
) {
  if (activeCategory) {
    return [
      {
        label: `${activeCategory.label} SG`,
        value: formatSg(activeCategory.total, "No data"),
        detail: `${integerFormatter.format(activeCategory.sampleSize)} calculated from ${integerFormatter.format(activeCategory.eventCount)} mapped events`,
      },
      {
        label: "SG per event",
        value: formatSg(activeCategory.average, "No data"),
        detail: "Average across calculated shots",
      },
      {
        label: "Category role",
        value: categoryStatus(activeCategory, analysis.bestCategory, analysis.weakestCategory),
        detail: categoryRoleDetail(activeCategory),
      },
      {
        label: "Coverage",
        value: coveragePercentLabel(activeCategory.sampleSize, activeCategory.eventCount),
        detail: `${integerFormatter.format(activeCategory.pendingCount)} pending or unmapped`,
      },
    ];
  }

  return [
    {
      label: "Total SG",
      value: formatSg(analysis.totals.total, "No data"),
      detail: `Across ${integerFormatter.format(analysis.totals.sampleSize)} calculated events`,
    },
    {
      label: "SG per event",
      value: formatSg(analysis.totals.average, "No data"),
      detail: "Average across calculated shots",
    },
    {
      label: "Best category",
      value: analysis.bestCategory ? analysis.bestCategory.label : "No data",
      detail: analysis.bestCategory
        ? `${formatSg(analysis.bestCategory.total)} from ${integerFormatter.format(analysis.bestCategory.sampleSize)} events`
        : "Add mapped shot events",
    },
    {
      label: "Main leak",
      value: analysis.weakestCategory ? analysis.weakestCategory.label : "No data",
      detail: analysis.weakestCategory
        ? `${formatSg(analysis.weakestCategory.total)} from ${integerFormatter.format(analysis.weakestCategory.sampleSize)} events`
        : `${integerFormatter.format(totalEvents)} mapped events`,
    },
  ];
}

function scoringSignalLabel(value: number) {
  if (value < 0) return "Losing strokes";
  if (value > 0) return "Gaining strokes";
  return "Neutral";
}

function scoringSignalTone(value: number | null) {
  if (value === null) return "attention" as const;
  if (value < 0) return "critical" as const;
  if (value > 0) return "positive" as const;
  return "neutral" as const;
}

function categorySignalTone(category: CategorySummary, bestCategory: CategorySummary | null) {
  if (category.sampleSize === 0 || hasHighPendingCount(category)) {
    return "attention" as const;
  }

  if ((category.total ?? 0) < 0) {
    return "critical" as const;
  }

  if (bestCategory?.category === category.category || (category.total ?? 0) > 0) {
    return "positive" as const;
  }

  return "neutral" as const;
}

function categoryStatus(
  category: CategorySummary,
  bestCategory: CategorySummary | null,
  weakestCategory: CategorySummary | null,
) {
  if (category.sampleSize === 0) {
    return category.category === "putting" ? "Data gap" : "No calculated data";
  }

  if (
    weakestCategory?.category === category.category &&
    category.total !== null &&
    category.total < 0
  ) {
    return "Main scoring leak";
  }

  if (category.total !== null && category.total < 0) {
    return "Losing strokes";
  }

  if (bestCategory?.category === category.category) {
    return "Main strength";
  }

  if (category.total !== null && category.total > 0) {
    return "Supporting strength";
  }

  return "Neutral";
}

function categoryCardDetail(category: CategorySummary) {
  if (category.category === "putting" && category.sampleSize === 0) {
    return "No mapped putting events yet.";
  }

  if (category.eventCount === 0) {
    return "No mapped events yet.";
  }

  return `${integerFormatter.format(category.sampleSize)} calculated · ${formatSg(category.average, "No avg")} avg`;
}

function categoryRecommendation(category: CategorySummary) {
  if (category.category === "tee" && category.total !== null && category.total < 0) {
    return "Recommended: tee-shot boundary drill";
  }

  if (category.category === "approach" && category.total !== null && category.total > 0) {
    return "Strength: creating scoring value";
  }

  if (category.category === "short_game" && hasHighPendingCount(category)) {
    return "Caution: high pending count";
  }

  if (category.category === "putting" && category.sampleSize === 0) {
    return "Add putt distances to calculate putting SG.";
  }

  return practiceRecommendation(category.category);
}

function categoryRoleDetail(category: CategorySummary) {
  if (category.sampleSize === 0) {
    return category.category === "putting"
      ? "Add putt distances before judging this category"
      : "Needs mapped shot events";
  }

  if (category.pendingCount > 0) {
    return `${integerFormatter.format(category.pendingCount)} events still pending`;
  }

  return "Coverage is complete for mapped events";
}

function practiceRecommendation(category: string | undefined) {
  if (category === "tee") {
    return "Hit 10 driver or tee-club shots with a hard fairway boundary. Track start line, side miss, and whether the next shot is playable.";
  }

  if (category === "approach") {
    return "Build a 9-shot approach ladder from your common yardages. Score each shot by green, safe-side miss, and short-side miss.";
  }

  if (category === "short_game") {
    return "Practise 12 chips from one landing spot and one rough lie. Track shots inside 10 feet and the miss that leaves the next shot hardest.";
  }

  if (category === "putting") {
    return "Add first-putt distance and finish distance for each green, then practise 3, 6, and 10 foot start-line gates.";
  }

  return "Keep mapping complete rounds, then choose the lowest SG category as the first practice block.";
}

function roundSignal(
  rounds: RoundSummary[],
  bestCategory: CategorySummary | null,
  weakestCategory: CategorySummary | null,
  focusCategory: CategorySummary | null,
) {
  if (rounds.length === 0) {
    return "Round signal: map more rounds before reading a trend.";
  }

  if (focusCategory) {
    const positiveRounds = rounds.filter((round) => (round.total ?? 0) > 0).length;
    const negativeRounds = rounds.filter((round) => (round.total ?? 0) < 0).length;

    return `Round signal: ${focusCategory.label} is positive in ${integerFormatter.format(positiveRounds)} ${pluralise(positiveRounds, "round")} and negative in ${integerFormatter.format(negativeRounds)} ${pluralise(negativeRounds, "round")}.`;
  }

  if (
    bestCategory &&
    weakestCategory &&
    weakestCategory.total !== null &&
    weakestCategory.total < 0
  ) {
    return `Round signal: ${bestCategory.label} gains are carrying most positive rounds; ${weakestCategory.label} losses explain the main negative pressure.`;
  }

  if (bestCategory) {
    return `Round signal: ${bestCategory.label} is the clearest scoring engine across the mapped rounds.`;
  }

  return "Round signal: complete more mapped events to separate strength from leak.";
}

function roundCategoryLine(round: RoundSummary, focusCategory: CategorySummary | null) {
  const categories = round.categoryTotals.filter(
    (category) => !focusCategory || category.category === focusCategory.category,
  );

  if (categories.length === 0) {
    return "No category totals calculated yet.";
  }

  return categories
    .map((category) => `${category.label} ${formatSg(category.total, "no data")}`)
    .join(" · ");
}

function SgHorizontalBar({ value, maxAbs }: { value: number | null; maxAbs: number }) {
  const width = value === null ? 0 : Math.max(6, Math.min(100, (Math.abs(value) / maxAbs) * 100));

  return (
    <div className="grid h-3 grid-cols-2 overflow-hidden rounded-full border border-border bg-secondary">
      <div className="flex items-center justify-end border-r border-slate-500">
        {value !== null && value < 0 ? (
          <span className="h-full rounded-l-full bg-[#B42318]" style={{ width: `${width}%` }} />
        ) : null}
      </div>
      <div className="flex items-center justify-start">
        {value !== null && value >= 0 ? (
          <span className="h-full rounded-r-full bg-[#087A3D]" style={{ width: `${width}%` }} />
        ) : null}
      </div>
    </div>
  );
}

function SgMiniBar({ value, maxAbs }: { value: number | null; maxAbs: number }) {
  const width = value === null ? 0 : Math.max(6, Math.min(100, (Math.abs(value) / maxAbs) * 100));

  return (
    <div className="grid h-2 grid-cols-2 overflow-hidden rounded-full bg-slate-100">
      <div className="flex justify-end border-r border-slate-400">
        {value !== null && value < 0 ? (
          <span className="h-full rounded-l-full bg-[#B42318]" style={{ width: `${width}%` }} />
        ) : null}
      </div>
      <div className="flex justify-start">
        {value !== null && value >= 0 ? (
          <span className="h-full rounded-r-full bg-[#087A3D]" style={{ width: `${width}%` }} />
        ) : null}
      </div>
    </div>
  );
}

function shotCostNote(event: StrokesGainedEvent) {
  if (event.strokesGained === null || event.strokesGained >= 0) {
    return null;
  }

  if (event.penaltyStrokes > 0) {
    return "Likely cost: penalty stroke added scoring pressure.";
  }

  if (event.endLie === "rough") {
    return "Likely cost: rough finish reduced next-shot value.";
  }

  if (
    typeof event.startDistanceYd === "number" &&
    typeof event.endDistanceYd === "number" &&
    event.endDistanceYd >= event.startDistanceYd
  ) {
    return "Likely cost: next-shot position did not improve enough.";
  }

  if (event.endLie === "fairway") {
    return "Likely cost: weaker next-shot position.";
  }

  return "Likely cost: next-shot position lost value.";
}

function hasHighPendingCount(category: CategorySummary) {
  return (
    category.pendingCount >= 10 && category.pendingCount >= Math.max(1, category.sampleSize * 0.5)
  );
}

function coveragePercentLabel(sampleSize: number, eventCount: number) {
  if (eventCount === 0) {
    return "0%";
  }

  return `${integerFormatter.format(Math.round((sampleSize / eventCount) * 100))}%`;
}

function buildFilterOptions(events: StrokesGainedEvent[]): FilterOptions {
  const sessionMap = new Map<string, { id: string; label: string; date: Date }>();

  for (const event of events) {
    sessionMap.set(event.sessionId, {
      id: event.sessionId,
      label: `${event.courseName ?? "Mapped round"} - ${formatDate(event.sessionDate)}`,
      date: event.sessionDate,
    });
  }

  const categorySet = new Set(events.map((event) => event.category));
  const categories = [...CATEGORY_DEFINITIONS]
    .filter(
      (definition) => categorySet.has(definition.category) || definition.category === "putting",
    )
    .map((definition) => ({ value: definition.category, label: definition.label }));
  const extraCategories = [...categorySet]
    .filter(
      (category) => !CATEGORY_DEFINITIONS.some((definition) => definition.category === category),
    )
    .sort()
    .map((category) => ({ value: category, label: titleCase(category) }));

  return {
    sessions: [...sessionMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime()),
    categories: [...categories, ...extraCategories],
    holes: [...new Set(events.map((event) => event.holeNumber).filter(isFiniteNumber))].sort(
      (a, b) => a - b,
    ),
    startLies: sortLies([...new Set(events.map((event) => event.startLie).filter(Boolean))]),
    endLies: sortLies([
      ...new Set(events.map((event) => event.endLie).filter((lie): lie is string => Boolean(lie))),
    ]),
  };
}

function filterEvents(events: StrokesGainedEvent[], filters: StrokesGainedFilters) {
  const filtered = events.filter((event) => {
    if (filters.sessionId && event.sessionId !== filters.sessionId) return false;
    if (filters.category && event.category !== filters.category) return false;
    if (filters.hole && event.holeNumber?.toString() !== filters.hole) return false;
    if (filters.startLie && event.startLie !== filters.startLie) return false;
    if (filters.endLie && event.endLie !== filters.endLie) return false;
    if (filters.from && event.sessionDate < new Date(`${filters.from}T00:00:00.000Z`)) return false;
    if (filters.to && event.sessionDate > new Date(`${filters.to}T23:59:59.999Z`)) return false;
    if (filters.sg === "gain" && (event.strokesGained === null || event.strokesGained <= 0))
      return false;
    if (filters.sg === "loss" && (event.strokesGained === null || event.strokesGained >= 0))
      return false;
    if (filters.sg === "pending" && event.strokesGained !== null) return false;

    return true;
  });

  return filtered.sort((a, b) => compareEvents(a, b, filters.sort));
}

function compareEvents(a: StrokesGainedEvent, b: StrokesGainedEvent, sort: SortMode) {
  if (sort === "gains") {
    return nullableDescending(a.strokesGained, b.strokesGained);
  }

  if (sort === "losses") {
    return nullableAscending(a.strokesGained, b.strokesGained);
  }

  if (sort === "hole") {
    return (
      (a.holeNumber ?? 99) - (b.holeNumber ?? 99) ||
      (a.strokeNumber ?? 99) - (b.strokeNumber ?? 99) ||
      b.sessionDate.getTime() - a.sessionDate.getTime()
    );
  }

  if (sort === "category") {
    return (
      titleCase(a.category).localeCompare(titleCase(b.category)) ||
      nullableAscending(a.strokesGained, b.strokesGained)
    );
  }

  return b.createdAt.getTime() - a.createdAt.getTime();
}

function parseFilters(params: Awaited<SearchParams>): StrokesGainedFilters {
  const sort = first(params.sort);
  const sg = first(params.sg);

  return {
    sessionId: uuidParam(first(params.sessionId)),
    category: first(params.category),
    hole: integerParam(first(params.hole)),
    startLie: first(params.startLie),
    endLie: first(params.endLie),
    from: dateParam(first(params.from)),
    to: dateParam(first(params.to)),
    sg: SG_RESULT_FILTERS.includes(sg as SgResultFilter) ? (sg as SgResultFilter) : "",
    sort: SORT_MODES.includes(sort as SortMode) ? (sort as SortMode) : "recent",
  };
}

function buildActiveFilterChips(
  filters: StrokesGainedFilters,
  sessions: FilterOptions["sessions"],
) {
  const chips: Array<{ label: string; href: string }> = [];
  const session = sessions.find((option) => option.id === filters.sessionId);

  if (filters.sessionId)
    chips.push({ label: `${session?.label ?? "Round"} x`, href: filterHref(filters, "sessionId") });
  if (filters.category)
    chips.push({
      label: `${titleCase(filters.category)} x`,
      href: filterHref(filters, "category"),
    });
  if (filters.hole)
    chips.push({ label: `Hole ${filters.hole} x`, href: filterHref(filters, "hole") });
  if (filters.startLie)
    chips.push({
      label: `Start ${titleCase(filters.startLie)} x`,
      href: filterHref(filters, "startLie"),
    });
  if (filters.endLie)
    chips.push({
      label: `End ${titleCase(filters.endLie)} x`,
      href: filterHref(filters, "endLie"),
    });
  if (filters.sg)
    chips.push({ label: `${sgResultLabel(filters.sg)} x`, href: filterHref(filters, "sg") });
  if (filters.from)
    chips.push({ label: `From ${filters.from} x`, href: filterHref(filters, "from") });
  if (filters.to) chips.push({ label: `To ${filters.to} x`, href: filterHref(filters, "to") });
  if (filters.sort !== "recent")
    chips.push({ label: `${sortLabel(filters.sort)} x`, href: filterHref(filters, "sort") });

  return chips;
}

function filterHref(filters: StrokesGainedFilters, omitKey: keyof StrokesGainedFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (key === omitKey || !value || (key === "sort" && value === "recent")) continue;
    params.set(key, value.toString());
  }

  const query = params.toString();
  return query ? `/strokes-gained?${query}#events` : "/strokes-gained#events";
}

function shortcutHref(filters: Partial<StrokesGainedFilters>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value.toString());
  }

  const query = params.toString();
  return query ? `/strokes-gained?${query}#events` : "/strokes-gained#events";
}

function sgResultLabel(value: SgResultFilter) {
  if (value === "gain") return "Gains only";
  if (value === "loss") return "Losses only";
  if (value === "pending") return "Not calculated";
  return "All SG results";
}

function sortLabel(value: SortMode) {
  if (value === "gains") return "Biggest gains";
  if (value === "losses") return "Biggest losses";
  if (value === "hole") return "By hole";
  if (value === "category") return "By category";
  return "Most recent";
}

function descendingTotal(a: { total: number | null }, b: { total: number | null }) {
  return nullableDescending(a.total, b.total);
}

function ascendingTotal(a: { total: number | null }, b: { total: number | null }) {
  return nullableAscending(a.total, b.total);
}

function nullableDescending(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function nullableAscending(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function formatSg(value: number | null, fallback = "Not calculated") {
  return typeof value === "number" ? signedSgFormatter.format(value) : fallback;
}

function formatNumber(value: number | null) {
  return typeof value === "number" ? numberFormatter.format(value) : "--";
}

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function formatPosition(distanceYd: number | null, lie: string | null) {
  if (lie === "holed") {
    return "Holed";
  }

  if (typeof distanceYd !== "number") {
    return lie ? `${titleCase(lie)} distance pending` : "Position pending";
  }

  return `${formatNumber(distanceYd)} yd ${titleCase(lie ?? "unknown")}`;
}

function formatDistanceChange(event: StrokesGainedEvent) {
  if (typeof event.startDistanceYd !== "number" || typeof event.endDistanceYd !== "number") {
    return "Distance pending";
  }

  if (event.endLie === "holed") {
    return "Holed";
  }

  const change = roundOne(event.startDistanceYd - event.endDistanceYd);

  if (change > 0) {
    return `${formatNumber(change)} yd closer`;
  }

  if (change < 0) {
    return `${formatNumber(Math.abs(change))} yd farther`;
  }

  return "No change";
}

function expectedStrokesForEvent(event: StrokesGainedEvent, position: "start" | "end") {
  const lie = position === "start" ? event.startLie : event.endLie;
  const distanceYd = position === "start" ? event.startDistanceYd : event.endDistanceYd;

  if (!lie || typeof distanceYd !== "number") {
    return null;
  }

  const category =
    position === "start" ? event.category : categoryForLieAndDistance(lie, distanceYd);
  const bucket = DEFAULT_STROKES_GAINED_BASELINE_BUCKETS.find(
    (candidate) =>
      candidate.category === category &&
      candidate.lie === lie &&
      distanceYd >= candidate.distanceStartYd &&
      distanceYd <= candidate.distanceEndYd,
  );

  return bucket?.expectedStrokes ?? null;
}

function categoryForLieAndDistance(lie: string, distanceYd: number) {
  if (lie === "green" || lie === "holed") {
    return "putting";
  }

  if (distanceYd <= 100) {
    return "short_game";
  }

  return "approach";
}

function formatExpectedStrokes(value: number | null) {
  return typeof value === "number" ? numberFormatter.format(value) : "Pending";
}

function holeShotLabel(event: StrokesGainedEvent) {
  return `Hole ${event.holeNumber ?? "?"} / Shot ${event.strokeNumber ?? "?"}`;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function toneForSg(value: number | null) {
  if (value === null) return "slate" as const;
  if (value < 0) return "pink" as const;
  if (value > 0) return "green" as const;
  return "slate" as const;
}

function sgTextClassName(value: number | null) {
  if (value === null) return "text-muted-foreground";
  if (value < 0) return "text-[#B42318] dark:text-red-300";
  if (value > 0) return "text-[#087A3D] dark:text-emerald-300";
  return "text-muted-foreground";
}

function categoryCardClassName(category: CategorySummary) {
  if (category.category === "putting" && category.sampleSize === 0) {
    return "border-slate-200 bg-slate-50/80";
  }

  if (hasHighPendingCount(category)) {
    return "border-amber-200 bg-amber-50/35";
  }

  if (category.total === null) return "border-slate-200 bg-white";
  if (category.total < 0) return "border-red-200 bg-red-50/35";
  if (category.total > 0) return "border-emerald-200 bg-emerald-50/35";
  return "border-slate-200 bg-white";
}

function categoryIconClassName(category: CategorySummary) {
  if (category.category === "putting" && category.sampleSize === 0) {
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }

  if (hasHighPendingCount(category)) {
    return "bg-amber-50 text-amber-800 ring-amber-100";
  }

  if (category.total === null) return "bg-slate-100 text-slate-600 ring-slate-200";
  if (category.total < 0) return "bg-red-50 text-[#B42318] ring-red-100";
  if (category.total > 0) return "bg-emerald-50 text-[#087A3D] ring-emerald-100";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function dateParam(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function integerParam(value: string) {
  return /^\d+$/.test(value) ? value : "";
}

function uuidParam(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : "";
}

function pluralise(count: number, singular: string) {
  return `${integerFormatter.format(count)} ${count === 1 ? singular : `${singular}s`}`;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sortLies(values: string[]) {
  return values.sort((a, b) => {
    const indexA = LIE_ORDER.indexOf(a);
    const indexB = LIE_ORDER.indexOf(b);

    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}
