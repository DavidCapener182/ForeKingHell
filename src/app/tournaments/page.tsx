import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Globe2, ShieldCheck, Trophy } from "lucide-react";

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
import { PageShell, StatusPill } from "@/components/premium";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLabel, getTournamentsPageData } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

type TournamentListItem = Awaited<ReturnType<typeof getTournamentsPageData>>["tournaments"][number];

type TournamentsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function TournamentsPage({ searchParams }: TournamentsPageProps) {
  const params = await searchParams;
  const data = await getTournamentsPageData();
  const activeTab = parseTournamentHubTab(params?.tab);
  const scheduledEvents = [data.scheduled.daily, data.scheduled.weekly, data.scheduled.monthly].filter(
    (event): event is TournamentListItem => Boolean(event),
  );
  const customEvents = data.tournaments.filter((tournament) => !tournament.scheduleKind);

  return (
    <PageShell size="7xl">
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
          detail={`${data.myEntries.length} entered · launch monitor + scorecard proof`}
          action={
            data.featured ? (
              <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                <Link href={`/tournaments/${data.featured.id}`} prefetch={false}>Enter</Link>
              </Button>
            ) : null
          }
        />
        {data.featured ? (
          <EventHeroCard
            eyebrow={data.featured.scheduleEyebrow ?? "Live event"}
            title={scheduledEventTitle(data.featured)}
            description={`${data.featured.roundCount} rounds · ${data.featured.directRapsodoRequired ? "Gold proof required" : "Silver proof accepted"}`}
            href={`/tournaments/${data.featured.id}`}
            actionLabel={data.featured.viewerEntered ? "Open" : "Enter"}
            media={<PageArtwork variant="scorecard" alt="" className="block h-full min-h-0 rounded-none" sizes="100vw" priority />}
            meta={
              <span>
                {data.featured.leader ? `Leader: ${data.featured.leader.displayName} · ` : ""}
                {data.featured.entryCount} players
              </span>
            }
            joined={data.featured.viewerEntered ? <Badge variant="secondary">Entered</Badge> : null}
          />
        ) : null}
        <NativeListSection title={activeTab === "mine" ? "My events" : activeTab === "majors" ? "Majors" : "Live boards"}>
          {(activeTab === "mine"
            ? data.myEntries
            : activeTab === "majors"
              ? data.tournaments.filter((event) => event.scheduleKind === "monthly" || event.format === "four_round_major")
              : data.tournaments
          ).slice(0, 10).map((event) => (
            <MobileTournamentCard
              key={event.id}
              title={scheduledEventTitle(event)}
              description={`${event.courseName} · ${event.teeSetName}`}
              href={`/tournaments/${event.id}`}
              cta={event.viewerEntered ? "Open" : "Enter"}
              leader={event.leader ? `Leader: ${event.leader.displayName} · ${event.leader.grossTotal}` : undefined}
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
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-balance">Daily, weekly and monthly events</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Tour-style competition without the setup form first. Daily events rotate through {data.dailyCourseCount} launch-monitor-friendly tour venues, weekly opens run all week, and monthly majors use famous championship venues.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{data.tournaments.length} live events</Badge>
            <Badge variant="outline">{data.myEntries.length} entered</Badge>
            <Badge variant="outline">Launch monitor + scorecard proof</Badge>
          </div>
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-3">
        {scheduledEvents.map((event) => (
          <ScheduledTournamentCard key={event.id} event={event} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="grid gap-4">
          <section className="premium-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Live tournament boards</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Scheduled events stay pinned above. Friend, club and private events appear here when created.
                </p>
              </div>
              <Badge variant="secondary">{customEvents.length} custom</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {customEvents.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
              {customEvents.length === 0 ? (
                <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  No custom tournaments yet. The Daily Tournament, Weekly Open and Monthly Major are already live above.
                </p>
              ) : null}
            </div>
          </section>
        </main>

        <aside className="grid gap-4 xl:sticky xl:top-28">
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
        </aside>
      </section>
      </div>
    </PageShell>
  );
}

function scheduledEventTitle(event: TournamentListItem) {
  if (event.actualTourEvent) {
    return event.title;
  }

  if (event.scheduleKind === "monthly") {
    return "Monthly Major";
  }

  if (event.scheduleKind === "weekly") {
    return "Weekly Open";
  }

  if (event.scheduleKind === "daily") {
    return "Daily Tournament";
  }

  return event.title;
}

function ScheduledTournamentCard({ event }: { event: TournamentListItem }) {
  const tone =
    event.scheduleKind === "monthly"
      ? "border-amber-200 bg-amber-50/70"
      : event.scheduleKind === "weekly"
        ? "border-sky-200 bg-sky-50/70"
        : "border-emerald-200 bg-emerald-50/70";

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="secondary">{event.scheduleEyebrow ?? "Live"}</Badge>
          <h2 className="mt-3 text-xl font-semibold tracking-normal">{scheduledEventTitle(event)}</h2>
          <p className="mt-1 text-sm font-medium">{event.courseName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{event.teeSetName}</p>
        </div>
        {event.scheduleKind === "monthly" ? <Trophy className="size-5 text-amber-600" /> : <Globe2 className="size-5 text-emerald-700" />}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded-lg bg-white/80 px-2 py-2">{event.roundCount} round{event.roundCount === 1 ? "" : "s"}</span>
        <span className="rounded-lg bg-white/80 px-2 py-2">{event.entryCount} entries</span>
        <span className="rounded-lg bg-white/80 px-2 py-2">{formatLabel(event.format)}</span>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" />
        {event.startsAt ? dateFormatter.format(event.startsAt) : "Open"} to {event.endsAt ? dateFormatter.format(event.endsAt) : "close"}
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
          <Link href={`/tournaments/${event.id}`} prefetch={false}>Open event</Link>
        </Button>
        {event.viewerEntered ? (
          <Badge variant="secondary">Entered{event.viewerRank ? ` · #${event.viewerRank}` : ""}</Badge>
        ) : null}
      </div>
    </article>
  );
}

function TournamentCard({ tournament }: { tournament: TournamentListItem }) {
  return (
    <article className="premium-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant={tournament.directRapsodoRequired ? "secondary" : "outline"}>
            {tournament.directRapsodoRequired ? "Gold required" : "Silver accepted"}
          </Badge>
          <h2 className="mt-3 text-xl font-semibold tracking-normal">{tournament.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tournament.courseName} · {tournament.teeSetName}</p>
        </div>
        <ShieldCheck className="size-5 text-emerald-600" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded-lg bg-[#F5F6F4] px-2 py-2">{tournament.roundCount} rounds</span>
        <span className="rounded-lg bg-[#F5F6F4] px-2 py-2">{tournament.entryCount} entries</span>
        <span className="rounded-lg bg-[#F5F6F4] px-2 py-2">{formatLabel(tournament.format)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/tournaments/${tournament.id}`} prefetch={false}>Open</Link>
        </Button>
        {tournament.viewerEntered ? (
          <Badge variant="secondary">Entered{tournament.viewerRank ? ` · #${tournament.viewerRank}` : ""}</Badge>
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

function parseTournamentHubTab(value?: string) {
  if (value === "mine" || value === "majors" || value === "past") {
    return value;
  }

  return "live";
}
