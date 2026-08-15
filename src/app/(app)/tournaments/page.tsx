import Link from "next/link";
import { ArrowLeft, ChevronRight, Trophy } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { MobilePageTabs } from "@/components/app/mobile-controls";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { MobileAppShell, MobileTopBar, NativeListSection } from "@/components/mobile-sports";
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
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { formatLabel, getTournamentsPageData } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

type TournamentListItem = Awaited<ReturnType<typeof getTournamentsPageData>>["tournaments"][number];
type TournamentIndexTab = "upcoming" | "active" | "completed";

type TournamentsPageProps = {
  searchParams?: Promise<{ tab?: string; courseId?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function TournamentsPage({ searchParams }: TournamentsPageProps) {
  const params = await searchParams;
  const [data, surface] = await Promise.all([getTournamentsPageData(), getRequestAppSurface()]);
  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkbenchLayout = workbench?.DesktopWorkbenchLayout;
  const activeTab = parseTournamentIndexTab(params?.tab);
  const courseId = params?.courseId?.trim() || null;
  const courseFilter = courseId
    ? (data.courseOptions.find((course) => course.courseId === courseId) ?? null)
    : null;
  const courseTournaments = courseId
    ? data.tournaments.filter((tournament) => tournament.courseId === courseId)
    : data.tournaments;
  const visibleTournaments = filterTournamentEvents(courseTournaments, activeTab);
  const activeCount = courseTournaments.filter(
    (tournament) => tournamentEventState(tournament) === "active",
  ).length;
  const enteredCount = courseTournaments.filter((tournament) => tournament.viewerEntered).length;

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>
          <MobileTopBar title={courseId ? "Course events" : "Tournaments"} />
          {courseFilter ? (
            <div className="flex items-center justify-between gap-3 rounded-[var(--mobile-radius-md)] bg-card px-4 py-3 text-sm">
              <span className="min-w-0 truncate">Course: {courseFilter.courseName}</span>
              <Link href="/tournaments" className="shrink-0 font-semibold text-primary">
                Clear
              </Link>
            </div>
          ) : null}
          <MobilePageTabs
            initialValue={activeTab}
            ariaLabel="Tournament status"
            tabs={tournamentTabs(courseId).map((tab) => {
              const events = filterTournamentEvents(courseTournaments, tab.key);
              return {
                value: tab.key,
                label: tab.label,
                href: tab.href,
                content: (
                  <div className="grid gap-4">
                    <section className="rounded-[var(--mobile-radius-lg)] bg-card px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                        Event calendar
                      </p>
                      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                        {tournamentTabHeading(tab.key)}
                      </h1>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {events.length} {events.length === 1 ? "event" : "events"}
                        {courseFilter ? ` at ${courseFilter.courseName}` : ""}
                      </p>
                    </section>
                    <NativeListSection title={tournamentTabHeading(tab.key)}>
                      <TournamentMobileList events={events} activeTab={tab.key} />
                    </NativeListSection>
                  </div>
                ),
              };
            })}
          />
        </MobileAppShell>
      ) : null}

      {surface === "workbench" && DesktopWorkbenchLayout ? (
        <DesktopWorkbenchLayout scope="tournaments">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/challenges" prefetch={false}>
                <ArrowLeft className="size-4" />
                Challenges
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/course-records" prefetch={false}>
                <Trophy className="size-4" />
                Course records
              </Link>
            </Button>
          </div>

          <header className="premium-hero overflow-hidden p-0">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-5 sm:p-7 lg:p-8">
                <StatusPill tone="amber">Tournament centre</StatusPill>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance">
                  Events worth playing for
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Find the event, know the format and see exactly where your entry stands before you
                  open the tournament.
                </p>
              </div>
              <div className="grid grid-cols-3 border-t border-border bg-muted/45 lg:grid-cols-1 lg:border-t-0 lg:border-l">
                <EventMetric label="Active now" value={activeCount} />
                <EventMetric label="Your entries" value={enteredCount} />
                <EventMetric label="On calendar" value={courseTournaments.length} />
              </div>
            </div>
          </header>

          {courseFilter ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{courseFilter.courseName}</p>
                <p className="text-xs text-muted-foreground">Showing events at this course only.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/tournaments">Clear course filter</Link>
              </Button>
            </div>
          ) : null}

          <TournamentIndexTabs activeTab={activeTab} courseId={courseId} />
          <TournamentEventTable events={visibleTournaments} activeTab={activeTab} />
        </DesktopWorkbenchLayout>
      ) : null}
    </PageShell>
  );
}

function TournamentIndexTabs({
  activeTab,
  courseId,
}: {
  activeTab: TournamentIndexTab;
  courseId: string | null;
}) {
  return (
    <nav
      aria-label="Tournament status"
      className="flex w-full gap-1 overflow-x-auto rounded-xl border bg-muted/45 p-1"
      data-tournament-status-tabs
    >
      {tournamentTabs(courseId).map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "min-h-11 flex-1 rounded-lg bg-card px-4 py-2.5 text-center text-sm font-semibold text-foreground shadow-sm ring-1 ring-border"
                : "min-h-11 flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-muted-foreground hover:bg-card/70 hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
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
                  <p className="mt-1 line-clamp-1 max-w-md text-xs text-muted-foreground">
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
                  <Button asChild variant="ghost" size="icon-sm">
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
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/35 p-4 text-sm text-muted-foreground">
        No {activeTab} tournaments are available right now.
      </div>
    );
  }

  return (
    <ol className="overflow-hidden rounded-xl border border-border bg-card">
      {events.map((event) => (
        <li key={event.id} className="border-b border-border last:border-b-0">
          <Link
            href={`/tournaments/${event.id}`}
            prefetch={false}
            className="block p-4 active:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <EventStatusBadge event={event} />
                  {event.viewerEntered ? <Badge variant="outline">Entered</Badge> : null}
                </div>
                <h2 className="mt-2 text-lg font-semibold tracking-tight">{event.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {event.courseName} · {event.teeSetName}
                </p>
              </div>
              <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-sm">
              <MobileFact label="Dates" value={formatTournamentWindow(event)} />
              <MobileFact label="Format" value={formatLabel(event.format)} />
              <MobileFact label="Entries" value={String(event.entryCount)} />
              <MobileFact label="Your state" value={tournamentYourState(event)} />
            </dl>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function EventMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-border px-4 py-4 last:border-r-0 lg:border-r-0 lg:border-b lg:last:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
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
      {state === "active" ? "Active" : state === "completed" ? "Completed" : "Upcoming"}
    </Badge>
  );
}

function tournamentTabs(courseId: string | null) {
  const tabs: Array<{ key: TournamentIndexTab; label: string }> = [
    { key: "upcoming", label: "Upcoming" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
  ];
  return tabs.map((tab) => ({ ...tab, href: tournamentIndexHref(tab.key, courseId) }));
}

function filterTournamentEvents(events: TournamentListItem[], tab: TournamentIndexTab) {
  return events.filter((event) => tournamentEventState(event) === tab);
}

function tournamentEventState(event: TournamentListItem): TournamentIndexTab {
  const now = Date.now();
  const status = event.status.toLowerCase();
  if (
    status === "completed" ||
    status === "closed" ||
    status === "finished" ||
    Boolean(event.endsAt && event.endsAt.getTime() < now)
  ) {
    return "completed";
  }
  if (
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
    return tournamentEventState(event) === "active" ? "Open to enter" : "Not entered";
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

function tournamentIndexHref(tab: TournamentIndexTab, courseId: string | null) {
  const params = new URLSearchParams();
  if (tab !== "active") params.set("tab", tab);
  if (courseId) params.set("courseId", courseId);
  const query = params.toString();
  return query ? `/tournaments?${query}` : "/tournaments";
}
