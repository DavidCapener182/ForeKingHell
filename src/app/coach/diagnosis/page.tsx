import Link from "next/link";
import { ArrowLeft, Brain, Gauge, Upload } from "lucide-react";

import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  DataPanel,
  DataTableFrame,
  PageShell,
  SectionHeader,
  StatusPill,
  type Tone,
} from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildCoachSummary, type CoachClubCard } from "@/lib/coach";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProgressData } from "@/lib/progress-data";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const coachDiagnosisColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "issue", label: "Issue" },
  { id: "trust", label: "Trust" },
  { id: "sample", label: "Sample" },
  { id: "stock", label: "Stock carry" },
  { id: "playable", label: "Playable" },
  { id: "miss", label: "Usual miss" },
  { id: "drill", label: "Drill" },
  { id: "retest", label: "Retest" },
  { id: "action", label: "Action", locked: true },
];

const coachDiagnosisSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Lowest trust first",
    href: "#coach-diagnosis-evidence",
    detail: "Start with clubs whose decision confidence is weakest.",
  },
  {
    title: "Practice priority",
    href: "#drill-cards",
    detail: "Open the drill card view for the clubs that need a decision.",
  },
  {
    title: "Club analytics",
    href: "/bag",
    detail: "Move from diagnosis into the bag analytics workbench.",
  },
];

export default async function CoachDiagnosisPage() {
  const userId = await requireCurrentUserId();
  const data = await getProgressData(userId);
  const coach = buildCoachSummary(data.clubs);
  const needsAttention = coach.clubCards.slice(0, 3);

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="coach-diagnosis">
        <div className="hidden items-center justify-between gap-4 sm:flex">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/coach" prefetch={false}>
              <ArrowLeft className="size-4" />
              Coach
            </Link>
          </Button>
          <Button asChild>
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import data
            </Link>
          </Button>
        </div>

        {data.clubs.length === 0 ? (
          <DataPanel>
            <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
              <Brain className="size-10 text-emerald-500" />
              <div>
                <p className="text-xl font-semibold">Diagnosis is waiting for data</p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                  Import launch-monitor shots and LM World Tour will separate distance, strike,
                  launch, direction, delivery, and data quality for every club.
                </p>
              </div>
              <Button asChild>
                <Link href="/import" prefetch={false}>
                  <Upload className="size-4" />
                  Import data
                </Link>
              </Button>
            </CardContent>
          </DataPanel>
        ) : (
          <>
            <section className="premium-card rounded-lg border-0 bg-[#F8FAF5] p-5 shadow-[0_18px_50px_rgba(31,49,39,0.1)] lg:p-7">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
                <div>
                  <StatusPill tone="green">Coach diagnosis</StatusPill>
                  <h1 className="mt-4 text-4xl font-semibold tracking-normal text-[#111611] xl:text-5xl">
                    Club improvement centre
                  </h1>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                    Every club-specific issue stays here, away from the daily coach page. Use this
                    report when you want the deeper diagnosis rather than the next practice action.
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-white/88 p-4">
                  <p className="text-sm font-semibold text-slate-900">Needs most attention</p>
                  <div className="mt-3 grid gap-2">
                    {needsAttention.map((card) => (
                      <Link
                        key={card.clubId}
                        href={`/bag/${card.clubId}/analytics`}
                        prefetch={false}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 transition-colors hover:border-emerald-300"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{card.clubName}</span>
                          <StatusPill tone={card.tone}>{card.trustIndex}%</StatusPill>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <CoachDiagnosisEvidenceTable cards={coach.clubCards} />

            <DataPanel id="drill-cards">
              <SectionHeader
                title="Drill cards"
                description="Supporting cards for the table above, sorted by the clubs that most need a practice decision."
                action={<Gauge className="size-5 text-emerald-700" />}
              />
              <CardContent className="grid gap-4 p-5 xl:grid-cols-2">
                {coach.clubCards.map((card) => (
                  <DiagnosisClubCard key={card.clubId} card={card} />
                ))}
              </CardContent>
            </DataPanel>
          </>
        )}
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function CoachDiagnosisEvidenceTable({ cards }: { cards: CoachClubCard[] }) {
  return (
    <section
      id="coach-diagnosis-evidence"
      data-workbench-scope="coach-diagnosis-evidence"
      className="grid gap-3"
    >
      <DataPanel className="gap-0 py-0">
        <SectionHeader
          title="Diagnosis evidence table"
          description="Exportable club-by-club evidence before choosing the next drill."
          action={
            <StatusPill tone={cards.length > 0 ? "green" : "slate"}>
              {cards.length} clubs
            </StatusPill>
          }
        />
        <CardContent className="grid gap-3 p-3">
          <DesktopTableWorkbenchControls
            viewKey="coach-diagnosis-evidence"
            scope="coach-diagnosis-evidence"
            currentViewLabel="Coach diagnosis evidence"
            resultLabel={`${cards.length} clubs`}
            columns={coachDiagnosisColumns}
            suggestedViews={coachDiagnosisSuggestedViews}
            exportTableId="coach-diagnosis-evidence"
            exportFileName="forekinghell-coach-diagnosis.csv"
          />
          <DataTableFrame mainTable mainTableLabel="Coach diagnosis evidence table">
            <Table
              data-workbench-export-table="coach-diagnosis-evidence"
              aria-describedby="coach-diagnosis-evidence-summary"
            >
              <TableCaption id="coach-diagnosis-evidence-summary" className="sr-only">
                Coach diagnosis evidence table showing club, issue, trust, sample, stock carry,
                playable rate, usual miss, drill, retest and action.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                <TableRow>
                  <TableHead
                    data-column="club"
                    className="sticky left-0 z-20 min-w-56 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    Club
                  </TableHead>
                  <TableHead data-column="issue">Issue</TableHead>
                  <TableHead data-column="trust">Trust</TableHead>
                  <TableHead data-column="sample">Sample</TableHead>
                  <TableHead data-column="stock">Stock carry</TableHead>
                  <TableHead data-column="playable">Playable</TableHead>
                  <TableHead data-column="miss">Usual miss</TableHead>
                  <TableHead data-column="drill">Drill</TableHead>
                  <TableHead data-column="retest">Retest</TableHead>
                  <TableHead data-column="action" className="text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((card) => (
                  <TableRow key={card.clubId} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="club"
                      className="sticky left-0 z-10 min-w-56 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      <span className="block max-w-64 truncate">{card.clubName}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {card.brandModel}
                      </span>
                    </TableCell>
                    <TableCell data-column="issue">{card.issueLabel}</TableCell>
                    <TableCell data-column="trust">
                      <StatusPill tone={card.tone}>{card.trustIndex}%</StatusPill>
                    </TableCell>
                    <TableCell data-column="sample">{card.sampleSize} shots</TableCell>
                    <TableCell data-column="stock">{formatYards(card.stockCarryYd)}</TableCell>
                    <TableCell data-column="playable">{formatRate(card.playableRate)}</TableCell>
                    <TableCell data-column="miss">{card.usualMiss ?? "Needs data"}</TableCell>
                    <TableCell data-column="drill" className="max-w-[24rem] whitespace-normal">
                      {card.drill}
                    </TableCell>
                    <TableCell data-column="retest">After two comparable sessions</TableCell>
                    <TableCell data-column="action" className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/bag/${card.clubId}/analytics`} prefetch={false}>
                          Open
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableFrame>
        </CardContent>
      </DataPanel>
    </section>
  );
}

function DiagnosisClubCard({ card }: { card: CoachClubCard }) {
  return (
    <Link
      href={`/bag/${card.clubId}/analytics`}
      prefetch={false}
      className={`rounded-lg border p-4 transition-colors hover:border-emerald-300 ${tonePanelClass(
        card.tone,
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-normal">{card.clubName}</h2>
            <StatusPill tone={card.tone}>{card.issueLabel}</StatusPill>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{card.brandModel}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tracking-normal">{card.trustIndex}%</p>
          <p className="text-xs text-muted-foreground">trust</p>
        </div>
      </div>

      <Progress value={card.trustIndex} className={`mt-4 h-2.5 ${progressToneClass(card.tone)}`} />

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <SmallMetric label="Stock" value={formatYards(card.stockCarryYd)} />
        <SmallMetric label="Playable" value={formatRate(card.playableRate)} />
        <SmallMetric label="Miss" value={card.usualMiss} />
        <SmallMetric label="Sample" value={`${card.sampleSize} clean`} />
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        <SmallMetric label="Evidence" value={card.reason} />
        <SmallMetric label="Drill" value={card.drill} />
        <SmallMetric label="Retest" value="After two comparable sessions" />
      </div>
    </Link>
  );
}

function SmallMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/85 px-3 py-2 ring-1 ring-slate-200/80">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function tonePanelClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "border-emerald-200 bg-emerald-50/75",
    sky: "border-sky-200 bg-sky-50/75",
    pink: "border-rose-200 bg-rose-50/75",
    amber: "border-amber-200 bg-amber-50/80",
    slate: "border-slate-200 bg-slate-50/85",
  };

  return classes[tone];
}

function progressToneClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "[&_[data-slot=progress-indicator]]:bg-emerald-500",
    sky: "[&_[data-slot=progress-indicator]]:bg-sky-500",
    pink: "[&_[data-slot=progress-indicator]]:bg-rose-500",
    amber: "[&_[data-slot=progress-indicator]]:bg-amber-500",
    slate: "[&_[data-slot=progress-indicator]]:bg-slate-500",
  };

  return classes[tone];
}
