import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Brain, ChartNoAxesCombined, Target } from "lucide-react";

import {
  DataPanel,
  DataPair,
  DataTableFrame,
  MetricCard,
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
import { sessions, strokesGainedShotEvents } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { summarizeStrokesGained, summarizeStrokesGainedByCategory } from "@/lib/strokes-gained";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function StrokesGainedPage() {
  const data = await getStrokesGainedData();
  const totals = summarizeStrokesGained(data.events.map((event) => event.strokesGained));
  const categorySummaries = summarizeStrokesGainedByCategory(data.events);
  const weakestCategory = categorySummaries.find((summary) => summary.sampleSize > 0)?.category ?? "No sample";

  return (
    <PageShell size="7xl">
      <div className="flex items-center justify-between gap-4">
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
        eyebrow={<StatusPill tone="sky">Strokes gained</StatusPill>}
        title="Strokes-gained dashboard"
        description="Track tee, approach, short-game, and putting value from imported mapped rounds and shot-to-hole edits."
        metrics={[
          { label: "Events", value: data.events.length.toString(), detail: "Round shot-event rows" },
          { label: "Total SG", value: formatNumber(totals.total), detail: "Across finite events" },
          { label: "Weakest category", value: weakestCategory, detail: "Prioritised for practice plans" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categorySummaries.length > 0 ? (
          categorySummaries.map((summary) => (
            <MetricCard
              key={summary.category}
              label={titleCase(summary.category)}
              value={formatNumber(summary.total)}
              detail={`${summary.sampleSize} events, ${formatNumber(summary.average)} avg`}
              icon={Target}
              tone={summary.total !== null && summary.total < 0 ? "amber" : "green"}
            />
          ))
        ) : (
          <DataPanel className="md:col-span-2 xl:col-span-4">
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">
                No strokes-gained events yet. Add shot-to-hole mapping for rounds, then this dashboard will show category losses and gains.
              </p>
            </CardContent>
          </DataPanel>
        )}
      </section>

      <DataPanel>
        <SectionHeader
          title="Recent shot events"
          description="Detailed rows used by dashboards and AI practice-plan context."
          action={<ChartNoAxesCombined className="size-5 text-sky-600" />}
        />
        <CardContent>
          <StrokesGainedEventTable events={data.events} />
        </CardContent>
      </DataPanel>
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
    .limit(200);

  return { events };
}

function StrokesGainedEventTable({ events }: { events: Awaited<ReturnType<typeof getStrokesGainedData>>["events"] }) {
  return (
    <DataTableFrame
      mobile={
        <MobileDataList empty={<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No event rows yet.</p>}>
          {events.map((event) => (
            <MobileDataCard
              key={event.id}
              title={titleCase(event.category)}
              subtitle={`${event.courseName ?? "Round"} - ${formatDate(event.sessionDate)}`}
              href={`/rounds/${event.sessionId}`}
              action={<StatusPill tone={event.strokesGained !== null && event.strokesGained < 0 ? "amber" : "green"}>{formatNumber(event.strokesGained)}</StatusPill>}
            >
              <DataPair label="Hole / stroke" value={`${event.holeNumber ?? "--"} / ${event.strokeNumber ?? "--"}`} />
              <DataPair label="Start" value={`${formatNumber(event.startDistanceYd)} yd ${event.startLie}`} />
              <DataPair label="End" value={`${formatNumber(event.endDistanceYd)} yd ${event.endLie ?? "--"}`} />
            </MobileDataCard>
          ))}
        </MobileDataList>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Round</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Hole</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead className="text-right">SG</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length > 0 ? (
            events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <Link href={`/rounds/${event.sessionId}`} className="font-medium text-emerald-700 hover:underline">
                    {event.courseName ?? "Round"}
                  </Link>
                  <p className="text-xs text-muted-foreground">{formatDate(event.sessionDate)}</p>
                </TableCell>
                <TableCell>{titleCase(event.category)}</TableCell>
                <TableCell>{event.holeNumber ?? "--"} / {event.strokeNumber ?? "--"}</TableCell>
                <TableCell>{formatNumber(event.startDistanceYd)} yd {event.startLie}</TableCell>
                <TableCell>{formatNumber(event.endDistanceYd)} yd {event.endLie ?? "--"}</TableCell>
                <TableCell className="text-right font-semibold">{formatNumber(event.strokesGained)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No event rows yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DataTableFrame>
  );
}

function formatNumber(value: number | null) {
  return typeof value === "number" ? numberFormatter.format(value) : "--";
}

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
