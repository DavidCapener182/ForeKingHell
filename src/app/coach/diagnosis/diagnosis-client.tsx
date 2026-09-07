"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import Link from "next/link";

import {
  DesktopTableWorkbenchControls,
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  DataPanel,
  DataTableFrame,
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
import { type CoachClubCard } from "@/lib/coach";

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

export function DiagnosisClient({ cards }: { cards: CoachClubCard[] }) {
  const query = useSearchParams();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("priority");
  const [confidence, setConfidence] = useState("all");
  const [open, setOpen] = useState(false);
  const selected = cards.find((card) => card.clubId === query.get("clubId")) ?? cards[0];
  const filtered = useMemo(
    () =>
      cards
        .filter(
          (card) =>
            `${card.clubName} ${card.brandModel} ${card.issueLabel}`
              .toLowerCase()
              .includes(search.toLowerCase()) &&
            (confidence === "all" ||
              (confidence === "early"
                ? card.sampleSize < 5 || card.trustIndex < 50
                : card.sampleSize >= 5 && card.trustIndex >= 50)),
        )
        .sort((a, b) =>
          sort === "trust"
            ? a.trustIndex - b.trustIndex
            : sort === "sample"
              ? b.sampleSize - a.sampleSize
              : 0,
        ),
    [cards, search, sort, confidence],
  );
  function select(card: CoachClubCard) {
    const url = new URL(window.location.href);
    url.searchParams.set("clubId", card.clubId);
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
    setOpen(true);
  }
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Search clubs
          <Input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Order
          <select
            className="min-h-11 rounded-lg border bg-background px-3"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="priority">Diagnosis priority</option>
            <option value="trust">Lowest trust first</option>
            <option value="sample">Largest sample first</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Evidence confidence
          <select
            className="min-h-11 rounded-lg border bg-background px-3"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          >
            <option value="all">All confidence levels</option>
            <option value="early">Early signal</option>
            <option value="developing">Developing or stronger</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        {filtered.length} of {cards.length} clubs. These are measured sample diagnostics, not proven
        swing causes. Early signals need more comparable shots.
      </p>
      <div className="hidden lg:block">
        <CoachDiagnosisEvidenceTable cards={filtered} onSelect={select} sort={sort} />
      </div>
      <section id="drill-cards" aria-label="Ranked club drills" className="grid gap-2">
        <h2 className="text-xl font-semibold">Choose a club and drill</h2>
        {filtered.map((card) => (
          <Button
            type="button"
            key={card.clubId}
            variant="outline"
            className="h-auto min-h-14 justify-start whitespace-normal p-4 text-left"
            onClick={() => select(card)}
            aria-pressed={selected?.clubId === card.clubId}
          >
            <span className="grid gap-1">
              <strong>
                {card.clubName} · {card.issueLabel}
              </strong>
              <span className="text-sm font-normal">
                {card.sampleSize} clean shots · {card.trustIndex}% trust ·{" "}
                {card.sampleSize < 5 || card.trustIndex < 50
                  ? "Early signal"
                  : "Developing or stronger"}{" "}
                evidence
              </span>
              <span className="text-sm font-normal">{card.drill}</span>
            </span>
          </Button>
        ))}
        {!filtered.length ? (
          <p>No clubs match these filters. Clear the search or choose all confidence levels.</p>
        ) : null}
      </section>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selected?.clubName} diagnosis and drill</SheetTitle>
            <SheetDescription>
              One selected diagnosis record supplies these figures and instructions.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {selected ? <DiagnosisClubCard card={selected} /> : null}
            <p className="mt-4 text-sm">
              A drill is a practice suggestion, not a guaranteed result. Retest with comparable
              measured sessions.
            </p>
          </div>
          {selected ? (
            <div className="grid gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button asChild>
                <Link
                  href={`/practice?club=${encodeURIComponent(selected.clubType.toLowerCase().replace(/[^a-z0-9]/g, ""))}&source=coach`}
                >
                  Practise with this club
                </Link>
              </Button>
              <SheetClose asChild>
                <Button variant="outline">Close diagnosis</Button>
              </SheetClose>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
function CoachDiagnosisEvidenceTable({
  cards,
  onSelect,
  sort,
}: {
  cards: CoachClubCard[];
  onSelect: (card: CoachClubCard) => void;
  sort: string;
}) {
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
          <DataTableFrame
            mainTable
            mainTableLabel="Coach diagnosis evidence table"
            stickyFirstColumn
          >
            <Table
              data-workbench-export-table="coach-diagnosis-evidence"
              aria-describedby="coach-diagnosis-evidence-summary"
            >
              <TableCaption id="coach-diagnosis-evidence-summary" className="sr-only">
                Coach diagnosis evidence table showing club, issue, trust, sample, stock carry,
                playable rate, usual miss, drill, retest and action.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow>
                  <TableHead
                    data-column="club"
                    className="sticky left-0 z-20 min-w-56 bg-card shadow-[1px_0_0_hsl(var(--border))]"
                  >
                    Club
                  </TableHead>
                  <TableHead data-column="issue">Issue</TableHead>
                  <TableHead
                    data-column="trust"
                    aria-sort={sort === "trust" ? "ascending" : "none"}
                  >
                    Trust (%)
                  </TableHead>
                  <TableHead
                    data-column="sample"
                    aria-sort={sort === "sample" ? "descending" : "none"}
                  >
                    Clean shots
                  </TableHead>
                  <TableHead data-column="stock">Stock carry (yd)</TableHead>
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
                      className="sticky left-0 z-10 min-w-56 bg-card font-medium shadow-[1px_0_0_hsl(var(--border))]"
                    >
                      <span className="block whitespace-normal">{card.clubName}</span>
                      <span className="mt-1 block whitespace-normal text-xs text-muted-foreground">
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelect(card)}
                      >
                        Inspect drill
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
      className={`block rounded-lg border p-4 transition-colors hover:border-primary/40 ${tonePanelClass(
        card.tone,
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-normal">{card.clubName}</h2>
            <StatusPill tone={card.tone}>{card.issueLabel}</StatusPill>
          </div>
          <p className="mt-1 break-words text-sm text-muted-foreground">{card.brandModel}</p>
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
    <div className="rounded-lg bg-card px-3 py-2 ring-1 ring-border">
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
    green:
      "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]",
    sky: "border-border bg-muted/55 text-foreground",
    pink: "border-destructive/35 bg-destructive/10 text-destructive",
    amber:
      "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]",
    slate: "border-border bg-muted/55 text-foreground",
  };

  return classes[tone];
}

function progressToneClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    green: "[&_[data-slot=progress-indicator]]:bg-[var(--status-success-foreground)]",
    sky: "[&_[data-slot=progress-indicator]]:bg-primary",
    pink: "[&_[data-slot=progress-indicator]]:bg-destructive",
    amber: "[&_[data-slot=progress-indicator]]:bg-[var(--status-warning-foreground)]",
    slate: "[&_[data-slot=progress-indicator]]:bg-muted-foreground",
  };

  return classes[tone];
}
