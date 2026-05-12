import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Crosshair,
  GitCompareArrows,
  LineChart,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";

import {
  ChartFrame,
  DataPair,
  DataPanel,
  DataTableFrame,
  InsightBlock,
  MobileDataCard,
  MobileDataList,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatClubType } from "@/lib/club-format";
import {
  defaultCompareFilters,
  getCompareData,
  type CompareBaselineMode,
  type CompareData,
  type CompareDelta,
  type CompareFilters,
  type CompareFocusMode,
  type DispersionPoint,
} from "@/lib/compare-data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const focusModes: Array<{ value: CompareFocusMode; label: string }> = [
  { value: "today", label: "Today / latest session" },
  { value: "latest-session", label: "Latest session" },
  { value: "session", label: "Selected session" },
  { value: "last-7", label: "Last 7 days" },
  { value: "last-30", label: "Last 30 days" },
  { value: "custom", label: "Custom dates" },
];

const baselineModes: Array<{ value: CompareBaselineMode; label: string }> = [
  { value: "before-focus", label: "All time before focus" },
  { value: "all-time", label: "All time outside focus" },
  { value: "previous-session", label: "Previous session" },
  { value: "previous-30", label: "Previous 30 days" },
  { value: "custom", label: "Custom dates" },
];

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={<StatusPill tone="amber">Configuration</StatusPill>}
          title="Compare"
          description="DATABASE_URL is required before session comparisons can be calculated."
        />
      </PageShell>
    );
  }

  const filters = parseFilters(await searchParams);
  const data = await getCompareData(filters);

  return (
    <PageShell size="full">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/progress" prefetch={false}>
              <LineChart className="size-4" />
              Progress
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone={benefitTone(data.benefit.verdict)}>{data.benefit.verdict}</StatusPill>}
        title="Compare"
        description={`${data.focus.label} against ${data.baseline.label}. ${data.benefit.summary}`}
        actions={
          <Button asChild size="lg" className="rounded-xl bg-[#111827] text-white">
            <Link href="/shots" prefetch={false}>
              <Crosshair className="size-4" />
              Open shots
            </Link>
          </Button>
        }
        metrics={[
          {
            label: "Benefit score",
            value: `${data.benefit.score}`,
            detail: "0-100 from dispersion, playable rate, big misses, and speed",
          },
          {
            label: "Focus sample",
            value: integerFormatter.format(data.focus.stockShots),
            detail: `${integerFormatter.format(data.focus.rawShots)} raw shots / ${data.focus.sessions} sessions`,
          },
          {
            label: "Baseline",
            value: integerFormatter.format(data.baseline.stockShots),
            detail: `${integerFormatter.format(data.baseline.rawShots)} raw shots / ${data.baseline.sessions} sessions`,
          },
          {
            label: "Playable delta",
            value: formatSignedRate(data.delta.playableRateDelta),
            detail: "Higher is better",
          },
        ]}
      />

      <CompareFiltersForm data={data} />

      {data.focus.rawShots === 0 ? (
        <DataPanel>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <GitCompareArrows className="size-9 text-muted-foreground" />
            <div>
              <p className="text-xl font-semibold">No shots in the focus sample</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Change the focus dates, session, or club filter to compare a populated sample.
              </p>
            </div>
          </CardContent>
        </DataPanel>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <DataPanel>
              <SectionHeader
                title="Session value"
                description="The fastest read on whether the focus work moved the right numbers."
                action={<StatusPill tone={benefitTone(data.benefit.verdict)}>{data.benefit.score}/100</StatusPill>}
              />
              <CardContent className="grid gap-3 md:grid-cols-2">
                <InsightBlock
                  label="Better"
                  value={data.benefit.positives[0] ?? "No strong gain"}
                  detail={data.benefit.positives.slice(1).join(" ")}
                  tone="green"
                />
                <InsightBlock
                  label="Watch"
                  value={data.benefit.warnings[0] ?? "No warning"}
                  detail={data.benefit.warnings.slice(1).join(" ")}
                  tone={data.benefit.warnings.some((warning) => warning.includes("widened") || warning.includes("fell") || warning.includes("increased")) ? "amber" : "slate"}
                />
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Focus vs baseline"
                description={`${data.focus.detail} compared with ${data.baseline.detail}.`}
                action={<GitCompareArrows className="size-5 text-emerald-500" />}
              />
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CompareMetric label="Carry" focus={formatYards(data.focus.carryMedianYd)} baseline={formatYards(data.baseline.carryMedianYd)} delta={formatSignedYards(data.delta.carryDeltaYd)} good={goodCarry(data.delta)} />
                <CompareMetric label="Offline" focus={formatYards(data.focus.absoluteOfflineAverageYd)} baseline={formatYards(data.baseline.absoluteOfflineAverageYd)} delta={formatSignedYards(data.delta.offlineDeltaYd)} good={data.delta.offlineDeltaYd !== null ? data.delta.offlineDeltaYd <= 0 : null} />
                <CompareMetric label="Shot cone" focus={formatYards(data.focus.shotConeWidthYd)} baseline={formatYards(data.baseline.shotConeWidthYd)} delta={formatSignedYards(data.delta.coneDeltaYd)} good={data.delta.coneDeltaYd !== null ? data.delta.coneDeltaYd <= 0 : null} />
                <CompareMetric label="Ball speed" focus={formatMph(data.focus.ballSpeedAverageMph)} baseline={formatMph(data.baseline.ballSpeedAverageMph)} delta={formatSignedMph(data.delta.ballSpeedDeltaMph)} good={data.delta.ballSpeedDeltaMph !== null ? data.delta.ballSpeedDeltaMph >= 0 : null} />
                <CompareMetric label="Playable" focus={formatRate(data.focus.playableRate)} baseline={formatRate(data.baseline.playableRate)} delta={formatSignedRate(data.delta.playableRateDelta)} good={data.delta.playableRateDelta !== null ? data.delta.playableRateDelta >= 0 : null} />
                <CompareMetric label="Big misses" focus={formatRate(data.focus.bigMissRate)} baseline={formatRate(data.baseline.bigMissRate)} delta={formatSignedRate(data.delta.bigMissRateDelta)} good={data.delta.bigMissRateDelta !== null ? data.delta.bigMissRateDelta <= 0 : null} />
                <CompareMetric label="Launch" focus={formatDegrees(data.focus.launchAverageDeg)} baseline={formatDegrees(data.baseline.launchAverageDeg)} delta={formatSignedDegrees(data.delta.launchDeltaDeg)} good={null} />
                <CompareMetric label="Miss pattern" focus={data.focus.primaryMiss} baseline={data.baseline.primaryMiss} delta={`${data.focus.clubs} clubs`} good={null} />
              </CardContent>
            </DataPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <DataPanel>
              <SectionHeader
                title="Shot dispersion"
                description="Carry distance against left/right miss. Green is focus, grey is baseline."
                action={<Crosshair className="size-5 text-pink-500" />}
              />
              <CardContent>
                <DispersionPlot focus={data.focus.dispersion} baseline={data.baseline.dispersion} />
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Club vs club"
                description="Selected clubs inside the focus sample, with baseline movement."
                action={<Target className="size-5 text-sky-500" />}
              />
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                {data.clubComparison.first ? <ClubCompareCard row={data.clubComparison.first} /> : null}
                {data.clubComparison.second ? <ClubCompareCard row={data.clubComparison.second} /> : null}
                {!data.clubComparison.first && !data.clubComparison.second ? (
                  <p className="text-sm text-muted-foreground">No club comparison available for this filter.</p>
                ) : null}
              </CardContent>
            </DataPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
            <DataPanel>
              <SectionHeader
                title="Club movement"
                description="Each club in the focus sample compared with its matching baseline."
                action={<TrendingUp className="size-5 text-emerald-500" />}
              />
              <CardContent>
                <DataTableFrame
                  mobile={
                    <MobileDataList>
                      {data.clubRows.length > 0 ? (
                        data.clubRows.map((row) => (
                          <MobileDataCard
                            key={row.clubId}
                            title={row.label}
                            subtitle={`${integerFormatter.format(row.focus.stockShots)} focus shots`}
                            action={<StatusPill tone={row.benefitScore >= 62 ? "green" : row.benefitScore >= 48 ? "amber" : "pink"}>{row.benefitScore}</StatusPill>}
                          >
                            <DataPair label="Carry" value={<span className={deltaClass(goodCarry(row.delta))}>{formatSignedYards(row.delta.carryDeltaYd)}</span>} />
                            <DataPair label="Offline" value={<span className={deltaClass(row.delta.offlineDeltaYd !== null ? row.delta.offlineDeltaYd <= 0 : null)}>{formatSignedYards(row.delta.offlineDeltaYd)}</span>} />
                            <DataPair label="Cone" value={<span className={deltaClass(row.delta.coneDeltaYd !== null ? row.delta.coneDeltaYd <= 0 : null)}>{formatSignedYards(row.delta.coneDeltaYd)}</span>} />
                            <DataPair label="Playable" value={<span className={deltaClass(row.delta.playableRateDelta !== null ? row.delta.playableRateDelta >= 0 : null)}>{formatSignedRate(row.delta.playableRateDelta)}</span>} />
                            <DataPair label="Big miss" value={<span className={deltaClass(row.delta.bigMissRateDelta !== null ? row.delta.bigMissRateDelta <= 0 : null)}>{formatSignedRate(row.delta.bigMissRateDelta)}</span>} />
                          </MobileDataCard>
                        ))
                      ) : (
                        <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                          No club-level comparison for this filter.
                        </div>
                      )}
                    </MobileDataList>
                  }
                >
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Club</TableHead>
                        <TableHead className="text-right">Focus</TableHead>
                        <TableHead className="text-right">Carry</TableHead>
                        <TableHead className="text-right">Offline</TableHead>
                        <TableHead className="text-right">Cone</TableHead>
                        <TableHead className="text-right">Playable</TableHead>
                        <TableHead className="text-right">Big miss</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.clubRows.map((row) => (
                        <TableRow key={row.clubId}>
                          <TableCell className="font-medium">{row.label}</TableCell>
                          <TableCell className="text-right">{integerFormatter.format(row.focus.stockShots)}</TableCell>
                          <TableCell className={deltaClass(goodCarry(row.delta))}>{formatSignedYards(row.delta.carryDeltaYd)}</TableCell>
                          <TableCell className={deltaClass(row.delta.offlineDeltaYd !== null ? row.delta.offlineDeltaYd <= 0 : null)}>{formatSignedYards(row.delta.offlineDeltaYd)}</TableCell>
                          <TableCell className={deltaClass(row.delta.coneDeltaYd !== null ? row.delta.coneDeltaYd <= 0 : null)}>{formatSignedYards(row.delta.coneDeltaYd)}</TableCell>
                          <TableCell className={deltaClass(row.delta.playableRateDelta !== null ? row.delta.playableRateDelta >= 0 : null)}>{formatSignedRate(row.delta.playableRateDelta)}</TableCell>
                          <TableCell className={deltaClass(row.delta.bigMissRateDelta !== null ? row.delta.bigMissRateDelta <= 0 : null)}>{formatSignedRate(row.delta.bigMissRateDelta)}</TableCell>
                          <TableCell className="text-right font-semibold">{row.benefitScore}</TableCell>
                        </TableRow>
                      ))}
                      {data.clubRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                            No club-level comparison for this filter.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </DataTableFrame>
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Sessions in focus"
                description="The sessions currently making up the focus sample."
                action={<CalendarDays className="size-5 text-amber-600" />}
              />
              <CardContent className="grid gap-3">
                {data.focus.sessionBreakdown.map((session) => (
                  <Link
                    key={session.id}
                    href={`/shots?sessionId=${session.id}`}
                    prefetch={false}
                    className="apple-panel-strong flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:border-emerald-300"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{session.label}</p>
                      <p className="text-xs text-muted-foreground">{session.dateLabel}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{integerFormatter.format(session.shotCount)}</span>
                  </Link>
                ))}
                {data.focus.sessionBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions in the focus sample.</p>
                ) : null}
              </CardContent>
            </DataPanel>
          </section>
        </>
      )}
    </PageShell>
  );
}

function CompareFiltersForm({ data }: { data: CompareData }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Filters"
        description="Set the focus sample, baseline, club scope, and club-vs-club pair."
        action={<GitCompareArrows className="size-5 text-muted-foreground" />}
      />
      <CardContent>
        <form className="apple-panel grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-6">
          <SelectField label="Focus" name="focus" defaultValue={data.filters.focus}>
            {focusModes.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </SelectField>
          <SelectField label="Focus session" name="sessionId" defaultValue={data.filters.sessionId}>
            <option value="">Latest session</option>
            {data.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.dateLabel} - {session.label}
              </option>
            ))}
          </SelectField>
          <DateField label="Focus from" name="from" defaultValue={data.filters.from} />
          <DateField label="Focus to" name="to" defaultValue={data.filters.to} />
          <SelectField label="Club scope" name="clubId" defaultValue={data.filters.clubId}>
            <option value="">All clubs</option>
            {data.clubs.map((club) => (
              <option key={club.id} value={club.id}>{club.label}</option>
            ))}
          </SelectField>
          <SelectField label="Baseline" name="baseline" defaultValue={data.filters.baseline}>
            {baselineModes.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </SelectField>
          <SelectField label="Baseline session" name="baselineSessionId" defaultValue={data.filters.baselineSessionId}>
            <option value="">Previous session</option>
            {data.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.dateLabel} - {session.label}
              </option>
            ))}
          </SelectField>
          <DateField label="Baseline from" name="baselineFrom" defaultValue={data.filters.baselineFrom} />
          <DateField label="Baseline to" name="baselineTo" defaultValue={data.filters.baselineTo} />
          <SelectField label="Club A" name="clubAId" defaultValue={data.filters.clubAId || data.clubComparison.first?.clubId || ""}>
            <option value="">Auto</option>
            {data.clubs.map((club) => (
              <option key={club.id} value={club.id}>{club.label}</option>
            ))}
          </SelectField>
          <SelectField label="Club B" name="clubBId" defaultValue={data.filters.clubBId || data.clubComparison.second?.clubId || ""}>
            <option value="">Auto</option>
            {data.clubs.map((club) => (
              <option key={club.id} value={club.id}>{club.label}</option>
            ))}
          </SelectField>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
            <Button type="submit">Apply filters</Button>
            <Button asChild variant="outline">
              <Link href="/compare" prefetch={false}>Reset</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </DataPanel>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <select name={name} defaultValue={defaultValue} className="h-10 rounded-lg border bg-white/90 px-3 text-sm">
        {children}
      </select>
    </label>
  );
}

function DateField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input type="date" name={name} defaultValue={defaultValue} className="h-10 rounded-lg border bg-white/90 px-3 text-sm" />
    </label>
  );
}

function CompareMetric({
  label,
  focus,
  baseline,
  delta,
  good,
}: {
  label: string;
  focus: string;
  baseline: string;
  delta: string;
  good: boolean | null;
}) {
  return (
    <div className="apple-panel-strong p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{focus}</p>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Base {baseline}</span>
        <span className={deltaClass(good)}>{delta}</span>
      </div>
    </div>
  );
}

function ClubCompareCard({ row }: { row: CompareData["clubRows"][number] }) {
  return (
    <div className="apple-panel-strong p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{formatClubType(row.clubType)}</p>
          <p className="mt-1 text-lg font-semibold">{row.label}</p>
        </div>
        <StatusPill tone={row.benefitScore >= 62 ? "green" : row.benefitScore >= 48 ? "amber" : "pink"}>
          {row.benefitScore}
        </StatusPill>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="Focus shots" value={integerFormatter.format(row.focus.stockShots)} />
        <MiniStat label="Carry" value={formatYards(row.focus.carryMedianYd)} />
        <MiniStat label="Offline" value={formatYards(row.focus.absoluteOfflineAverageYd)} />
        <MiniStat label="Playable" value={formatRate(row.focus.playableRate)} />
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <DeltaLine label="Carry" value={formatSignedYards(row.delta.carryDeltaYd)} good={goodCarry(row.delta)} />
        <DeltaLine label="Offline" value={formatSignedYards(row.delta.offlineDeltaYd)} good={row.delta.offlineDeltaYd !== null ? row.delta.offlineDeltaYd <= 0 : null} />
        <DeltaLine label="Playable" value={formatSignedRate(row.delta.playableRateDelta)} good={row.delta.playableRateDelta !== null ? row.delta.playableRateDelta >= 0 : null} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-slate-200/80">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function DeltaLine({ label, value, good }: { label: string; value: string; good: boolean | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={deltaClass(good)}>{value}</span>
    </div>
  );
}

function DispersionPlot({
  focus,
  baseline,
}: {
  focus: DispersionPoint[];
  baseline: DispersionPoint[];
}) {
  const points = [...focus, ...baseline];

  if (points.length === 0) {
    return (
      <div className="apple-panel grid aspect-[2/1] place-items-center text-sm text-muted-foreground">
        No dispersion points for this comparison.
      </div>
    );
  }

  const maxSide = Math.max(20, ...points.map((point) => Math.abs(point.sideCarryYd)));
  const carryValues = points.map((point) => point.carryYd);
  const minCarry = Math.max(0, Math.min(...carryValues) - 10);
  const maxCarry = Math.max(...carryValues) + 10;
  const plot = (point: DispersionPoint) => ({
    x: 48 + ((point.sideCarryYd + maxSide) / (maxSide * 2 || 1)) * 624,
    y: 312 - ((point.carryYd - minCarry) / (maxCarry - minCarry || 1)) * 264,
  });

  return (
    <ChartFrame className="p-3">
      <svg viewBox="0 0 720 360" role="img" aria-label="Shot dispersion comparison" className="aspect-[2/1] w-full">
        <rect x="0" y="0" width="720" height="360" rx="12" fill="#ffffff" />
        <line x1="360" x2="360" y1="36" y2="320" stroke="#94a3b8" strokeDasharray="5 5" />
        <line x1="48" x2="672" y1="312" y2="312" stroke="#cbd5e1" />
        <line x1="48" x2="48" y1="36" y2="312" stroke="#cbd5e1" />
        <text x="360" y="28" textAnchor="middle" className="fill-slate-500 text-[12px]">Target line</text>
        <text x="48" y="338" textAnchor="start" className="fill-slate-500 text-[12px]">Left</text>
        <text x="672" y="338" textAnchor="end" className="fill-slate-500 text-[12px]">Right</text>
        <text x="56" y="50" className="fill-slate-500 text-[12px]">Carry</text>
        {baseline.map((point) => {
          const position = plot(point);
          return <circle key={`baseline-${point.id}`} cx={position.x} cy={position.y} r="4" fill="#94a3b8" opacity="0.46" />;
        })}
        {focus.map((point) => {
          const position = plot(point);
          return <circle key={`focus-${point.id}`} cx={position.x} cy={position.y} r="5" fill="#059669" opacity="0.8" />;
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-600" /> Focus</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-400" /> Baseline</span>
      </div>
    </ChartFrame>
  );
}

function parseFilters(searchParams: Awaited<SearchParams>): CompareFilters {
  const defaults = defaultCompareFilters();
  const focus = stringParam(searchParams.focus);
  const baseline = stringParam(searchParams.baseline);

  return {
    focus: isFocusMode(focus) ? focus : defaults.focus,
    baseline: isBaselineMode(baseline) ? baseline : defaults.baseline,
    sessionId: stringParam(searchParams.sessionId),
    baselineSessionId: stringParam(searchParams.baselineSessionId),
    clubId: stringParam(searchParams.clubId),
    clubAId: stringParam(searchParams.clubAId),
    clubBId: stringParam(searchParams.clubBId),
    from: stringParam(searchParams.from),
    to: stringParam(searchParams.to),
    baselineFrom: stringParam(searchParams.baselineFrom),
    baselineTo: stringParam(searchParams.baselineTo),
  };
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isFocusMode(value: string): value is CompareFocusMode {
  return focusModes.some((mode) => mode.value === value);
}

function isBaselineMode(value: string): value is CompareBaselineMode {
  return baselineModes.some((mode) => mode.value === value);
}

function benefitTone(verdict: CompareData["benefit"]["verdict"]) {
  return verdict === "Beneficial" ? "green" : verdict === "Useful" ? "sky" : verdict === "Mixed" ? "amber" : "pink";
}

function goodCarry(delta: CompareDelta) {
  if (delta.carryDeltaYd === null) return null;

  if (delta.offlineDeltaYd !== null && delta.offlineDeltaYd > 4 && delta.carryDeltaYd > 0) {
    return false;
  }

  return delta.carryDeltaYd >= 0;
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatMph(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} mph`;
}

function formatDegrees(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} deg`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)}%`;
}

function formatSignedYards(value: number | null) {
  return value === null ? "--" : `${signed(value)} yd`;
}

function formatSignedMph(value: number | null) {
  return value === null ? "--" : `${signed(value)} mph`;
}

function formatSignedDegrees(value: number | null) {
  return value === null ? "--" : `${signed(value)} deg`;
}

function formatSignedRate(value: number | null) {
  return value === null ? "--" : `${signed(value)} pts`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

function deltaClass(good: boolean | null) {
  if (good === true) return "text-right font-semibold text-emerald-700";
  if (good === false) return "text-right font-semibold text-pink-700";
  return "text-right font-semibold text-muted-foreground";
}
