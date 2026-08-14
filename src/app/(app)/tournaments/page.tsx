import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Globe2, Trophy } from "lucide-react";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
} from "@/components/app/ios-mobile";
import {
  EventHeroCard,
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
  TournamentCard as MobileTournamentCard,
} from "@/components/mobile-sports";
import { CompetitionFeaturePanel } from "@/components/features/feature-panels";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { DataFirstFlowPanel, ProofChecklistPanel } from "@/components/product-polish";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { formatLabel, getTournamentsPageData } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

type TournamentListItem = Awaited<ReturnType<typeof getTournamentsPageData>>["tournaments"][number];

type TournamentHubTab = "live" | "mine" | "majors" | "past";

type TournamentsPageProps = {
  searchParams?: Promise<{ tab?: string; courseId?: string }>;
};

const tournamentHubColumns: DesktopWorkbenchColumn[] = [
  { id: "event", label: "Event", locked: true },
  { id: "type", label: "Type" },
  { id: "status", label: "Status" },
  { id: "course", label: "Course" },
  { id: "window", label: "Window" },
  { id: "format", label: "Format" },
  { id: "entries", label: "Entries" },
  { id: "leader", label: "Leader" },
  { id: "proof", label: "Proof" },
  { id: "action", label: "Action", locked: true },
];

const tournamentHubSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Live events",
    href: "/tournaments",
    detail: "Open or scheduled boards ready to enter or review.",
  },
  {
    title: "My events",
    href: "/tournaments?tab=mine",
    detail: "Only tournaments where your entry is already active.",
  },
  {
    title: "Majors",
    href: "/tournaments?tab=majors",
    detail: "Monthly majors and four-round championship formats.",
  },
  {
    title: "Past events",
    href: "/tournaments?tab=past",
    detail: "Closed boards kept for review, proof and records.",
  },
];

export default async function TournamentsPage({ searchParams }: TournamentsPageProps) {
  const params = await searchParams;
  const [data, featureData, surface] = await Promise.all([
    getTournamentsPageData(),
    getFeatureIdeasData(),
    getRequestAppSurface(),
  ]);
  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkbenchLayout = workbench?.DesktopWorkbenchLayout;
  const activeTab = parseTournamentHubTab(params?.tab);
  const courseId = params?.courseId?.trim() || null;
  const courseFilter = courseId
    ? (data.courseOptions.find((course) => course.courseId === courseId) ?? null)
    : null;
  const visibleTournaments = courseId
    ? data.tournaments.filter((tournament) => tournament.courseId === courseId)
    : data.tournaments;
  const visibleEntries = courseId
    ? data.myEntries.filter((tournament) => tournament.courseId === courseId)
    : data.myEntries;
  const scheduledEvents = [
    data.scheduled.daily,
    data.scheduled.weekly,
    data.scheduled.monthly,
  ].filter(
    (event): event is TournamentListItem =>
      Boolean(event) && (!courseId || event?.courseId === courseId),
  );
  const customEvents = visibleTournaments.filter((tournament) => !tournament.scheduleKind);
  const tournamentBoardEvents = filterTournamentHubEvents(visibleTournaments, activeTab);
  const mobileFeatured = tournamentBoardEvents[0] ?? null;
  const mobileRemainingEvents = tournamentBoardEvents.slice(1);
  const mobileStatus = tournamentMobileStatus(activeTab, tournamentBoardEvents);
  const proofItems = buildTournamentProofItems(mobileFeatured);
  const nextEntryWithRoundDue = visibleEntries.find((event) => event.viewerRoundsDue > 0) ?? null;
  const reminderSteps = [
    {
      title: "Daily round",
      detail: data.scheduled.daily
        ? `${data.scheduled.daily.courseName} is open now.`
        : "No daily event scheduled.",
      href: data.scheduled.daily ? `/tournaments/${data.scheduled.daily.id}` : "/tournaments",
      status: data.scheduled.daily ? ("ready" as const) : ("optional" as const),
    },
    {
      title: "Weekly open",
      detail: data.scheduled.weekly
        ? `${data.scheduled.weekly.roundCount} round target this week.`
        : "No weekly event scheduled.",
      href: data.scheduled.weekly ? `/tournaments/${data.scheduled.weekly.id}` : "/tournaments",
      status: data.scheduled.weekly ? ("ready" as const) : ("optional" as const),
    },
    {
      title: "Monthly major",
      detail: data.scheduled.monthly
        ? `${data.scheduled.monthly.roundCount} round${data.scheduled.monthly.roundCount === 1 ? "" : "s"} scheduled at ${data.scheduled.monthly.courseName}.`
        : "No monthly major scheduled.",
      href: data.scheduled.monthly ? `/tournaments/${data.scheduled.monthly.id}` : "/tournaments",
      status: data.scheduled.monthly ? ("ready" as const) : ("optional" as const),
    },
    {
      title: "Proof due",
      detail: nextEntryWithRoundDue
        ? `${nextEntryWithRoundDue.viewerRoundsDue} round${nextEntryWithRoundDue.viewerRoundsDue === 1 ? "" : "s"} still due in ${nextEntryWithRoundDue.title}.`
        : visibleEntries.length > 0
          ? "All required rounds are submitted in your visible entries."
          : "Enter an event before submission proof is required.",
      href: nextEntryWithRoundDue
        ? `/tournaments/${nextEntryWithRoundDue.id}?tab=submit`
        : "/tournaments?tab=mine",
      status: nextEntryWithRoundDue
        ? ("needed" as const)
        : visibleEntries.length > 0
          ? ("ready" as const)
          : ("optional" as const),
    },
    {
      title: "Entry status",
      detail: `${visibleEntries.length} event${visibleEntries.length === 1 ? "" : "s"} entered.`,
      href: tournamentHubHref("mine", courseId),
      status: visibleEntries.length > 0 ? ("ready" as const) : ("optional" as const),
    },
  ];
  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>
          <MobileTopBar title={courseId ? "Course tournaments" : "Tournaments"} />
          <MobileRouteTabs group="play" activeKey="tournaments" />
          <MobileTabBar
            activeKey={activeTab}
            className="-mt-4"
            tabs={[
              { key: "live", label: "Live", href: tournamentHubHref("live", courseId) },
              { key: "mine", label: "My Events", href: tournamentHubHref("mine", courseId) },
              { key: "majors", label: "Majors", href: tournamentHubHref("majors", courseId) },
              { key: "past", label: "Past", href: tournamentHubHref("past", courseId) },
            ]}
          />
          {courseId ? (
            <IOSGroupedList label="Applied tournament filters">
              <IOSListRow
                label="Course filter"
                value={courseFilter?.courseName ?? "Selected course"}
                detail="Only tournaments attached to this course are shown."
                href="/tournaments"
                ariaLabel="Clear course tournament filter"
              />
            </IOSGroupedList>
          ) : null}
          <MobileStatusAction
            label={mobileStatus.label}
            value={mobileStatus.value}
            detail={mobileStatus.detail}
            action={
              mobileFeatured ? (
                <Button asChild className="rounded-full">
                  <Link href={`/tournaments/${mobileFeatured.id}`} prefetch={false}>
                    {tournamentActionLabel(mobileFeatured)}
                  </Link>
                </Button>
              ) : null
            }
          />
          {mobileFeatured ? (
            <EventHeroCard
              eyebrow={mobileFeatured.scheduleEyebrow ?? tournamentTypeLabel(mobileFeatured)}
              title={mobileFeatured.title}
              description={`${mobileFeatured.courseName} · ${mobileFeatured.teeSetName} · ${tournamentEvidenceSummary(mobileFeatured)}`}
              href={`/tournaments/${mobileFeatured.id}`}
              actionLabel={tournamentActionLabel(mobileFeatured)}
              media={
                <PageArtwork
                  variant="tourCover"
                  alt=""
                  cropKey={mobileFeatured.id}
                  className="block h-full min-h-0 rounded-none"
                  sizes="(min-width: 640px) 640px, calc(100vw - 2rem)"
                  priority
                />
              }
              meta={
                <span>
                  {mobileFeatured.leader
                    ? `Leader: ${mobileFeatured.leader.displayName} · ${mobileFeatured.leader.grossTotal}`
                    : "No accepted score yet"}
                  {` · ${mobileFeatured.entryCount} ${mobileFeatured.entryCount === 1 ? "entry" : "entries"}`}
                </span>
              }
              joined={
                mobileFeatured.viewerEntered ? <Badge variant="secondary">Entered</Badge> : null
              }
            />
          ) : null}
          <NativeListSection
            title={tournamentMobileListTitle(activeTab)}
            description={
              mobileRemainingEvents.length > 0
                ? `${mobileRemainingEvents.length} more ${mobileRemainingEvents.length === 1 ? "event" : "events"}`
                : mobileFeatured
                  ? "The selected event is shown above."
                  : undefined
            }
          >
            {mobileRemainingEvents.length > 0 ? (
              mobileRemainingEvents.slice(0, 9).map((event) => (
                <MobileTournamentCard
                  key={event.id}
                  title={event.title}
                  description={`${event.courseName} · ${event.teeSetName}`}
                  href={`/tournaments/${event.id}`}
                  cta={tournamentActionLabel(event)}
                  leader={
                    event.leader
                      ? `Leader: ${event.leader.displayName} · ${event.leader.grossTotal}`
                      : "No accepted score yet"
                  }
                  meta={
                    <>
                      <span>{event.roundCount} rounds</span>
                      <span>{event.entryCount} entries</span>
                      <span>{formatLabel(event.format)}</span>
                    </>
                  }
                />
              ))
            ) : mobileFeatured ? (
              <IOSGroupedList label="Tournament list status">
                <IOSListRow
                  label="No other events in this view"
                  detail="Change the tournament tab to browse another event group."
                />
              </IOSGroupedList>
            ) : (
              <IOSGroupedList label="Tournament list status">
                <IOSListRow
                  label="No tournaments in this view"
                  detail={tournamentMobileEmptyDetail(activeTab)}
                />
              </IOSGroupedList>
            )}
          </NativeListSection>

          <MobileTournamentEvidence
            event={mobileFeatured}
            proofItems={proofItems}
            reminderSteps={reminderSteps}
          />
          <CompetitionFeaturePanel data={featureData} />
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
                Records
              </Link>
            </Button>
          </div>

          <>
            <header className="premium-hero p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <StatusPill tone="amber">Tournament schedule</StatusPill>
                  <h1 className="mt-3 text-3xl font-semibold tracking-normal text-balance">
                    Daily, weekly and monthly events
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Tour-style competition without the setup form first. Daily events rotate through{" "}
                    {data.dailyCourseCount} Rapsodo-friendly tour venues, weekly opens run all week,
                    and monthly majors use famous championship venues.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{visibleTournaments.length} visible events</Badge>
                  <Badge variant="outline">{visibleEntries.length} entered</Badge>
                  <Badge variant="outline">
                    {visibleEntries.reduce(
                      (total, event) => total + event.viewerSubmissionCount,
                      0,
                    )}
                    {" submitted rounds"}
                  </Badge>
                </div>
              </div>
            </header>

            <section className="grid gap-3 lg:grid-cols-3">
              {scheduledEvents.map((event, index) => (
                <ScheduledTournamentCard key={event.id} event={event} priority={index === 0} />
              ))}
            </section>

            {mobileFeatured && proofItems.length > 0 ? (
              <ProofChecklistPanel
                title={`${mobileFeatured.title} proof`}
                description="Stored submissions and event-specific proof requirements for the selected tournament view."
                items={proofItems}
                actionHref={`/tournaments/${mobileFeatured.id}`}
                actionLabel={mobileFeatured.viewerEntered ? "Open entry" : "Open event"}
              />
            ) : null}

            <DataFirstFlowPanel
              title="Round due reminders"
              description="Show the next daily, weekly and monthly tournament obligations before the full event list."
              steps={reminderSteps}
              actionHref={tournamentHubHref("mine", courseId)}
              actionLabel="My events"
            />

            <CompetitionFeaturePanel data={featureData} />

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section className="grid gap-4">
                <TournamentHubEventTable
                  activeTab={activeTab}
                  customCount={customEvents.length}
                  events={tournamentBoardEvents}
                  totalCount={visibleTournaments.length}
                  courseId={courseId}
                />
              </section>

              <section className="grid gap-4 xl:sticky xl:top-28">
                <Card className="gap-0 py-0">
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <CalendarDays className="size-4 text-primary" />
                      Rotation rules
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="mt-3 grid gap-2 text-sm">
                      <RuleRow label="Daily" value="1 round, new global course every day" />
                      <RuleRow label="Weekly Open" value="2 rounds, Monday to Sunday" />
                      <RuleRow label="Monthly Major" value="4 rounds on a famous course" />
                      <RuleRow label="Proof" value="Requirements vary by event and submission" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="gap-0 py-0">
                  <CardHeader className="p-4 pb-0">
                    <CardTitle className="text-sm font-semibold">Formats</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="mt-3 grid gap-2">
                      {data.templates.map((template) => (
                        <div key={template.id} className="rounded-lg bg-muted/55 px-3 py-2 text-sm">
                          <p className="font-medium">{template.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {template.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>
            </section>
          </>
        </DesktopWorkbenchLayout>
      ) : null}
    </PageShell>
  );
}

async function TournamentHubEventTable({
  activeTab,
  courseId,
  customCount,
  events,
  totalCount,
}: {
  activeTab: TournamentHubTab;
  courseId: string | null;
  customCount: number;
  events: TournamentListItem[];
  totalCount: number;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");

  return (
    <Card
      id="tournament-event-board"
      className="scroll-mt-28 gap-0 py-0"
      data-workbench-scope="tournament-events"
    >
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Tournament event board</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Scheduled events stay pinned above. Use the board for entry status, proof level,
              leader and the next event action.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{events.length} shown</Badge>
            <Badge variant="outline">{totalCount} total</Badge>
            <Badge variant="outline">{customCount} custom</Badge>
          </div>
        </div>

        <TournamentHubFilterTabs activeTab={activeTab} courseId={courseId} />

        <div className="mt-4 grid gap-3">
          <DesktopTableWorkbenchControls
            viewKey={`tournament-events-${activeTab}`}
            scope="tournament-events"
            currentViewLabel={tournamentHubViewLabel(activeTab)}
            resultLabel={`${events.length} events`}
            columns={tournamentHubColumns}
            suggestedViews={tournamentHubSuggestedViews}
            exportTableId="tournament-events"
            exportFileName={`forekinghell-tournament-events-${activeTab}.csv`}
          />
          <DataTableFrame mainTable mainTableLabel="Tournament event board table" stickyFirstColumn>
            <Table
              data-workbench-export-table="tournament-events"
              aria-describedby="tournament-events-summary"
            >
              <TableCaption id="tournament-events-summary" className="sr-only">
                Tournament event board table showing event, type, status, course, event window,
                format, entries, leader, proof level and action link.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <TableRow>
                  <TableHead
                    data-column="event"
                    className="sticky left-0 z-20 min-w-64 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    Event
                  </TableHead>
                  <TableHead data-column="type">Type</TableHead>
                  <TableHead data-column="status">Status</TableHead>
                  <TableHead data-column="course">Course</TableHead>
                  <TableHead data-column="window">Window</TableHead>
                  <TableHead data-column="format">Format</TableHead>
                  <TableHead data-column="entries">Entries</TableHead>
                  <TableHead data-column="leader">Leader</TableHead>
                  <TableHead data-column="proof">Proof</TableHead>
                  <TableHead data-column="action" className="text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length > 0 ? (
                  events.map((event) => (
                    <TableRow key={event.id} tabIndex={0} className="focus-aaa outline-none">
                      <TableCell
                        data-column="event"
                        className="sticky left-0 z-10 min-w-64 bg-card font-medium shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                      >
                        <Link
                          href={`/tournaments/${event.id}`}
                          prefetch={false}
                          className="text-primary hover:underline"
                        >
                          {event.scheduleKind === "monthly" ? "Monthly Major" : event.title}
                        </Link>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {event.description}
                        </p>
                      </TableCell>
                      <TableCell data-column="type">{tournamentTypeLabel(event)}</TableCell>
                      <TableCell data-column="status">
                        <Badge variant={isPastTournamentEvent(event) ? "outline" : "secondary"}>
                          {event.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell data-column="course">
                        <span className="font-medium">{event.courseName}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {event.teeSetName}
                        </span>
                      </TableCell>
                      <TableCell data-column="window">{formatTournamentWindow(event)}</TableCell>
                      <TableCell data-column="format">{formatLabel(event.format)}</TableCell>
                      <TableCell data-column="entries">{event.entryCount}</TableCell>
                      <TableCell data-column="leader">
                        {event.leader
                          ? `${event.leader.displayName} · ${event.leader.grossTotal}`
                          : "No score yet"}
                      </TableCell>
                      <TableCell data-column="proof">{tournamentProofLabel(event)}</TableCell>
                      <TableCell data-column="action" className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/tournaments/${event.id}`} prefetch={false}>
                            {event.viewerEntered ? "Open entry" : "Open event"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="p-4">
                      <AppEmptyState
                        title="No tournaments in this view"
                        description="Try another event section or return to the live tournament schedule."
                        primaryAction={
                          <Button asChild variant="outline">
                            <Link href="/tournaments" prefetch={false}>
                              Browse live tournaments
                            </Link>
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableFrame>
        </div>
      </CardContent>
    </Card>
  );
}

function TournamentHubFilterTabs({
  activeTab,
  courseId,
}: {
  activeTab: TournamentHubTab;
  courseId: string | null;
}) {
  const tabs: Array<{ key: TournamentHubTab; label: string; href: string }> = [
    { key: "live", label: "Live", href: tournamentHubHref("live", courseId) },
    { key: "mine", label: "My events", href: tournamentHubHref("mine", courseId) },
    { key: "majors", label: "Majors", href: tournamentHubHref("majors", courseId) },
    { key: "past", label: "Past", href: tournamentHubHref("past", courseId) },
  ];

  return (
    <ButtonGroup
      aria-label="Tournament board views"
      className="mt-4 max-w-full justify-start overflow-x-auto"
      data-tournament-section-tabs
    >
      {tabs.map((tab) => {
        const active = tab.key === activeTab;

        return (
          <Button
            key={tab.key}
            asChild
            size="sm"
            variant={active ? "secondary" : "outline"}
            className="whitespace-nowrap"
          >
            <Link href={tab.href} prefetch={false} aria-current={active ? "page" : undefined}>
              {tab.label}
            </Link>
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

function ScheduledTournamentCard({
  event,
  priority = false,
}: {
  event: TournamentListItem;
  priority?: boolean;
}) {
  const tone =
    event.scheduleKind === "monthly"
      ? "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)]"
      : event.scheduleKind === "weekly"
        ? "border-[var(--status-information-border)] bg-[var(--status-information-surface)]"
        : "border-[var(--status-success-border)] bg-[var(--status-success-surface)]";

  return (
    <Card className={`p-4 ${tone}`} data-tournament-event-card>
      <PageArtwork
        variant="tourCover"
        alt=""
        cropKey={event.id}
        className="-mx-1 mb-3 block h-28 min-h-0 rounded-lg"
        sizes="(min-width: 1024px) 33vw, 100vw"
        priority={priority}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="secondary">{event.scheduleEyebrow ?? "Live"}</Badge>
          <h2 className="mt-3 text-xl font-semibold tracking-normal">
            {event.scheduleKind === "monthly"
              ? "Monthly Major"
              : event.scheduleKind === "weekly"
                ? "Weekly Open"
                : "Daily Tournament"}
          </h2>
          <p className="mt-1 text-sm font-medium">{event.courseName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{event.teeSetName}</p>
        </div>
        {event.scheduleKind === "monthly" ? (
          <Trophy className="size-5 text-[var(--status-warning-foreground)]" />
        ) : (
          <Globe2 className="size-5 text-[var(--status-success-foreground)]" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded-lg bg-card/80 px-2 py-2">
          {event.roundCount} round{event.roundCount === 1 ? "" : "s"}
        </span>
        <span className="rounded-lg bg-card/80 px-2 py-2">{event.entryCount} entries</span>
        <span className="rounded-lg bg-card/80 px-2 py-2">{formatLabel(event.format)}</span>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" />
        {event.startsAt ? dateFormatter.format(event.startsAt) : "Open"} to{" "}
        {event.endsAt ? dateFormatter.format(event.endsAt) : "close"}
      </p>

      {event.leader ? (
        <div className="mt-3 rounded-lg border bg-card/80 p-3 text-sm">
          <p className="font-medium">Leader: {event.leader.displayName}</p>
          <p className="text-muted-foreground">
            {event.leader.grossTotal} through {event.leader.roundsCompleted}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild className="rounded-lg">
          <Link href={`/tournaments/${event.id}`} prefetch={false}>
            Open event
          </Link>
        </Button>
        {event.viewerEntered ? (
          <Badge variant="secondary">
            Entered{event.viewerRank ? ` · #${event.viewerRank}` : ""}
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/55 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

type TournamentChecklistStatus = "ready" | "needed" | "optional";

type TournamentChecklistItem = {
  label: string;
  detail: string;
  status: TournamentChecklistStatus;
  href?: string;
};

type TournamentReminderItem = {
  title: string;
  detail: string;
  status: TournamentChecklistStatus;
  href?: string;
};

function MobileTournamentEvidence({
  event,
  proofItems,
  reminderSteps,
}: {
  event: TournamentListItem | null;
  proofItems: TournamentChecklistItem[];
  reminderSteps: TournamentReminderItem[];
}) {
  const disclosureItems = [
    ...(event
      ? [
          {
            value: "submission-evidence",
            title: "Your submission evidence",
            summary: `${event.viewerSubmissionCount}/${event.roundCount}`,
            description: event.viewerEntered
              ? "Stored round and proof state"
              : "Requirements before you enter",
            contentClassName: "px-0 pb-0 pt-0",
            content: (
              <IOSGroupedList label={`${event.title} submission evidence`} className="border-0">
                {proofItems.map((item) => (
                  <IOSListRow
                    key={item.label}
                    label={item.label}
                    detail={item.detail}
                    href={item.href}
                    status={
                      <IOSInlineStatus
                        label={tournamentChecklistStatusLabel(item.status)}
                        tone={tournamentChecklistStatusTone(item.status)}
                      />
                    }
                  />
                ))}
              </IOSGroupedList>
            ),
          },
        ]
      : []),
    {
      value: "event-schedule",
      title: "Event schedule",
      summary: `${reminderSteps.filter((step) => step.status === "ready").length} available`,
      description: "Daily, weekly, monthly and entry state",
      contentClassName: "px-0 pb-0 pt-0",
      content: (
        <IOSGroupedList label="Tournament schedule" className="border-0">
          {reminderSteps.map((step) => (
            <IOSListRow
              key={step.title}
              label={step.title}
              detail={step.detail}
              href={step.href}
              status={
                <IOSInlineStatus
                  label={tournamentChecklistStatusLabel(step.status)}
                  tone={tournamentChecklistStatusTone(step.status)}
                />
              }
            />
          ))}
        </IOSGroupedList>
      ),
    },
  ];

  return (
    <IOSDisclosureGroup label="Tournament details" items={disclosureItems} className="self-start" />
  );
}

function buildTournamentProofItems(event: TournamentListItem | null): TournamentChecklistItem[] {
  if (!event) {
    return [];
  }

  const eventHref = `/tournaments/${event.id}?tab=submit`;
  const items: TournamentChecklistItem[] = [
    {
      label: "Round submissions",
      detail: event.viewerEntered
        ? `${event.viewerSubmissionCount}/${event.roundCount} required rounds are stored.`
        : event.viewerSubmissionCount > 0
          ? `${event.viewerSubmissionCount}/${event.roundCount} rounds remain stored for this event.`
          : "No rounds submitted by you; enter the event before a round is due.",
      status: event.viewerEntered ? (event.viewerRoundsDue === 0 ? "ready" : "needed") : "optional",
      href: eventHref,
    },
    {
      label: "Verified submissions",
      detail: `${event.viewerVerifiedSubmissionCount}/${event.viewerSubmissionCount} submitted rounds are verified.`,
      status:
        event.viewerSubmissionCount === 0
          ? "optional"
          : event.viewerVerifiedSubmissionCount === event.viewerSubmissionCount
            ? "ready"
            : "needed",
      href: eventHref,
    },
  ];

  if (event.directRapsodoRequired) {
    items.push({
      label: "Direct Rapsodo evidence",
      detail: `${event.viewerRapsodoProofCount}/${event.viewerSubmissionCount} submitted rounds include a direct sync.`,
      status: tournamentEvidenceRequirementStatus(event, event.viewerRapsodoProofCount),
      href: eventHref,
    });
  }

  if (event.screenshotRequired) {
    items.push({
      label: "Scorecard evidence",
      detail: `${event.viewerScorecardProofCount}/${event.viewerSubmissionCount} submitted rounds include a scorecard image.`,
      status: tournamentEvidenceRequirementStatus(event, event.viewerScorecardProofCount),
      href: eventHref,
    });
  }

  return items;
}

function tournamentEvidenceRequirementStatus(
  event: TournamentListItem,
  evidenceCount: number,
): TournamentChecklistStatus {
  if (!event.viewerEntered) {
    return "optional";
  }

  if (event.viewerSubmissionCount === 0) {
    return "needed";
  }

  return evidenceCount === event.viewerSubmissionCount ? "ready" : "needed";
}

function tournamentEvidenceSummary(event: TournamentListItem) {
  if (!event.viewerEntered && event.viewerSubmissionCount === 0) {
    return "No rounds submitted by you";
  }

  return `${event.viewerSubmissionCount}/${event.roundCount} submitted · ${event.viewerVerifiedSubmissionCount} verified`;
}

function tournamentActionLabel(event: TournamentListItem) {
  if (isPastTournamentEvent(event)) {
    return "Review";
  }

  if (event.viewerEntered) {
    return "Open";
  }

  return event.status === "open" ? "Enter" : "View";
}

function tournamentMobileStatus(activeTab: TournamentHubTab, events: TournamentListItem[]) {
  const featured = events[0] ?? null;
  const label =
    activeTab === "mine"
      ? "Your tournament entries"
      : activeTab === "majors"
        ? "Major tournament boards"
        : activeTab === "past"
          ? "Past tournament boards"
          : "Open tournament boards";

  return {
    label,
    value: `${events.length} ${events.length === 1 ? "event" : "events"}`,
    detail: featured
      ? `${featured.title} · ${featured.courseName} · ${tournamentEvidenceSummary(featured)}`
      : tournamentMobileEmptyDetail(activeTab),
  };
}

function tournamentMobileListTitle(activeTab: TournamentHubTab) {
  if (activeTab === "mine") {
    return "My events";
  }

  if (activeTab === "majors") {
    return "Major boards";
  }

  if (activeTab === "past") {
    return "Past events";
  }

  return "Open boards";
}

function tournamentMobileEmptyDetail(activeTab: TournamentHubTab) {
  if (activeTab === "mine") {
    return "You have not entered a visible tournament yet.";
  }

  if (activeTab === "majors") {
    return "No major tournament is visible in the current schedule.";
  }

  if (activeTab === "past") {
    return "No completed tournament is available to review.";
  }

  return "No open tournament is available right now.";
}

function tournamentChecklistStatusLabel(status: TournamentChecklistStatus) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "needed") {
    return "Needed";
  }

  return "Optional";
}

function tournamentChecklistStatusTone(status: TournamentChecklistStatus) {
  if (status === "ready") {
    return "positive" as const;
  }

  if (status === "needed") {
    return "attention" as const;
  }

  return "neutral" as const;
}

function filterTournamentHubEvents(events: TournamentListItem[], activeTab: TournamentHubTab) {
  if (activeTab === "mine") {
    return events.filter((event) => event.viewerEntered);
  }

  if (activeTab === "majors") {
    return events.filter(
      (event) => event.scheduleKind === "monthly" || event.format === "four_round_major",
    );
  }

  if (activeTab === "past") {
    return events.filter(isPastTournamentEvent);
  }

  return events.filter((event) => !isPastTournamentEvent(event));
}

function isPastTournamentEvent(event: TournamentListItem) {
  return (
    event.status === "completed" ||
    event.status === "closed" ||
    event.status === "finished" ||
    Boolean(event.endsAt && event.endsAt.getTime() < Date.now())
  );
}

function tournamentHubViewLabel(activeTab: TournamentHubTab) {
  if (activeTab === "mine") {
    return "My tournaments";
  }

  if (activeTab === "majors") {
    return "Major boards";
  }

  if (activeTab === "past") {
    return "Past events";
  }

  return "Live events";
}

function tournamentTypeLabel(event: TournamentListItem) {
  if (event.scheduleEyebrow) {
    return event.scheduleEyebrow;
  }

  if (event.scheduleKind === "daily") {
    return "Daily";
  }

  if (event.scheduleKind === "weekly") {
    return "Weekly Open";
  }

  if (event.scheduleKind === "monthly") {
    return "Monthly Major";
  }

  return event.visibility === "public" ? "Public board" : "Private board";
}

function tournamentProofLabel(event: TournamentListItem) {
  if (event.directRapsodoRequired) {
    return "Gold proof";
  }

  if (event.screenshotRequired) {
    return "Scorecard proof";
  }

  return "Silver proof";
}

function formatTournamentWindow(event: TournamentListItem) {
  const startsAt = event.startsAt ? dateFormatter.format(event.startsAt) : "Open";
  const endsAt = event.endsAt ? dateFormatter.format(event.endsAt) : "close";

  return `${startsAt} to ${endsAt}`;
}

function parseTournamentHubTab(value?: string): TournamentHubTab {
  if (value === "mine" || value === "majors" || value === "past") {
    return value;
  }

  return "live";
}

function tournamentHubHref(tab: TournamentHubTab, courseId: string | null) {
  const params = new URLSearchParams();
  if (tab !== "live") params.set("tab", tab);
  if (courseId) params.set("courseId", courseId);
  const query = params.toString();
  return query ? `/tournaments?${query}` : "/tournaments";
}
