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
    </PageShell>
  );
}

function SessionDeltaTable({ rows }: { rows: SessionDeltaRow[] }) {
  if (rows.length === 0) {
    return <EmptyPanel icon={Database} text="Import a simulator session to unlock 30-day deltas." />;
  }

  return (
    <DataTableFrame
      mobile={
        <MobileDataList>
          {rows.map((row) => (
            <MobileDataCard
              key={row.clubType}
              title={row.clubLabel}
              subtitle={row.summary}
              action={<span className={toneTextClass(row.tone)}>{verdictLabel(row.verdict)}</span>}
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Club</TableHead>
            <TableHead>Samples</TableHead>
            <TableHead className="text-right">Carry</TableHead>
            <TableHead className="text-right">Ball</TableHead>
            <TableHead className="text-right">Smash</TableHead>
            <TableHead className="text-right">Offline</TableHead>
            <TableHead>Verdict</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.clubType}>
              <TableCell className="font-medium">{row.clubLabel}</TableCell>
              <TableCell>
                {row.latestShotCount}/{row.baselineShotCount}
              </TableCell>
              <TableCell className="text-right">{formatDelta(row.carryDeltaYd, "yd")}</TableCell>
              <TableCell className="text-right">
                {formatDelta(row.ballSpeedDeltaMph, "mph")}
              </TableCell>
              <TableCell className="text-right">{formatDelta(row.smashDelta, "")}</TableCell>
              <TableCell className="text-right">{formatDelta(row.offlineDeltaYd, "yd")}</TableCell>
              <TableCell className={toneTextClass(row.tone)}>{verdictLabel(row.verdict)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTableFrame>
  );
}

function EquipmentImpactTable({ impacts }: { impacts: EquipmentChangeImpact[] }) {
  if (impacts.length === 0) {
    return <EmptyPanel icon={AlertTriangle} text="Log a club setup and retest to prove the change." />;
  }

  return (
    <DataTableFrame
      mobile={
        <MobileDataList>
          {impacts.map((impact) => (
            <MobileDataCard
              key={impact.id}
              title={`${impact.clubLabel} / ${dateFormatter.format(impact.effectiveFrom)}`}
              subtitle={impact.equipmentLabel}
              action={<span className={toneTextClass(impact.tone)}>{impact.verdict}</span>}
            >
              <MobileMetric label="Before/after" value={`${impact.beforeShotCount}/${impact.afterShotCount}`} />
              <MobileMetric label="Carry" value={formatDelta(impact.carryDeltaYd, "yd")} />
              <MobileMetric label="Ball" value={formatDelta(impact.ballSpeedDeltaMph, "mph")} />
              <MobileMetric label="Offline" value={formatDelta(impact.offlineDeltaYd, "yd")} />
            </MobileDataCard>
          ))}
        </MobileDataList>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Change</TableHead>
            <TableHead>Samples</TableHead>
            <TableHead className="text-right">Carry</TableHead>
            <TableHead className="text-right">Ball</TableHead>
            <TableHead className="text-right">Smash</TableHead>
            <TableHead className="text-right">Offline</TableHead>
            <TableHead>Verdict</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {impacts.map((impact) => (
            <TableRow key={impact.id}>
              <TableCell>
                <div className="font-medium">
                  {impact.clubLabel} / {dateFormatter.format(impact.effectiveFrom)}
                </div>
                <div className="max-w-sm truncate text-xs text-muted-foreground">
                  {impact.equipmentLabel}
                </div>
              </TableCell>
              <TableCell>
                {impact.beforeShotCount}/{impact.afterShotCount}
              </TableCell>
              <TableCell className="text-right">{formatDelta(impact.carryDeltaYd, "yd")}</TableCell>
              <TableCell className="text-right">
                {formatDelta(impact.ballSpeedDeltaMph, "mph")}
              </TableCell>
              <TableCell className="text-right">{formatDelta(impact.smashDelta, "")}</TableCell>
              <TableCell className="text-right">{formatDelta(impact.offlineDeltaYd, "yd")}</TableCell>
              <TableCell className={toneTextClass(impact.tone)}>{impact.verdict}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTableFrame>
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
