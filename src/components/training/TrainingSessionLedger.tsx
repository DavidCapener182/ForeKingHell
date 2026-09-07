"use client";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, SectionHeader, StatusPill, type Tone } from "@/components/premium";
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
import type { TrainingRangeKey } from "@/lib/training/ranges";
import type { TrainingSessionListItem } from "@/lib/training/trainingData";
const integerFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const ledgerDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

const trainingSessionColumns: DesktopWorkbenchColumn[] = [
  { id: "date", label: "Date", locked: true },
  { id: "session", label: "Session", locked: true },
  { id: "source", label: "Source" },
  { id: "load", label: "Load" },
  { id: "rpe", label: "RPE" },
  { id: "volume", label: "Volume" },
  { id: "conditions", label: "Conditions" },
  { id: "notes", label: "Notes" },
];

const trainingSessionSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Heavy golf load",
    href: "/stats/training-over-time?range=3m#training-load-sessions",
    detail: "High-load rounds, range work and speed sessions",
  },
  {
    title: "Recent practice rhythm",
    href: "/stats/training-over-time?range=4w#training-load-sessions",
    detail: "Last month of logged golf workload",
  },
  {
    title: "Season build",
    href: "/stats/training-over-time?range=1y#training-load-sessions",
    detail: "Long-range fitness, fatigue and form evidence",
  },
];

export function TrainingSessionLedger({
  sessions,
  rangeKey,
  rangeLabel,
}: {
  sessions: TrainingSessionListItem[];
  rangeKey: TrainingRangeKey;
  rangeLabel: string;
}) {
  return (
    <Card
      id="training-load-sessions"
      className="scroll-mt-28 gap-0 py-0 shadow-sm"
      data-workbench-scope="training-load-sessions"
    >
      <SectionHeader
        title="Training load ledger"
        description="Range, round, speed and manual workload rows behind the selected Training Status range."
        action={<StatusPill tone="sky">{rangeLabel}</StatusPill>}
      />
      <CardContent className="grid gap-3 p-3">
        <DesktopTableWorkbenchControls
          viewKey="training-load-sessions"
          scope="training-load-sessions"
          currentViewLabel={`${rangeLabel} training load`}
          resultLabel={`${integerFormatter.format(sessions.length)} session${sessions.length === 1 ? "" : "s"}`}
          columns={trainingSessionColumns}
          suggestedViews={trainingSessionSuggestedViews}
          exportTableId="training-load-sessions"
          exportFileName={`forekinghell-training-load-${rangeKey}.csv`}
        />
        <DataTableFrame mainTable mainTableLabel="Training load session table" stickyFirstColumn>
          <Table
            data-workbench-export-table="training-load-sessions"
            aria-describedby="training-load-sessions-summary"
          >
            <TableCaption id="training-load-sessions-summary" className="sr-only">
              Training load session table showing date, session, source, workload, RPE, volume,
              conditions and notes for the selected range.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
              <TableRow>
                <TableHead data-column="date" className="sticky left-0 z-20 min-w-28 bg-card">
                  Date
                </TableHead>
                <TableHead data-column="session" className="min-w-64">
                  Session
                </TableHead>
                <TableHead data-column="source">Source</TableHead>
                <TableHead data-column="load" className="text-right">
                  Load
                </TableHead>
                <TableHead data-column="rpe" className="text-right">
                  RPE
                </TableHead>
                <TableHead data-column="volume">Volume</TableHead>
                <TableHead data-column="conditions">Conditions</TableHead>
                <TableHead data-column="notes" className="min-w-72">
                  Notes
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <TableRow key={session.id} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="date"
                      className="sticky left-0 z-10 border-r border-border bg-card font-semibold"
                    >
                      {formatLedgerDate(session.sessionDate)}
                    </TableCell>
                    <TableCell data-column="session">
                      <div className="min-w-0">
                        <p className="max-w-72 truncate font-semibold text-foreground">
                          {session.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.competition ? "Competition" : "Training"} ·{" "}
                          {session.sourceId ? session.sourceId.slice(0, 8) : "manual entry"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell data-column="source">
                      <StatusPill tone={trainingSourceTone(session.sourceType)}>
                        {formatTrainingSource(session.sourceType)}
                      </StatusPill>
                    </TableCell>
                    <TableCell data-column="load" className="text-right tabular-nums">
                      {integerFormatter.format(Math.round(session.sessionLoad))}
                    </TableCell>
                    <TableCell data-column="rpe" className="text-right tabular-nums">
                      {session.rpe}
                    </TableCell>
                    <TableCell data-column="volume">{formatTrainingVolume(session)}</TableCell>
                    <TableCell data-column="conditions">
                      {formatTrainingConditions(session)}
                    </TableCell>
                    <TableCell data-column="notes">
                      <span className="block max-w-80 truncate text-muted-foreground">
                        {session.notes?.trim() || "No notes"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No training load sessions are logged in this range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </Card>
  );
}

function formatLedgerDate(dateKey: string) {
  return ledgerDateFormatter.format(new Date(`${dateKey}T00:00:00.000Z`));
}

function formatTrainingSource(sourceType: TrainingSessionListItem["sourceType"]) {
  switch (sourceType) {
    case "launch_monitor":
      return "Launch monitor";
    case "imported":
      return "Imported";
    case "practice":
      return "Practice";
    case "round":
      return "Round";
    case "manual":
      return "Manual";
  }
}

function trainingSourceTone(sourceType: TrainingSessionListItem["sourceType"]): Tone {
  switch (sourceType) {
    case "round":
      return "green";
    case "manual":
      return "amber";
    default:
      return "sky";
  }
}

function formatTrainingVolume(session: TrainingSessionListItem) {
  if (session.holesPlayed) return `${integerFormatter.format(session.holesPlayed)} holes`;
  if (session.totalSwings) return `${integerFormatter.format(session.totalSwings)} swings`;
  if (session.durationMinutes) return `${integerFormatter.format(session.durationMinutes)} min`;
  return "Manual";
}

function formatTrainingConditions(session: TrainingSessionListItem) {
  const conditions = [
    session.walked ? "Walked" : session.usedCart ? "Cart" : null,
    session.fullSwings ? `${integerFormatter.format(session.fullSwings)} full` : null,
    session.shortGameSwings ? `${integerFormatter.format(session.shortGameSwings)} short` : null,
    session.puttingSwings ? `${integerFormatter.format(session.puttingSwings)} putts` : null,
    session.mentalPressure ? `Pressure ${session.mentalPressure}` : null,
    session.physicalDemand ? `Demand ${session.physicalDemand}` : null,
  ].filter(Boolean);

  return conditions.length > 0 ? conditions.join(" / ") : "Not recorded";
}
