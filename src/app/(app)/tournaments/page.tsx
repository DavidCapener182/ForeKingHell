import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { DataTableFrame, PageHeader, PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLabel, getTournamentsPageData } from "@/lib/tournaments";
import { TournamentIndexControls } from "@/app/tournaments/tournament-index-controls";
import boardStyles from "@/app/course-records/course-record-board.module.css";
export const dynamic = "force-dynamic";
type TournamentListItem = Awaited<ReturnType<typeof getTournamentsPageData>>["tournaments"][number];
type TournamentIndexTab = "upcoming" | "active" | "completed";
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export default async function TournamentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; courseId?: string; q?: string; sort?: string }>;
}) {
  const [params, data] = await Promise.all([searchParams, getTournamentsPageData()]);
  const tab = parseTournamentIndexTab(params?.tab);
  const courseId = params?.courseId?.trim() ?? "";
  const q = params?.q?.trim() ?? "";
  const sort = params?.sort === "name" ? "name" : "date";
  const filtered = data.tournaments.filter(
    (event) =>
      (!courseId || event.courseId === courseId) &&
      `${event.title} ${event.courseName} ${event.teeSetName}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const events = filterTournamentEvents(filtered, tab).sort((a, b) =>
    sort === "name"
      ? a.title.localeCompare(b.title)
      : (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0),
  );
  const counts = {
    upcoming: filterTournamentEvents(filtered, "upcoming").length,
    active: filterTournamentEvents(filtered, "active").length,
    completed: filterTournamentEvents(filtered, "completed").length,
  };
  return (
    <PageShell>
      <PageHeader
        title="Tournaments"
        description="Find an event and inspect its format, dates and entry state."
        actions={
          <Button asChild variant="outline">
            <Link href="/course-records">Course records</Link>
          </Button>
        }
      />
      <TournamentIndexControls
        active={tab}
        courseId={courseId}
        q={q}
        sort={sort}
        courses={data.courseOptions}
        counts={counts}
      >
        <p role="status" className="text-sm">
          {events.length} {tab} events match the selected filters ·{" "}
          {events.filter((event) => event.viewerEntered).length} of your entries in this view.
          Showing the loaded calendar (latest 80 maximum).
        </p>
        <div className={boardStyles.desktop}>
          <TournamentEventTable events={events} activeTab={tab} />
        </div>
        <div className={boardStyles.mobile}>
          <TournamentMobileList events={events} activeTab={tab} />
        </div>
      </TournamentIndexControls>
    </PageShell>
  );
}
function TournamentEventTable({
  events,
  activeTab,
}: {
  events: TournamentListItem[];
  activeTab: TournamentIndexTab;
}) {
  return (
    <DataTableFrame mainTable mainTableLabel="Tournament event list" stickyFirstColumn>
      <Table aria-describedby="tournament-event-list-summary">
        <TableCaption id="tournament-event-list-summary" className="sr-only">
          {tournamentTabHeading(activeTab)} showing event name, venue, dates, format, status,
          entries and your state.
        </TableCaption>
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
          <TableRow>
            <TableHead className="sticky left-0 z-20 min-w-72 bg-muted">Event</TableHead>
            <TableHead className="min-w-56">Venue / course</TableHead>
            <TableHead className="min-w-44">Dates</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Entries</TableHead>
            <TableHead className="min-w-40">Your state</TableHead>
            <TableHead className="w-14">
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length > 0 ? (
            events.map((event) => (
              <TableRow key={event.id} className="group" data-tournament-event-row>
                <TableCell className="sticky left-0 z-10 min-w-72 bg-card py-4">
                  <Link
                    href={`/tournaments/${event.id}`}
                    prefetch={false}
                    className="font-semibold text-foreground group-hover:text-primary"
                  >
                    {event.title}
                  </Link>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {event.description || tournamentTypeLabel(event)}
                  </p>
                </TableCell>
                <TableCell className="py-4">
                  <span className="font-medium">{event.courseName}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {event.teeSetName}
                  </span>
                </TableCell>
                <TableCell className="py-4">{formatTournamentWindow(event)}</TableCell>
                <TableCell className="py-4">{formatLabel(event.format)}</TableCell>
                <TableCell className="py-4">
                  <EventStatusBadge event={event} />
                </TableCell>
                <TableCell className="py-4 text-right tabular-nums">{event.entryCount}</TableCell>
                <TableCell className="py-4 font-medium">{tournamentYourState(event)}</TableCell>
                <TableCell className="py-4 text-right">
                  <Button asChild variant="ghost" size="icon-sm" className="min-h-11 min-w-11">
                    <Link
                      href={`/tournaments/${event.id}`}
                      prefetch={false}
                      aria-label={`Open ${event.title}`}
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="p-5">
                <AppEmptyState
                  title={`No ${activeTab} tournaments`}
                  description="There are no events in this part of the calendar right now."
                  primaryAction={
                    activeTab === "active" ? undefined : (
                      <Button asChild variant="outline">
                        <Link href="/tournaments">View active tournaments</Link>
                      </Button>
                    )
                  }
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DataTableFrame>
  );
}

function TournamentMobileList({
  events,
  activeTab,
}: {
  events: TournamentListItem[];
  activeTab: TournamentIndexTab;
}) {
  return (
    <div className="grid gap-3">
      {events.length ? (
        events.map((event) => (
          <article
            key={event.id}
            className="grid gap-3 rounded-xl border bg-card p-4"
            data-tournament-event-row
          >
            <EventStatusBadge event={event} />
            <h2 className="break-words text-lg font-semibold">{event.title}</h2>
            <p className="text-sm">
              {event.courseName} · {event.teeSetName}
            </p>
            <p className="text-sm">
              {formatTournamentWindow(event)} · {tournamentYourState(event)}
            </p>
            <details>
              <summary className="min-h-11 cursor-pointer content-center font-medium">
                Format, entry and event details
              </summary>
              <p className="mt-2 break-words text-sm">
                {event.description || tournamentTypeLabel(event)}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <MobileFact label="Format" value={formatLabel(event.format)} />
                <MobileFact label="Entries" value={String(event.entryCount)} />
                <MobileFact label="Visibility" value={event.visibility} />
                <MobileFact label="Event status" value={event.status} />
              </dl>
            </details>
            <Button asChild variant="outline" className="min-h-11 justify-self-start">
              <Link href={`/tournaments/${event.id}`}>
                {tournamentEventState(event) === "completed"
                  ? "View results and event"
                  : "Open event"}
              </Link>
            </Button>
          </article>
        ))
      ) : (
        <p className="rounded-xl border p-4">
          No {activeTab} events match this filter. Change the status or clear the filters above.
        </p>
      )}
    </div>
  );
}
function MobileFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function EventStatusBadge({ event }: { event: TournamentListItem }) {
  const state = tournamentEventState(event);
  return (
    <Badge variant={state === "active" ? "secondary" : "outline"}>
      {state === "active"
        ? "Active"
        : state === "completed"
          ? event.status === "cancelled"
            ? "Cancelled"
            : "Completed / closed"
          : "Upcoming"}
    </Badge>
  );
}

function filterTournamentEvents(events: TournamentListItem[], tab: TournamentIndexTab) {
  return events.filter((event) => tournamentEventState(event) === tab);
}

function tournamentEventState(event: TournamentListItem): TournamentIndexTab {
  const now = Date.now();
  const status = event.status.toLowerCase();
  if (
    status === "cancelled" ||
    status === "completed" ||
    status === "closed" ||
    status === "finished" ||
    Boolean(event.endsAt && event.endsAt.getTime() < now)
  ) {
    return "completed";
  }
  if (
    status === "draft" ||
    status === "scheduled" ||
    status === "upcoming" ||
    Boolean(event.startsAt && event.startsAt.getTime() > now)
  ) {
    return "upcoming";
  }
  return "active";
}

function tournamentYourState(event: TournamentListItem) {
  if (!event.viewerEntered) {
    return tournamentEventState(event) === "active" ? "Check entry requirements" : "Not entered";
  }
  if (event.viewerRoundsDue === 0) {
    return event.viewerRank ? `Finished · #${event.viewerRank}` : "Rounds complete";
  }
  const prefix = event.viewerRank ? `#${event.viewerRank} · ` : "";
  return `${prefix}${event.viewerRoundsDue} round${event.viewerRoundsDue === 1 ? "" : "s"} due`;
}

function tournamentTypeLabel(event: TournamentListItem) {
  if (event.scheduleEyebrow) return event.scheduleEyebrow;
  if (event.scheduleKind === "daily") return "Daily tournament";
  if (event.scheduleKind === "weekly") return "Weekly open";
  if (event.scheduleKind === "monthly") return "Monthly major";
  return event.visibility === "public" ? "Public tournament" : "Private tournament";
}

function formatTournamentWindow(event: TournamentListItem) {
  const startsAt = event.startsAt ? dateFormatter.format(event.startsAt) : "Open";
  const endsAt = event.endsAt ? dateFormatter.format(event.endsAt) : "No closing date";
  return event.startsAt && event.endsAt && startsAt === endsAt
    ? startsAt
    : `${startsAt} – ${endsAt}`;
}

function tournamentTabHeading(tab: TournamentIndexTab) {
  if (tab === "upcoming") return "Upcoming tournaments";
  if (tab === "completed") return "Completed tournaments";
  return "Active tournaments";
}

function parseTournamentIndexTab(value?: string): TournamentIndexTab {
  if (value === "upcoming" || value === "completed") return value;
  if (value === "past") return "completed";
  return "active";
}
