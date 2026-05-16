import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  ChevronDown,
  Flag,
  ListFilter,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  ActiveFilterChips,
  DataPanel,
  DataPair,
  DataTableFrame,
  MobileBentoSummary,
  MobileDataCard,
  MobileDataList,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sessions, strokesGainedShotEvents } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { summarizeStrokesGained } from "@/lib/strokes-gained";
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

export default async function StrokesGainedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = parseFilters(await searchParams);
  const data = await getStrokesGainedData();
  const analysis = buildStrokesGainedAnalysis(data.events);
  const filteredEvents = filterEvents(data.events, filters);
  const filterOptions = buildFilterOptions(data.events);
  const activeFilterChips = buildActiveFilterChips(filters, filterOptions.sessions);

  return (
    <PageShell size="7xl">
      <MobileRouteHeader title="Dashboard" group="dashboard" activeKey="strokes" />

      <div className="hidden items-center justify-between gap-4 sm:flex">
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
        title="Strokes gained"
        description={heroDescription(analysis)}
        metrics={[
          {
            label: "Total SG",
            value: formatSg(analysis.totals.total, "No data"),
            detail: `${integerFormatter.format(analysis.totals.sampleSize)} of ${integerFormatter.format(data.events.length)} events calculated`,
          },
          {
            label: "SG per event",
            value: formatSg(analysis.totals.average, "No data"),
            detail: "Average across calculated shot events",
          },
          {
            label: "Best category",
            value: analysis.bestCategory ? analysis.bestCategory.label : "No data",
            detail: analysis.bestCategory
              ? `${formatSg(analysis.bestCategory.total)} from ${integerFormatter.format(analysis.bestCategory.sampleSize)} events`
              : "Add mapped shot events",
          },
          {
            label: "Weakest category",
            value: analysis.weakestCategory ? analysis.weakestCategory.label : "No data",
            detail: analysis.weakestCategory
              ? `${formatSg(analysis.weakestCategory.total)} from ${integerFormatter.format(analysis.weakestCategory.sampleSize)} events`
              : "No scoring leak yet",
          },
        ]}
      />

      <MobileBentoSummary
        items={[
          {
            label: "Total SG",
            value: formatSg(analysis.totals.total, "No data"),
            detail: `${integerFormatter.format(analysis.rounds.length)} rounds - ${integerFormatter.format(data.events.length)} events`,
            tone: toneForSg(analysis.totals.total),
          },
          {
            label: "SG/event",
            value: formatSg(analysis.totals.average, "No data"),
            detail: "Calculated average",
            tone: toneForSg(analysis.totals.average),
          },
          {
            label: "Best",
            value: analysis.bestCategory?.label ?? "No data",
            detail: analysis.bestCategory ? formatSg(analysis.bestCategory.total) : "Need events",
            tone: toneForSg(analysis.bestCategory?.total ?? null),
          },
          {
            label: "Weakest",
            value: analysis.weakestCategory?.label ?? "No data",
            detail: analysis.weakestCategory ? formatSg(analysis.weakestCategory.total) : "No leak",
            tone: toneForSg(analysis.weakestCategory?.total ?? null),
          },
        ]}
      />

      <CategoryCards categories={analysis.categories} bestCategory={analysis.bestCategory} />

      <CategoryBreakdown
        categories={analysis.categories}
        total={analysis.totals.total}
        categoryTotal={analysis.categoryTotal}
        pendingCount={analysis.pendingCount}
      />

      <MainScoringLeak summary={analysis.weakestCategory} events={data.events} />

      <ShotHighlights gains={analysis.biggestGains} losses={analysis.biggestLosses} />

      <section className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
        <RoundTrendPanel rounds={analysis.rounds} />
        <HoleImpactPanel holes={analysis.holes} />
      </section>

      <RecentShotEventsPanel
        events={filteredEvents}
        totalEvents={data.events.length}
        filters={filters}
        filterOptions={filterOptions}
        activeFilterChips={activeFilterChips}
      />
    </PageShell>
  );
}

async function getStrokesGainedData() {
  const userId = await requireCurrentUserId();
  const db = getDb();
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
    .where(eq(strokesGainedShotEvents.userId, userId))
    .orderBy(desc(strokesGainedShotEvents.createdAt))
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
    biggestGains: [...finiteEvents].sort((a, b) => (b.strokesGained ?? 0) - (a.strokesGained ?? 0)).slice(0, 3),
    biggestLosses: [...finiteEvents].sort((a, b) => (a.strokesGained ?? 0) - (b.strokesGained ?? 0)).slice(0, 3),
  };
}

function buildCategorySummaries(events: StrokesGainedEvent[]) {
  const categoryDefinitions = [...CATEGORY_DEFINITIONS];
  const knownCategorySet = new Set<string>(categoryDefinitions.map((definition) => definition.category));
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

      return {
        holeNumber,
        eventCount: holeEvents.length,
        total: summary.total,
        average: summary.average,
        sampleSize: summary.sampleSize,
      };
    })
    .filter((summary) => summary.sampleSize > 0);
}

function CategoryCards({
  categories,
  bestCategory,
}: {
  categories: CategorySummary[];
  bestCategory: CategorySummary | null;
}) {
  const overallCards = (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {categories.map((category) => (
        <CategoryCard
          key={category.category}
          category={category}
          bestCategory={bestCategory}
        />
      ))}
    </section>
  );

  return (
    <Tabs defaultValue="overall" className="gap-3">
      <TabsList className="max-w-full overflow-x-auto" variant="line">
        <TabsTrigger value="overall">Overall</TabsTrigger>
        {categories.map((category) => (
          <TabsTrigger key={category.category} value={category.category}>
            {category.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="overall">{overallCards}</TabsContent>
      {categories.map((category) => (
        <TabsContent key={category.category} value={category.category}>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CategoryCard category={category} bestCategory={bestCategory} />
            <Card className="premium-card sm:col-span-1 xl:col-span-3">
              <CardContent className="grid gap-3">
                <p className="text-sm font-semibold">
                  {category.coachingLabel}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {category.eventCount > 0
                    ? `${integerFormatter.format(category.sampleSize)} calculated events and ${integerFormatter.format(category.pendingCount)} pending events are currently mapped to this category.`
                    : "Map round shots into this category to build a strokes-gained readout."}
                </p>
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CategoryCard({
  category,
  bestCategory,
}: {
  category: CategorySummary;
  bestCategory: CategorySummary | null;
}) {
  return (
    <Card
      className={cn(
        "premium-card grid min-h-40 content-between gap-4 border p-4",
        categoryCardClassName(category.total),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{category.label}</p>
          <p className={cn("mt-2 text-3xl font-semibold tracking-normal tabular-nums", sgTextClassName(category.total))}>
            {formatSg(category.total, "No data")}
          </p>
        </div>
        <div
          className={cn(
            "grid size-9 place-items-center rounded-md ring-1",
            categoryIconClassName(category.total),
          )}
        >
          <Target className="size-5" />
        </div>
      </div>
      <div className="space-y-1">
        <p className={cn("text-sm font-semibold", sgTextClassName(category.total))}>
          {categoryStatus(category, bestCategory)}
        </p>
        <p className="text-sm leading-5 text-muted-foreground">
          {category.eventCount > 0
            ? `${integerFormatter.format(category.eventCount)} events - ${formatSg(category.average, "No avg")} avg`
            : category.category === "putting"
              ? "Add putt distances to calculate putting SG"
              : "No mapped events yet"}
        </p>
        {category.pendingCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {integerFormatter.format(category.pendingCount)} pending or unmapped
          </p>
        ) : null}
      </div>
    </Card>
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
  const maxAbsTotal = Math.max(
    1,
    ...categories.map((category) => Math.abs(category.total ?? 0)),
  );
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
        description="Where the mapped shot events are gaining and losing value against the expected-strokes baseline."
        action={<BarChart3 className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid gap-4">
        <div className="grid gap-3">
          {categories.map((category) => (
            <CategoryBarRow key={category.category} category={category} maxAbsTotal={maxAbsTotal} />
          ))}
        </div>
        <div className="grid gap-2 border-t border-slate-200 pt-3 text-sm text-muted-foreground sm:grid-cols-3">
          <DataPair label="Calculated events" value={`${integerFormatter.format(categories.reduce((sum, category) => sum + category.sampleSize, 0))}`} />
          <DataPair label="Pending events" value={integerFormatter.format(pendingCount)} />
          <DataPair
            label="Category sum"
            value={categorySumLabel}
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
  const width = total === null ? 0 : Math.max(4, Math.min(100, (Math.abs(total) / maxAbsTotal) * 100));

  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_5rem] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">{category.label}</p>
        <p className="text-xs text-muted-foreground">
          {category.sampleSize > 0
            ? `${integerFormatter.format(category.sampleSize)} calculated`
            : "No calculated events"}
        </p>
      </div>
      <div className="grid h-8 grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        <div className="flex items-center justify-end border-r border-slate-300">
          {total !== null && total < 0 ? (
            <span
              className="h-full rounded-l-md bg-[#B42318]"
              style={{ width: `${width}%` }}
            />
          ) : null}
        </div>
        <div className="flex items-center justify-start">
          {total !== null && total >= 0 ? (
            <span
              className="h-full rounded-r-md bg-[#087A3D]"
              style={{ width: `${width}%` }}
            />
          ) : null}
        </div>
      </div>
      <p className={cn("text-right text-sm font-semibold tabular-nums", sgTextClassName(total))}>
        {formatSg(total, "No data")}
      </p>
    </div>
  );
}

function MainScoringLeak({
  summary,
  events,
}: {
  summary: CategorySummary | null;
  events: StrokesGainedEvent[];
}) {
  const leakEvents = summary ? events.filter((event) => event.category === summary.category) : [];
  const hasLeak = summary !== null && summary.total !== null && summary.total < 0;
  const roughCount = leakEvents.filter((event) => event.endLie === "rough").length;
  const penaltyCount = leakEvents.filter((event) => event.penaltyStrokes > 0).length;
  const lossCount = leakEvents.filter((event) => typeof event.strokesGained === "number" && event.strokesGained < 0).length;

  return (
    <DataPanel>
      <SectionHeader
        title="Main scoring leak"
        description="The weakest category translated into practice priority."
        action={<AlertTriangle className={cn("size-5", hasLeak ? "text-[#B42318]" : "text-emerald-700")} />}
      />
      <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="soft-panel p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Verdict
          </p>
          <p className="mt-2 text-xl font-semibold tracking-normal text-slate-950">
            {hasLeak && summary
              ? `${summary.label} shots are costing ${formatSg(summary.total)}.`
              : "No negative category has separated yet."}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {hasLeak && summary
              ? `${summary.eventCount} events analysed with a ${formatSg(summary.average, "No avg")} category average.`
              : "Keep mapping complete rounds so the next scoring leak is based on enough calculated events."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-950">Likely causes</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-muted-foreground">
              {summary ? (
                <>
                  <li>{integerFormatter.format(summary.eventCount)} {summary.label.toLowerCase()} events in the sample</li>
                  <li>{integerFormatter.format(lossCount)} calculated losing shots</li>
                  {roughCount > 0 ? <li>{integerFormatter.format(roughCount)} finished in rough</li> : null}
                  {penaltyCount > 0 ? <li>{integerFormatter.format(penaltyCount)} included penalty strokes</li> : null}
                  {summary.pendingCount > 0 ? <li>{integerFormatter.format(summary.pendingCount)} pending or unmapped</li> : null}
                </>
              ) : (
                <li>Add mapped shot events to identify the category causing damage.</li>
              )}
            </ul>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-950">Recommended practice</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {practiceRecommendation(summary?.category)}
            </p>
          </div>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function ShotHighlights({
  gains,
  losses,
}: {
  gains: StrokesGainedEvent[];
  losses: StrokesGainedEvent[];
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ShotHighlightPanel
        title="Biggest gains"
        description="The shots that created the most scoring value."
        events={gains}
        icon={<TrendingUp className="size-5 text-[#087A3D]" />}
      />
      <ShotHighlightPanel
        title="Biggest losses"
        description="The shots that hurt the card most."
        events={losses}
        icon={<TrendingDown className="size-5 text-[#B42318]" />}
      />
    </section>
  );
}

function ShotHighlightPanel({
  title,
  description,
  events,
  icon,
}: {
  title: string;
  description: string;
  events: StrokesGainedEvent[];
  icon: React.ReactNode;
}) {
  return (
    <DataPanel>
      <SectionHeader title={title} description={description} action={icon} />
      <CardContent>
        <MobileDataList
          className="gap-2"
          empty={<p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No calculated shot events yet.</p>}
        >
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/rounds/${event.sessionId}`}
              prefetch={false}
              className="block rounded-md border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {titleCase(event.category)} - Hole {event.holeNumber ?? "?"}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {formatPosition(event.startDistanceYd, event.startLie)} -&gt; {formatPosition(event.endDistanceYd, event.endLie)}
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

function RoundTrendPanel({ rounds }: { rounds: RoundSummary[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="SG trend by round"
        description={rounds.length > 0 ? `Latest ${Math.min(6, rounds.length)} of ${integerFormatter.format(rounds.length)} mapped rounds.` : "No mapped rounds yet."}
        action={<Flag className="size-5 text-emerald-700" />}
      />
      <CardContent>
        <div className="grid gap-3">
          {rounds.slice(0, 6).map((round) => (
            <Link
              key={round.sessionId}
              href={`/rounds/${round.sessionId}`}
              prefetch={false}
              className="rounded-md border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {round.courseName ?? "Mapped round"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(round.sessionDate)}</p>
                </div>
                <SgValue value={round.total} className="text-lg" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {round.categoryTotals.map((category) => (
                  <StatusPill key={category.category} tone={toneForSg(category.total)}>
                    {category.label} {formatSg(category.total, "No data")}
                  </StatusPill>
                ))}
              </div>
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

function HoleImpactPanel({ holes }: { holes: HoleSummary[] }) {
  const bestHoles = [...holes].sort(descendingTotal).slice(0, 3);
  const costliestHoles = [...holes].sort(ascendingTotal).slice(0, 3);

  return (
    <DataPanel>
      <SectionHeader
        title="Hole impact"
        description="Best and costliest holes from the calculated events."
        action={<Target className="size-5 text-emerald-700" />}
      />
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <HoleImpactList title="Best holes" holes={bestHoles} />
        <HoleImpactList title="Costliest holes" holes={costliestHoles} />
      </CardContent>
    </DataPanel>
  );
}

function HoleImpactList({
  title,
  holes,
}: {
  title: string;
  holes: HoleSummary[];
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <div className="mt-2 grid gap-2">
        {holes.length > 0 ? (
          holes.map((hole) => (
            <div key={hole.holeNumber} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Hole {hole.holeNumber}</span>
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
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-base font-semibold tracking-normal sm:text-lg">
              Recent shot events
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {integerFormatter.format(events.length)} matching rows from {integerFormatter.format(totalEvents)} mapped events.
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <ListFilter className="size-4" />
            Expand table
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <CardContent className="grid gap-4 border-t border-slate-200">
          <QuickFilters />
          <StrokesGainedFilterForm filters={filters} options={filterOptions} />
          {activeFilterChips.length > 0 ? <ActiveFilterChips items={activeFilterChips} /> : null}
          <StrokesGainedEventTable events={events} />
        </CardContent>
      </details>
    </DataPanel>
  );
}

function QuickFilters() {
  const shortcuts = [
    { label: "Worst tee shots", href: shortcutHref({ category: "tee", sg: "loss", sort: "losses" }) },
    { label: "Best approach shots", href: shortcutHref({ category: "approach", sg: "gain", sort: "gains" }) },
    { label: "Short-game saves", href: shortcutHref({ category: "short_game", sg: "gain", sort: "gains" }) },
    { label: "Shots to rough", href: shortcutHref({ endLie: "rough", sort: "losses" }) },
    { label: "Holed shots", href: shortcutHref({ endLie: "holed", sort: "gains" }) },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {shortcuts.map((shortcut) => (
        <Button key={shortcut.label} asChild variant="outline" size="sm">
          <Link href={shortcut.href} prefetch={false}>{shortcut.label}</Link>
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
  const inputClassName = "rounded-lg border bg-white/90 px-3 py-2 text-sm";

  return (
    <form method="get" className="apple-panel grid gap-3 p-3 md:grid-cols-3 xl:grid-cols-6">
      <label className="grid gap-1 text-sm font-medium">
        Round
        <select name="sessionId" defaultValue={filters.sessionId} className={inputClassName}>
          <option value="">All rounds</option>
          {options.sessions.map((session) => (
            <option key={session.id} value={session.id}>{session.label}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Category
        <select name="category" defaultValue={filters.category} className={inputClassName}>
          <option value="">All categories</option>
          {options.categories.map((category) => (
            <option key={category.value} value={category.value}>{category.label}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Hole
        <select name="hole" defaultValue={filters.hole} className={inputClassName}>
          <option value="">All holes</option>
          {options.holes.map((hole) => (
            <option key={hole} value={hole.toString()}>Hole {hole}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Start lie
        <select name="startLie" defaultValue={filters.startLie} className={inputClassName}>
          <option value="">Any start lie</option>
          {options.startLies.map((lie) => (
            <option key={lie} value={lie}>{titleCase(lie)}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        End lie
        <select name="endLie" defaultValue={filters.endLie} className={inputClassName}>
          <option value="">Any end lie</option>
          {options.endLies.map((lie) => (
            <option key={lie} value={lie}>{titleCase(lie)}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        SG result
        <select name="sg" defaultValue={filters.sg} className={inputClassName}>
          <option value="">All SG results</option>
          <option value="gain">Gains only</option>
          <option value="loss">Losses only</option>
          <option value="pending">Not calculated</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        From
        <input type="date" name="from" defaultValue={filters.from} className={inputClassName} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        To
        <input type="date" name="to" defaultValue={filters.to} className={inputClassName} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Sort
        <select name="sort" defaultValue={filters.sort} className={inputClassName}>
          <option value="recent">Most recent</option>
          <option value="gains">Biggest gains</option>
          <option value="losses">Biggest losses</option>
          <option value="hole">By hole</option>
          <option value="category">By category</option>
        </select>
      </label>
      <div className="flex items-end gap-2 md:col-span-3 xl:col-span-6">
        <Button type="submit">Apply filters</Button>
        <Button asChild variant="outline">
          <Link href="/strokes-gained#events" prefetch={false}>Reset</Link>
        </Button>
      </div>
    </form>
  );
}

function StrokesGainedEventTable({ events }: { events: StrokesGainedEvent[] }) {
  return (
    <DataTableFrame
      mobile={
        <MobileDataList empty={<p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No event rows match these filters.</p>}>
          {events.map((event) => (
            <MobileDataCard
              key={event.id}
              title={`${titleCase(event.category)} - ${holeShotLabel(event)}`}
              subtitle={`${event.courseName ?? "Round"} - ${formatDate(event.sessionDate)}`}
              href={`/rounds/${event.sessionId}`}
              action={<SgValue value={event.strokesGained} />}
            >
              <DataPair label="Start" value={formatPosition(event.startDistanceYd, event.startLie)} />
              <DataPair label="End" value={formatPosition(event.endDistanceYd, event.endLie)} />
              <DataPair label="Distance change" value={formatDistanceChange(event)} />
            </MobileDataCard>
          ))}
        </MobileDataList>
      }
    >
      <div className="max-h-[560px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-white">Round</TableHead>
              <TableHead className="sticky top-0 z-10 bg-white">Date</TableHead>
              <TableHead className="sticky top-0 z-10 bg-white">Hole / shot</TableHead>
              <TableHead className="sticky top-0 z-10 bg-white">Category</TableHead>
              <TableHead className="sticky top-0 z-10 bg-white">Start position</TableHead>
              <TableHead className="sticky top-0 z-10 bg-white">End position</TableHead>
              <TableHead className="sticky top-0 z-10 bg-white">Distance change</TableHead>
              <TableHead className="sticky top-0 z-10 bg-white text-right">SG</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length > 0 ? (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="min-w-48">
                    <Link href={`/rounds/${event.sessionId}`} className="font-medium text-emerald-700 hover:underline">
                      {event.courseName ?? "Round"}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(event.sessionDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">{holeShotLabel(event)}</TableCell>
                  <TableCell>{titleCase(event.category)}</TableCell>
                  <TableCell className="min-w-44">{formatPosition(event.startDistanceYd, event.startLie)}</TableCell>
                  <TableCell className="min-w-44">{formatPosition(event.endDistanceYd, event.endLie)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDistanceChange(event)}</TableCell>
                  <TableCell className="text-right">
                    <SgValue value={event.strokesGained} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
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

function SgValue({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  return (
    <span className={cn("font-semibold tabular-nums", sgTextClassName(value), className)}>
      {formatSg(value)}
    </span>
  );
}

function heroDescription(analysis: ReturnType<typeof buildStrokesGainedAnalysis>) {
  const eventText = `${integerFormatter.format(analysis.totals.sampleSize)} calculated events from ${integerFormatter.format(analysis.totals.sampleSize + analysis.pendingCount)} mapped shot events`;
  const roundText = pluralise(analysis.rounds.length, "round");

  if (!analysis.bestCategory) {
    return `Map shot-to-hole rounds to build a strokes-gained review. Expected-strokes baseline - ${eventText}.`;
  }

  if (analysis.weakestCategory?.total !== null && analysis.weakestCategory.total < 0) {
    return `${analysis.bestCategory.label} is carrying your scoring. ${analysis.weakestCategory.label} shots are the main leak. ${eventText} - Expected-strokes baseline - ${roundText}.`;
  }

  return `${analysis.bestCategory.label} is the clearest strength so far. No negative category has separated. ${eventText} - Expected-strokes baseline - ${roundText}.`;
}

function categoryStatus(category: CategorySummary, bestCategory: CategorySummary | null) {
  if (category.sampleSize === 0) {
    return category.category === "putting" ? "No mapped putting events yet" : "No calculated data";
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
    .filter((definition) => categorySet.has(definition.category) || definition.category === "putting")
    .map((definition) => ({ value: definition.category, label: definition.label }));
  const extraCategories = [...categorySet]
    .filter((category) => !CATEGORY_DEFINITIONS.some((definition) => definition.category === category))
    .sort()
    .map((category) => ({ value: category, label: titleCase(category) }));

  return {
    sessions: [...sessionMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime()),
    categories: [...categories, ...extraCategories],
    holes: [...new Set(events.map((event) => event.holeNumber).filter(isFiniteNumber))].sort((a, b) => a - b),
    startLies: sortLies([...new Set(events.map((event) => event.startLie).filter(Boolean))]),
    endLies: sortLies([...new Set(events.map((event) => event.endLie).filter((lie): lie is string => Boolean(lie)))]),
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
    if (filters.sg === "gain" && (event.strokesGained === null || event.strokesGained <= 0)) return false;
    if (filters.sg === "loss" && (event.strokesGained === null || event.strokesGained >= 0)) return false;
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
    sessionId: first(params.sessionId),
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

  if (filters.sessionId) chips.push({ label: `${session?.label ?? "Round"} x`, href: filterHref(filters, "sessionId") });
  if (filters.category) chips.push({ label: `${titleCase(filters.category)} x`, href: filterHref(filters, "category") });
  if (filters.hole) chips.push({ label: `Hole ${filters.hole} x`, href: filterHref(filters, "hole") });
  if (filters.startLie) chips.push({ label: `Start ${titleCase(filters.startLie)} x`, href: filterHref(filters, "startLie") });
  if (filters.endLie) chips.push({ label: `End ${titleCase(filters.endLie)} x`, href: filterHref(filters, "endLie") });
  if (filters.sg) chips.push({ label: `${sgResultLabel(filters.sg)} x`, href: filterHref(filters, "sg") });
  if (filters.from) chips.push({ label: `From ${filters.from} x`, href: filterHref(filters, "from") });
  if (filters.to) chips.push({ label: `To ${filters.to} x`, href: filterHref(filters, "to") });
  if (filters.sort !== "recent") chips.push({ label: `${sortLabel(filters.sort)} x`, href: filterHref(filters, "sort") });

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

  return `/strokes-gained?${params.toString()}#events`;
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

function holeShotLabel(event: StrokesGainedEvent) {
  return `Hole ${event.holeNumber ?? "?"} / Shot ${event.strokeNumber ?? "?"}`;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toneForSg(value: number | null) {
  if (value === null) return "slate" as const;
  if (value < 0) return "pink" as const;
  if (value > 0) return "green" as const;
  return "slate" as const;
}

function sgTextClassName(value: number | null) {
  if (value === null) return "text-[#667085]";
  if (value < 0) return "text-[#B42318]";
  if (value > 0) return "text-[#087A3D]";
  return "text-[#667085]";
}

function categoryCardClassName(value: number | null) {
  if (value === null) return "border-slate-200 bg-white";
  if (value < 0) return "border-red-200 bg-red-50/35";
  if (value > 0) return "border-emerald-200 bg-emerald-50/35";
  return "border-slate-200 bg-white";
}

function categoryIconClassName(value: number | null) {
  if (value === null) return "bg-slate-100 text-slate-600 ring-slate-200";
  if (value < 0) return "bg-red-50 text-[#B42318] ring-red-100";
  if (value > 0) return "bg-emerald-50 text-[#087A3D] ring-emerald-100";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function dateParam(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function integerParam(value: string) {
  return /^\d+$/.test(value) ? value : "";
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
