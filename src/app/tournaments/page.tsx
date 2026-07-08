import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Globe2, Trophy } from "lucide-react";

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
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { DataFirstFlowPanel, ProofChecklistPanel } from "@/components/product-polish";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
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
  searchParams?: Promise<{ tab?: string }>;
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
  const [data, featureData] = await Promise.all([getTournamentsPageData(), getFeatureIdeasData()]);
  const activeTab = parseTournamentHubTab(params?.tab);
  const scheduledEvents = [
    data.scheduled.daily,
    data.scheduled.weekly,
    data.scheduled.monthly,
  ].filter((event): event is TournamentListItem => Boolean(event));
  const customEvents = data.tournaments.filter((tournament) => !tournament.scheduleKind);
  const tournamentBoardEvents = filterTournamentHubEvents(data.tournaments, activeTab);
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
        ? "Four-round major status stays pinned."
        : "No monthly major scheduled.",
      href: data.scheduled.monthly ? `/tournaments/${data.scheduled.monthly.id}` : "/tournaments",
      status: data.scheduled.monthly ? ("ready" as const) : ("optional" as const),
    },
    {
      title: "Proof due",
      detail: "Attach scorecard and source before deadline.",
      href: "/rounds",
      status: "needed" as const,
    },
    {
      title: "Entry status",
      detail: `${data.myEntries.length} event${data.myEntries.length === 1 ? "" : "s"} entered.`,
      href: "/tournaments?tab=mine",
      status: data.myEntries.length > 0 ? ("ready" as const) : ("optional" as const),
    },
  ];
  const proofItems = [
    {
      label: "Rapsodo import",
      detail: "Attach the session or cloud sync behind the entered round.",
      status: "ready" as const,
      href: "/import",
    },
    {
      label: "Scorecard screenshot",
      detail: "Upload card evidence for event review and tie-break checks.",
      status: "needed" as const,
      href: "/rounds",
    },
    {
      label: "Course match",
      detail: "Tournament course, imported course and scorecard course must agree.",
      status: "ready" as const,
      href: "/courses",
    },
    {
      label: "Date match",
      detail: "Round date must sit inside the event window.",
      status: "needed" as const,
    },
    {
      label: "Tee match",
      detail: "Tee set must match the event setup before the score counts.",
      status: "needed" as const,
    },
  ];

  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar title="Tournaments" />
        <MobileRouteTabs group="play" activeKey="tournaments" />
        <MobileTabBar
          activeKey={activeTab}
          className="-mt-4"
          tabs={[
            { key: "live", label: "Live", href: "/tournaments" },
            { key: "mine", label: "My Events", href: "/tournaments?tab=mine" },
            { key: "majors", label: "Majors", href: "/tournaments?tab=majors" },
            { key: "past", label: "Past", href: "/tournaments?tab=past" },
          ]}
        />
        <MobileStatusAction
          label="Live event schedule"
          value={`${data.tournaments.length} events`}
          detail={`${data.myEntries.length} entered · Rapsodo + scorecard proof`}
          action={
            data.featured ? (
              <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                <Link href={`/tournaments/${data.featured.id}`} prefetch={false}>
                  Enter
                </Link>
              </Button>
            ) : null
          }
        />
        {data.featured ? (
          <EventHeroCard
            eyebrow={data.featured.scheduleEyebrow ?? "Live event"}
            title={
              data.featured.scheduleKind === "monthly" ? "Spring Major Week" : data.featured.title
            }
            description={`${data.featured.roundCount} rounds · ${data.featured.directRapsodoRequired ? "Gold proof required" : "Silver proof accepted"}`}
            href={`/tournaments/${data.featured.id}`}
            actionLabel={data.featured.viewerEntered ? "Open" : "Enter"}
            media={
              <PageArtwork
                variant="tourCover"
                alt=""
                cropKey={data.featured.id}
                className="block h-full min-h-0 rounded-none"
                sizes="(min-width: 640px) 640px, calc(100vw - 2rem)"
                priority
              />
            }
            meta={
              <span>
                {data.featured.leader ? `Leader: ${data.featured.leader.displayName} · ` : ""}
                {data.featured.entryCount} players
              </span>
            }
            joined={data.featured.viewerEntered ? <Badge variant="secondary">Entered</Badge> : null}
          />
        ) : null}
        <ProofChecklistPanel
          title="Tournament proof"
          description="Make the entry requirements explicit before a tester submits a tournament round."
          items={proofItems}
          actionHref={data.featured ? `/tournaments/${data.featured.id}` : "/rounds"}
          actionLabel={data.featured?.viewerEntered ? "Open entry" : "Check entry"}
        />
        <DataFirstFlowPanel
          title="Round due reminders"
          description="Show the next daily, weekly and monthly tournament obligations before the full event list."
          steps={reminderSteps}
          actionHref="/tournaments?tab=mine"
          actionLabel="My events"
        />
        <CompetitionFeaturePanel data={featureData} />
        <NativeListSection
          title={
            activeTab === "mine" ? "My events" : activeTab === "majors" ? "Majors" : "Live boards"
          }
        >
          {tournamentBoardEvents.slice(0, 10).map((event) => (
            <MobileTournamentCard
              key={event.id}
              title={event.scheduleKind === "monthly" ? "Spring Major Week" : event.title}
              description={`${event.courseName} · ${event.teeSetName}`}
              href={`/tournaments/${event.id}`}
              cta={event.viewerEntered ? "Open" : "Enter"}
              leader={
                event.leader
                  ? `Leader: ${event.leader.displayName} · ${event.leader.grossTotal}`
                  : undefined
              }
              meta={
                <>
                  <span>{event.roundCount} rounds</span>
                  <span>{event.entryCount} entries</span>
                  <span>{formatLabel(event.format)}</span>
                </>
              }
            />
          ))}
        </NativeListSection>
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="tournaments">
        <div className="hidden items-center justify-between gap-3 sm:flex">
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

        <div className="hidden sm:contents">
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
                <Badge variant="secondary">{data.tournaments.length} live events</Badge>
                <Badge variant="outline">{data.myEntries.length} entered</Badge>
                <Badge variant="outline">Rapsodo + scorecard proof</Badge>
              </div>
            </div>
          </header>

          <section className="grid gap-3 lg:grid-cols-3">
            {scheduledEvents.map((event, index) => (
              <ScheduledTournamentCard key={event.id} event={event} priority={index === 0} />
            ))}
          </section>

          <ProofChecklistPanel
            title="Tournament proof"
            description="Make the entry requirements explicit before a tester submits a tournament round."
            items={proofItems}
            actionHref={data.featured ? `/tournaments/${data.featured.id}` : "/rounds"}
            actionLabel={data.featured?.viewerEntered ? "Open entry" : "Check entry"}
          />

          <DataFirstFlowPanel
            title="Round due reminders"
            description="Show the next daily, weekly and monthly tournament obligations before the full event list."
            steps={reminderSteps}
            actionHref="/tournaments?tab=mine"
            actionLabel="My events"
          />

          <CompetitionFeaturePanel data={featureData} />

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="grid gap-4">
              <TournamentHubEventTable
                activeTab={activeTab}
                customCount={customEvents.length}
                events={tournamentBoardEvents}
                totalCount={data.tournaments.length}
              />
            </section>

            <section className="grid gap-4 xl:sticky xl:top-28">
              <section className="premium-card p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4 text-emerald-600" />
                  Rotation rules
                </p>
                <div className="mt-3 grid gap-2 text-sm">
                  <RuleRow label="Daily" value="1 round, new global course every day" />
                  <RuleRow label="Weekly Open" value="2 rounds, Monday to Sunday" />
                  <RuleRow label="Monthly Major" value="4 rounds on a famous course" />
                  <RuleRow label="Proof" value="Saved round plus scorecard evidence" />
                </div>
              </section>

              <section className="premium-card p-4">
                <p className="text-sm font-semibold">Formats</p>
                <div className="mt-3 grid gap-2">
                  {data.templates.map((template) => (
                    <div key={template.id} className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
                      <p className="font-medium">{template.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </section>
        </div>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function TournamentHubEventTable({
  activeTab,
  customCount,
  events,
  totalCount,
}: {
  activeTab: TournamentHubTab;
  customCount: number;
  events: TournamentListItem[];
  totalCount: number;
}) {
  return (
    <section
      id="tournament-event-board"
      className="premium-card scroll-mt-28 p-4"
      data-workbench-scope="tournament-events"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Tournament event board</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Scheduled events stay pinned above. Use the board for entry status, proof level, leader
            and the next event action.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{events.length} shown</Badge>
          <Badge variant="outline">{totalCount} total</Badge>
          <Badge variant="outline">{customCount} custom</Badge>
        </div>
      </div>

      <TournamentHubFilterTabs activeTab={activeTab} />

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
        <DataTableFrame mainTable mainTableLabel="Tournament event board table">
          <Table
            data-workbench-export-table="tournament-events"
            aria-describedby="tournament-events-summary"
          >
            <TableCaption id="tournament-events-summary" className="sr-only">
              Tournament event board table showing event, type, status, course, event window,
              format, entries, leader, proof level and action link.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead
                  data-column="event"
                  className="sticky left-0 z-20 min-w-64 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                      className="sticky left-0 z-10 min-w-64 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      <Link
                        href={`/tournaments/${event.id}`}
                        prefetch={false}
                        className="text-emerald-700 hover:underline"
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
                  <TableCell
                    colSpan={10}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No tournaments match this view.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </div>
    </section>
  );
}

function TournamentHubFilterTabs({ activeTab }: { activeTab: TournamentHubTab }) {
  const tabs: Array<{ key: TournamentHubTab; label: string; href: string }> = [
    { key: "live", label: "Live", href: "/tournaments" },
    { key: "mine", label: "My events", href: "/tournaments?tab=mine" },
    { key: "majors", label: "Majors", href: "/tournaments?tab=majors" },
    { key: "past", label: "Past", href: "/tournaments?tab=past" },
  ];

  return (
    <nav aria-label="Tournament board views" className="mt-4 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex min-h-10 items-center rounded-xl bg-[#0B7A3B] px-3 text-sm font-semibold text-white"
                : "inline-flex min-h-10 items-center rounded-xl border bg-white px-3 text-sm font-semibold text-foreground hover:bg-[#F5F6F4]"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
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
      ? "border-amber-200 bg-amber-50/70"
      : event.scheduleKind === "weekly"
        ? "border-sky-200 bg-sky-50/70"
        : "border-emerald-200 bg-emerald-50/70";

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${tone}`}>
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
          <Trophy className="size-5 text-amber-600" />
        ) : (
          <Globe2 className="size-5 text-emerald-700" />
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded-lg bg-white/80 px-2 py-2">
          {event.roundCount} round{event.roundCount === 1 ? "" : "s"}
        </span>
        <span className="rounded-lg bg-white/80 px-2 py-2">{event.entryCount} entries</span>
        <span className="rounded-lg bg-white/80 px-2 py-2">{formatLabel(event.format)}</span>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" />
        {event.startsAt ? dateFormatter.format(event.startsAt) : "Open"} to{" "}
        {event.endsAt ? dateFormatter.format(event.endsAt) : "close"}
      </p>

      {event.leader ? (
        <div className="mt-3 rounded-lg border bg-white/80 p-3 text-sm">
          <p className="font-medium">Leader: {event.leader.displayName}</p>
          <p className="text-muted-foreground">
            {event.leader.grossTotal} through {event.leader.roundsCompleted}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
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
    </article>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F5F6F4] px-3 py-2">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
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
