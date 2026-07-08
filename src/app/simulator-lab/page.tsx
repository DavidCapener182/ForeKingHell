import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Flame,
  Radar,
  SlidersHorizontal,
  Target,
  Upload,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { GappingMatrixClient } from "@/app/simulator-lab/gapping-matrix-client";
import { SessionRoastPanel } from "@/app/simulator-lab/session-roast-panel";
import {
  CompactReadoutGrid,
  DataPanel,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
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
  getSimulatorLabData,
  type EquipmentChangeImpact,
  type SessionDeltaRow,
} from "@/lib/simulator-lab";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const sessionDeltaColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "samples", label: "Samples" },
  { id: "carry", label: "Carry" },
  { id: "ball", label: "Ball" },
  { id: "smash", label: "Smash" },
  { id: "offline", label: "Offline" },
  { id: "verdict", label: "Verdict", locked: true },
];

const sessionDeltaSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Latest simulator changes",
    href: "/simulator-lab#simulator-session-deltas",
    detail: "Review clubs whose latest indoor session moved against the 30-day baseline.",
  },
  {
    title: "Offline control check",
    href: "/simulator-lab#simulator-session-deltas",
    detail: "Keep club, samples, offline and verdict visible for direction-control review.",
  },
];

const equipmentImpactColumns: DesktopWorkbenchColumn[] = [
  { id: "change", label: "Change", locked: true },
  { id: "samples", label: "Samples" },
  { id: "carry", label: "Carry" },
  { id: "ball", label: "Ball" },
  { id: "smash", label: "Smash" },
  { id: "offline", label: "Offline" },
  { id: "verdict", label: "Verdict", locked: true },
];

const equipmentImpactSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Before/after equipment proof",
    href: "/simulator-lab#simulator-equipment-impact",
    detail: "Compare carry, speed and offline movement around logged setup changes.",
  },
  {
    title: "Equipment regressions",
    href: "/simulator-lab#simulator-equipment-impact",
    detail: "Start with verdict and samples before trusting an equipment-change result.",
  },
];

export default async function SimulatorLabPage() {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={<StatusPill tone="amber">Setup</StatusPill>}
          title="Simulator Data Lab"
          description="Database connection required before simulator analytics can load."
        />
      </PageShell>
    );
  }

  const data = await getSimulatorLabData();
  const latestSessionLabel = data.latestSession
    ? `${data.latestSession.source} / ${dateFormatter.format(data.latestSession.date)}`
    : "No simulator session";

  return (
    <PageShell contentClassName="pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-5">
      <MobileRouteHeader title="Analyse" group="analyse" activeKey="simulator-lab" />

      <DesktopWorkbenchLayout scope="simulator-lab">
        <PageHeader
          eyebrow={<StatusPill tone="sky">Simulator Data Lab</StatusPill>}
          title="Simulator Data Lab"
          description="WITB gapping, indoor-session deltas and equipment proof from saved launch-monitor data."
          actions={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link href="/import?source=csv#csv-import" prefetch={false}>
                  <Upload className="size-4" />
                  Import CSV
                </Link>
              </Button>
              <Button asChild className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                <Link href="/equipment" prefetch={false}>
                  <Wrench className="size-4" />
                  Log setup
                </Link>
              </Button>
            </div>
          }
          metrics={[
            {
              label: "Latest session",
              value: latestSessionLabel,
              detail: data.latestSession?.fileName ?? "Import simulator data",
            },
            {
              label: "Active clubs",
              value: data.totals.activeClubs,
              detail: `${data.totals.gappingRows} mapped into WITB`,
            },
            {
              label: "Gap flags",
              value: data.totals.gapFlags,
              detail: "Overlap or missing windows",
            },
            {
              label: "Positive deltas",
              value: data.totals.positiveDeltas,
              detail: "Clubs beating 30-day baseline",
            },
          ]}
        />

        {data.dataIssues?.length ? (
          <DataPanel className="border-amber-200 bg-amber-50/70">
            <SectionHeader
              title="Simulator data caveat"
              description="The lab rendered with partial data rather than blocking the workspace."
              action={<AlertTriangle className="size-5 text-amber-700" />}
            />
            <CardContent className="grid gap-2 text-sm leading-6 text-amber-950/80">
              {data.dataIssues.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </CardContent>
          </DataPanel>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DataPanel>
            <SectionHeader
              title="WITB gapping matrix"
              description="Recommended carry is plotted first; best stock and latest reliable stay visible for trust checks."
              action={<Target className="size-5 text-emerald-600" />}
            />
            <CardContent>
              <GappingMatrixClient rows={data.gappingRows} />
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Roast draft"
              description="Private, opt-in banter from the latest simulator facts. Nothing posts automatically."
              action={<Flame className="size-5 text-rose-500" />}
            />
            <CardContent>
              <SessionRoastPanel session={data.latestSession} facts={data.roastFacts} />
            </CardContent>
          </DataPanel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <DataPanel>
            <SectionHeader
              title="Session deltas"
              description="Latest indoor session against the prior 30 days for the same clubs."
              action={<Activity className="size-5 text-sky-600" />}
            />
            <CardContent>
              <SessionDeltaTable rows={data.sessionDeltas} />
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Tinkering ledger"
              description="Dated setup changes compared with 30-day before and after windows."
              action={<SlidersHorizontal className="size-5 text-emerald-600" />}
            />
            <CardContent>
              <EquipmentImpactTable impacts={data.equipmentImpacts} />
            </CardContent>
          </DataPanel>
        </section>

        <DataPanel>
          <SectionHeader
            title="Next actions"
            description="Keep the lab useful by feeding it comparable sessions and dated setup changes."
            action={<Radar className="size-5 text-slate-700" />}
          />
          <CardContent>
            <CompactReadoutGrid
              columnsClassName="md:grid-cols-3"
              items={[
                {
                  label: "Import",
                  value: "Save TrackMan, Square or Rapsodo CSVs",
                  tone: "green",
                },
                {
                  label: "Retest",
                  value: "Build 3 latest and 5 baseline shots per club",
                  tone: "sky",
                },
                {
                  label: "Prove",
                  value: "Log loft, shaft or ball changes before testing",
                  tone: "amber",
                },
              ]}
            />
          </CardContent>
        </DataPanel>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SessionDeltaTable({ rows }: { rows: SessionDeltaRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyPanel icon={Database} text="Import a simulator session to unlock 30-day deltas." />
    );
  }

  return (
    <div
      id="simulator-session-deltas"
      className="grid scroll-mt-28 gap-3"
      data-workbench-scope="simulator-session-deltas"
    >
      <DesktopTableWorkbenchControls
        viewKey="simulator-session-deltas"
        scope="simulator-session-deltas"
        currentViewLabel="Latest session deltas"
        resultLabel={`${rows.length.toLocaleString("en-GB")} clubs`}
        columns={sessionDeltaColumns}
        suggestedViews={sessionDeltaSuggestedViews}
        exportTableId="simulator-session-deltas"
        exportFileName="forekinghell-simulator-session-deltas.csv"
      />
      <DataTableFrame
        mainTable
        mainTableLabel="Simulator session delta table"
        stickyFirstColumn
        mobile={
          <MobileDataList>
            {rows.map((row) => (
              <MobileDataCard
                key={row.clubType}
                title={row.clubLabel}
                subtitle={row.summary}
                action={
                  <span className={toneTextClass(row.tone)}>{verdictLabel(row.verdict)}</span>
                }
              >
                <MobileMetric label="Carry" value={formatDelta(row.carryDeltaYd, "yd")} />
                <MobileMetric label="Ball" value={formatDelta(row.ballSpeedDeltaMph, "mph")} />
                <MobileMetric label="Smash" value={formatDelta(row.smashDelta, "")} />
                <MobileMetric label="Offline" value={formatDelta(row.offlineDeltaYd, "yd")} />
              </MobileDataCard>
            ))}
          </MobileDataList>
        }
      >
        <Table
          data-workbench-export-table="simulator-session-deltas"
          aria-describedby="simulator-session-deltas-summary"
        >
          <TableCaption id="simulator-session-deltas-summary" className="sr-only">
            Latest simulator session deltas against prior 30-day club baselines.
          </TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead
                data-column="club"
                className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Club
              </TableHead>
              <TableHead data-column="samples">Samples</TableHead>
              <TableHead data-column="carry" className="text-right">
                Carry
              </TableHead>
              <TableHead data-column="ball" className="text-right">
                Ball
              </TableHead>
              <TableHead data-column="smash" className="text-right">
                Smash
              </TableHead>
              <TableHead data-column="offline" className="text-right">
                Offline
              </TableHead>
              <TableHead data-column="verdict">Verdict</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.clubType}
                tabIndex={0}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TableCell
                  data-column="club"
                  className="sticky left-0 z-10 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  {row.clubLabel}
                </TableCell>
                <TableCell data-column="samples">
                  {row.latestShotCount}/{row.baselineShotCount}
                </TableCell>
                <TableCell data-column="carry" className="text-right tabular-nums">
                  {formatDelta(row.carryDeltaYd, "yd")}
                </TableCell>
                <TableCell data-column="ball" className="text-right tabular-nums">
                  {formatDelta(row.ballSpeedDeltaMph, "mph")}
                </TableCell>
                <TableCell data-column="smash" className="text-right tabular-nums">
                  {formatDelta(row.smashDelta, "")}
                </TableCell>
                <TableCell data-column="offline" className="text-right tabular-nums">
                  {formatDelta(row.offlineDeltaYd, "yd")}
                </TableCell>
                <TableCell data-column="verdict" className={toneTextClass(row.tone)}>
                  {verdictLabel(row.verdict)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableFrame>
    </div>
  );
}

function EquipmentImpactTable({ impacts }: { impacts: EquipmentChangeImpact[] }) {
  if (impacts.length === 0) {
    return (
      <EmptyPanel icon={AlertTriangle} text="Log a club setup and retest to prove the change." />
    );
  }

  return (
    <div
      id="simulator-equipment-impact"
      className="grid scroll-mt-28 gap-3"
      data-workbench-scope="simulator-equipment-impact"
    >
      <DesktopTableWorkbenchControls
        viewKey="simulator-equipment-impact"
        scope="simulator-equipment-impact"
        currentViewLabel="Equipment impact"
        resultLabel={`${impacts.length.toLocaleString("en-GB")} changes`}
        columns={equipmentImpactColumns}
        suggestedViews={equipmentImpactSuggestedViews}
        exportTableId="simulator-equipment-impact"
        exportFileName="forekinghell-simulator-equipment-impact.csv"
      />
      <DataTableFrame
        label="Simulator equipment impact table"
        stickyFirstColumn
        mobile={
          <MobileDataList>
            {impacts.map((impact) => (
              <MobileDataCard
                key={impact.id}
                title={`${impact.clubLabel} / ${dateFormatter.format(impact.effectiveFrom)}`}
                subtitle={impact.equipmentLabel}
                action={<span className={toneTextClass(impact.tone)}>{impact.verdict}</span>}
              >
                <MobileMetric
                  label="Before/after"
                  value={`${impact.beforeShotCount}/${impact.afterShotCount}`}
                />
                <MobileMetric label="Carry" value={formatDelta(impact.carryDeltaYd, "yd")} />
                <MobileMetric label="Ball" value={formatDelta(impact.ballSpeedDeltaMph, "mph")} />
                <MobileMetric label="Offline" value={formatDelta(impact.offlineDeltaYd, "yd")} />
              </MobileDataCard>
            ))}
          </MobileDataList>
        }
      >
        <Table
          data-workbench-export-table="simulator-equipment-impact"
          aria-describedby="simulator-equipment-impact-summary"
        >
          <TableCaption id="simulator-equipment-impact-summary" className="sr-only">
            Equipment changes with before and after simulator performance windows.
          </TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead
                data-column="change"
                className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Change
              </TableHead>
              <TableHead data-column="samples">Samples</TableHead>
              <TableHead data-column="carry" className="text-right">
                Carry
              </TableHead>
              <TableHead data-column="ball" className="text-right">
                Ball
              </TableHead>
              <TableHead data-column="smash" className="text-right">
                Smash
              </TableHead>
              <TableHead data-column="offline" className="text-right">
                Offline
              </TableHead>
              <TableHead data-column="verdict">Verdict</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {impacts.map((impact) => (
              <TableRow
                key={impact.id}
                tabIndex={0}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TableCell
                  data-column="change"
                  className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  <div className="font-medium">
                    {impact.clubLabel} / {dateFormatter.format(impact.effectiveFrom)}
                  </div>
                  <div className="max-w-sm truncate text-xs text-muted-foreground">
                    {impact.equipmentLabel}
                  </div>
                </TableCell>
                <TableCell data-column="samples">
                  {impact.beforeShotCount}/{impact.afterShotCount}
                </TableCell>
                <TableCell data-column="carry" className="text-right tabular-nums">
                  {formatDelta(impact.carryDeltaYd, "yd")}
                </TableCell>
                <TableCell data-column="ball" className="text-right tabular-nums">
                  {formatDelta(impact.ballSpeedDeltaMph, "mph")}
                </TableCell>
                <TableCell data-column="smash" className="text-right tabular-nums">
                  {formatDelta(impact.smashDelta, "")}
                </TableCell>
                <TableCell data-column="offline" className="text-right tabular-nums">
                  {formatDelta(impact.offlineDeltaYd, "yd")}
                </TableCell>
                <TableCell data-column="verdict" className={toneTextClass(impact.tone)}>
                  {impact.verdict}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableFrame>
    </div>
  );
}

function EmptyPanel({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="apple-panel flex items-center gap-3 rounded-lg p-4 text-sm text-muted-foreground">
      <Icon className="size-5" />
      <span>{text}</span>
      <Button asChild variant="ghost" size="sm" className="ml-auto">
        <Link href="/import" prefetch={false}>
          Open
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

function formatDelta(value: number | null, unit: string) {
  if (value === null) return "--";
  const suffix = unit ? ` ${unit}` : "";
  return `${value >= 0 ? "+" : ""}${numberFormatter.format(value)}${suffix}`;
}

function verdictLabel(value: SessionDeltaRow["verdict"]) {
  if (value === "better") return "Better";
  if (value === "worse") return "Worse";
  if (value === "mixed") return "Mixed";
  return "Building";
}

function toneTextClass(tone: "green" | "sky" | "amber" | "pink" | "slate") {
  return cn(
    "font-medium",
    tone === "green" && "text-emerald-700",
    tone === "sky" && "text-sky-700",
    tone === "amber" && "text-amber-700",
    tone === "pink" && "text-rose-700",
    tone === "slate" && "text-slate-600",
  );
}
