import Link from "next/link";
import type { ReactNode } from "react";
import {
  Award,
  BarChart3,
  Filter,
  Lock,
  MessageCircle,
  Plus,
  Radio,
  Trophy,
  Upload,
  Users,
  Zap,
} from "lucide-react";

import { FeedCardList } from "@/components/social/feed-card-list";
import { SocialFeaturePanel } from "@/components/features/feature-panels";
import { SocialAvatar } from "@/components/social/social-avatar";
import {
  BottomSheet,
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
} from "@/components/mobile-sports";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { DataFirstFlowPanel } from "@/components/product-polish";
import { Button } from "@/components/ui/button";
import {
  DesktopWorkbenchLayout,
  DesktopTableWorkbenchControls,
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
import { getFeedPageData } from "@/lib/social";

export const dynamic = "force-dynamic";

const TOUR_COVER_COUNT = 10;
const mobileFeedPrimaryLimit = 8;

type FeedPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

type FeedFilter =
  | "all"
  | "friends"
  | "pbs"
  | "achievements"
  | "challenges"
  | "records"
  | "tournaments"
  | "rounds"
  | "me";

type FeedActivityRow = Awaited<ReturnType<typeof getFeedPageData>>["items"][number];

const feedActivityColumns: DesktopWorkbenchColumn[] = [
  { id: "activity", label: "Activity", locked: true },
  { id: "golfer", label: "Golfer" },
  { id: "type", label: "Type" },
  { id: "metric", label: "Metric" },
  { id: "proof", label: "Proof" },
  { id: "privacy", label: "Privacy" },
  { id: "engagement", label: "Engagement" },
  { id: "date", label: "Date" },
  { id: "action", label: "Action", locked: true },
];

const feedActivitySuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "All activity",
    href: "/feed",
    detail: "Latest visible PBs, rounds, records and challenge updates.",
  },
  {
    title: "Friends",
    href: "/feed?filter=friends",
    detail: "Friend activity without your own posts.",
  },
  {
    title: "PBs",
    href: "/feed?filter=pbs",
    detail: "Personal-best and longest-drive moments.",
  },
  {
    title: "Events",
    href: "/feed?filter=tournaments",
    detail: "Tournament and competition updates.",
  },
  {
    title: "Mine",
    href: "/feed?filter=me",
    detail: "Your own shareable activity and privacy state.",
  },
];

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const activeFilter = parseFeedFilter(params?.filter);
  const [data, featureData] = await Promise.all([getFeedPageData(), getFeatureIdeasData()]);
  const kudos = data.items.reduce((total, item) => total + item.reactionCount, 0);
  const comments = data.items.reduce((total, item) => total + item.commentCount, 0);
  const feedXp = data.items.reduce((total, item) => total + xpFromFeedItem(item.metricValue), 0);
  const filteredItems = filterFeedItems(data.items, activeFilter, data.viewerUserId);
  const mobilePrimaryItems = filteredItems.slice(0, mobileFeedPrimaryLimit);
  const mobileOlderItems = filteredItems.slice(mobileFeedPrimaryLimit);
  const filteredKudos = filteredItems.reduce((total, item) => total + item.reactionCount, 0);
  const filteredComments = filteredItems.reduce((total, item) => total + item.commentCount, 0);
  const pbCount = data.items.filter((item) => isPbFeedType(item.itemType)).length;
  const challengeCount = data.items.filter(
    (item) => item.itemType.startsWith("challenge_") || item.itemType === "rivalry_win",
  ).length;
  const recordCount = data.items.filter((item) => item.itemType.startsWith("course_record")).length;
  const tournamentCount = data.items.filter((item) =>
    item.itemType.startsWith("tournament"),
  ).length;
  const roundCount = data.items.filter((item) => item.itemType.includes("round")).length;
  const feedHighlights = [
    {
      title: "Personal bests",
      detail: `${pbCount} visible PB ${pbCount === 1 ? "update" : "updates"}.`,
      href: "/feed?filter=pbs",
      status: pbCount > 0 ? ("ready" as const) : ("optional" as const),
    },
    {
      title: "Rounds",
      detail: `${roundCount} visible round ${roundCount === 1 ? "update" : "updates"}.`,
      href: "/feed?filter=rounds",
      status: roundCount > 0 ? ("ready" as const) : ("optional" as const),
    },
    {
      title: "Challenges",
      detail: `${challengeCount} visible challenge ${challengeCount === 1 ? "update" : "updates"}.`,
      href: "/feed?filter=challenges",
      status: challengeCount > 0 ? ("ready" as const) : ("optional" as const),
    },
    {
      title: "Course records",
      detail: `${recordCount} visible record ${recordCount === 1 ? "update" : "updates"}.`,
      href: "/feed?filter=records",
      status: recordCount > 0 ? ("ready" as const) : ("optional" as const),
    },
    {
      title: "Tournaments",
      detail: `${tournamentCount} visible tournament ${tournamentCount === 1 ? "update" : "updates"}.`,
      href: "/feed?filter=tournaments",
      status: tournamentCount > 0 ? ("ready" as const) : ("optional" as const),
    },
  ];

  return (
    <PageShell className="bg-slate-50/20">
      <MobileAppShell>
        <MobileTopBar title="Feed" />
        <MobileRouteTabs group="social" activeKey="feed" />
        <MobileTabBar
          activeKey={mobileFeedTab(activeFilter)}
          className="-mt-4"
          tabs={[
            { key: "all", label: "All", href: "/feed" },
            { key: "friends", label: "Friends", href: "/feed?filter=friends" },
            { key: "pbs", label: "PBs", href: "/feed?filter=pbs" },
            { key: "records", label: "Records", href: "/feed?filter=records" },
            { key: "events", label: "Events", href: "/feed?filter=tournaments" },
            { key: "me", label: "Me", href: "/feed?filter=me" },
          ]}
        />
        <MobileStatusAction
          label={`${feedFilterLabel(activeFilter)} activity`}
          value={`${filteredItems.length} ${filteredItems.length === 1 ? "update" : "updates"}`}
          detail={`${filteredKudos} kudos · ${filteredComments} comments`}
          action={
            <BottomSheet
              label={
                <>
                  <Filter className="size-4" /> Filter
                </>
              }
              title="Filter feed"
            >
              <IOSGroupedList label="Feed filters">
                {feedFilters.map((filter) => (
                  <IOSListRow
                    key={filter.key}
                    label={filter.label}
                    value={filter.key === activeFilter ? "Selected" : undefined}
                    href={filter.key === "all" ? "/feed" : `/feed?filter=${filter.key}`}
                    status={
                      filter.key === activeFilter ? (
                        <IOSInlineStatus label="Current filter" tone="positive" />
                      ) : undefined
                    }
                  />
                ))}
              </IOSGroupedList>
            </BottomSheet>
          }
        />
        <section className="grid gap-2" aria-label="Latest feed activity">
          <IOSSectionHeader
            title="Latest activity"
            description={`Showing ${feedFilterLabel(activeFilter).toLowerCase()} updates`}
          />
          <MobileFeedRows
            items={mobilePrimaryItems}
            data={data}
            emptyLabel={
              data.items.length === 0
                ? "No feed activity yet"
                : `No ${feedFilterLabel(activeFilter).toLowerCase()} updates yet`
            }
            emptyDetail={
              data.items.length === 0
                ? "Import a session or complete a round to create your first verified update."
                : "Choose another feed filter to see your latest visible activity."
            }
            emptyHref={data.items.length === 0 ? "/import" : "/feed"}
          />
        </section>

        {mobileOlderItems.length > 0 ? (
          <IOSDisclosureGroup
            label="Older feed activity"
            items={[
              {
                value: "older-feed-activity",
                title: "Older activity",
                summary: `${mobileOlderItems.length} updates`,
                description: "Continue through the selected feed",
                contentClassName: "px-0 pb-0 pt-0",
                content: <MobileFeedRows items={mobileOlderItems} data={data} />,
              },
            ]}
          />
        ) : null}

        <MobileFeedHighlights highlights={feedHighlights} />
        <SocialFeaturePanel data={featureData} />
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="feed" className="hidden lg:grid">
        <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px] lg:items-start">
          <aside
            aria-label="Feed profile shortcuts"
            className="hidden lg:grid lg:sticky lg:top-28 lg:gap-4"
          >
            <section className="premium-card overflow-hidden">
              <div
                className="h-20 bg-cover bg-center"
                style={{
                  backgroundImage: profileHeaderBackground(
                    profileHeaderImageUrl(data.profile.headerImageUrl, data.profile.username),
                  ),
                }}
              />
              <div className="grid gap-3 p-4 pt-0">
                <div className="-mt-8">
                  <SocialAvatar
                    displayName={data.profile.displayName}
                    username={data.profile.username}
                    avatarUrl={data.profile.avatarUrl}
                    href="/profile"
                    size="lg"
                  />
                </div>
                <div>
                  <Link href="/profile" prefetch={false} className="font-semibold hover:underline">
                    {data.profile.displayName}
                  </Link>
                  <p className="text-sm text-muted-foreground">@{data.profile.username}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <MiniStat label="Friends" value={data.friendCount} />
                  <MiniStat label="XP" value={numberFormatter.format(data.totalXp)} />
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/profile" prefetch={false}>
                    Edit profile
                  </Link>
                </Button>
              </div>
            </section>

            <section className="premium-card p-3">
              <p className="px-1 text-sm font-semibold">Social shortcuts</p>
              <div className="mt-2 grid gap-1">
                <SideLink href="/friends" icon={<Users className="size-4" />} label="Friends" />
                <SideLink href="/groups" icon={<Users className="size-4" />} label="Groups" />
                <SideLink
                  href="/challenges"
                  icon={<Trophy className="size-4" />}
                  label="Challenges"
                />
                <SideLink
                  href="/course-records"
                  icon={<Award className="size-4" />}
                  label="Course records"
                />
                <SideLink
                  href="/tournaments"
                  icon={<Trophy className="size-4" />}
                  label="Tournaments"
                />
                <SideLink
                  href="/leaderboard"
                  icon={<BarChart3 className="size-4" />}
                  label="Leaderboards"
                />
              </div>
            </section>
          </aside>

          <section className="grid gap-4">
            <header className="premium-hero p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <StatusPill tone="green">Social feed</StatusPill>
                  <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">Feed</h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    PBs, achievements, imports, rounds, course records and tournament moments from
                    your golf network.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href="/friends" prefetch={false}>
                      <Users className="size-4" />
                      Find friends
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/challenges" prefetch={false}>
                      <Plus className="size-4" />
                      Join challenge
                    </Link>
                  </Button>
                </div>
              </div>
            </header>

            <section className="premium-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Zap className="size-4 text-emerald-600" />
                    Social pulse
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.friendCount} friends connected · {pbCount} PBs · {recordCount} records ·{" "}
                    {tournamentCount} events · {comments} comments.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BadgeLike
                    icon={<Users className="size-3" />}
                    label={`${data.friendCount} friends`}
                  />
                  <BadgeLike icon={<Award className="size-3" />} label={`${pbCount} PBs`} />
                  <BadgeLike
                    icon={<Trophy className="size-3" />}
                    label={`${challengeCount} challenges`}
                  />
                  <BadgeLike icon={<Award className="size-3" />} label={`${recordCount} records`} />
                  <BadgeLike
                    icon={<Trophy className="size-3" />}
                    label={`${tournamentCount} events`}
                  />
                  <BadgeLike
                    icon={<MessageCircle className="size-3" />}
                    label={`${comments} comments`}
                  />
                </div>
              </div>
            </section>

            <DataFirstFlowPanel
              title="Activity highlights"
              description="Counts from the visible feed before filters and the full stream."
              steps={feedHighlights}
              actionHref="/profile"
              actionLabel="Preview sharing"
            />

            <section className="premium-card p-4">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <SocialAvatar
                  displayName={data.profile.displayName}
                  username={data.profile.username}
                  avatarUrl={data.profile.avatarUrl}
                  href="/profile"
                />
                <div className="grid gap-3">
                  <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                    Your feed is automatic right now. Import a session, complete a round, or join a
                    challenge to post a verified update.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/import" prefetch={false}>
                        <Upload className="size-4" />
                        Import
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/rounds/new" prefetch={false}>
                        <Radio className="size-4" />
                        Log round
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/course-records" prefetch={false}>
                        <Award className="size-4" />
                        Submit record
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/profile" prefetch={false}>
                        <Lock className="size-4" />
                        Privacy
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {data.friendCount === 0 ? (
              <section className="rounded-xl border border-dashed bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold">Build your golf network</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Add a friend or join a group to unlock friend-only PBs, challenge entries and
                  comments in this feed.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/friends" prefetch={false}>
                      Find friends
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/groups" prefetch={false}>
                      Browse groups
                    </Link>
                  </Button>
                </div>
              </section>
            ) : null}

            <section className="premium-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 px-1 text-sm font-semibold">
                  <Filter className="size-4 text-slate-600" />
                  Filter
                </span>
                {feedFilters.map((filter) => (
                  <Button
                    key={filter.key}
                    asChild
                    variant={filter.key === activeFilter ? "default" : "outline"}
                    size="sm"
                  >
                    <Link
                      href={filter.key === "all" ? "/feed" : `/feed?filter=${filter.key}`}
                      prefetch={false}
                    >
                      {filter.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </section>

            <FeedActivityLedger activeFilter={activeFilter} items={filteredItems} />

            <FeedCardList items={filteredItems} />

            <SocialFeaturePanel data={featureData} />
          </section>

          <aside aria-label="Feed social insight rail" className="grid gap-4 lg:sticky lg:top-28">
            <section className="premium-card p-4">
              <p className="text-sm font-semibold">Network pulse</p>
              <div className="mt-3 grid gap-2">
                <PulseRow
                  icon={<Zap className="size-4 text-emerald-600" />}
                  label="Total XP"
                  value={numberFormatter.format(data.totalXp)}
                />
                <PulseRow
                  icon={<Award className="size-4 text-orange-500" />}
                  label="Feed XP"
                  value={numberFormatter.format(feedXp)}
                />
                <PulseRow
                  icon={<Award className="size-4 text-emerald-600" />}
                  label="Kudos"
                  value={kudos}
                />
                <PulseRow
                  icon={<Radio className="size-4 text-sky-600" />}
                  label="Comments"
                  value={comments}
                />
              </div>
            </section>

            <section className="premium-card p-4">
              <p className="text-sm font-semibold">Privacy state</p>
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
                <p>
                  Default feed visibility is{" "}
                  <span className="font-medium text-foreground">
                    {data.profile.feedVisibilityDefault}
                  </span>
                  .
                </p>
                <p>
                  {data.publicProfileCount} golfers are discoverable through public profile search.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/profile" prefetch={false}>
                    Change social defaults
                  </Link>
                </Button>
              </div>
            </section>
          </aside>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

const numberFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const feedFilters: Array<{ key: FeedFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "friends", label: "Friends" },
  { key: "pbs", label: "PBs" },
  { key: "achievements", label: "Achievements" },
  { key: "challenges", label: "Challenges" },
  { key: "records", label: "Records" },
  { key: "tournaments", label: "Tournaments" },
  { key: "rounds", label: "Rounds" },
  { key: "me", label: "Me" },
];

type FeedPageData = Awaited<ReturnType<typeof getFeedPageData>>;

type FeedHighlight = {
  title: string;
  detail: string;
  href: string;
  status: "ready" | "needed" | "optional";
};

function MobileFeedRows({
  items,
  data,
  emptyLabel,
  emptyDetail,
  emptyHref,
}: {
  items: FeedActivityRow[];
  data: FeedPageData;
  emptyLabel?: string;
  emptyDetail?: string;
  emptyHref?: string;
}) {
  return (
    <IOSGroupedList label="Feed activity">
      {items.length > 0 ? (
        items.map((item) => {
          const engagementCount = item.reactionCount + item.commentCount;

          return (
            <IOSListRow
              key={item.id}
              label={item.headline}
              value={item.metricValue ?? undefined}
              detail={
                <>
                  <span>
                    {item.profile.displayName} · {dateFormatter.format(item.createdAt)} ·{" "}
                    {item.verificationLabel}
                  </span>
                  {item.context ? (
                    <span className="mt-0.5 line-clamp-2 block">{item.context}</span>
                  ) : null}
                </>
              }
              href={item.proofUrl ?? `/profile/${item.profile.username}`}
              leading={
                <SocialAvatar
                  displayName={item.profile.displayName}
                  username={item.profile.username}
                  avatarUrl={feedItemAvatarUrl(item, data)}
                  size="sm"
                />
              }
              status={
                <IOSInlineStatus
                  label={
                    engagementCount > 0
                      ? `${item.reactionCount} kudos · ${item.commentCount} comments`
                      : "No reactions yet"
                  }
                  tone={engagementCount > 0 ? "positive" : "neutral"}
                />
              }
            />
          );
        })
      ) : (
        <IOSListRow
          label={emptyLabel ?? "No activity in this section"}
          detail={emptyDetail ?? "New visible updates will appear here."}
          href={emptyHref}
        />
      )}
    </IOSGroupedList>
  );
}

function MobileFeedHighlights({ highlights }: { highlights: FeedHighlight[] }) {
  const activeCount = highlights.filter((highlight) => highlight.status === "ready").length;

  return (
    <IOSDisclosureGroup
      label="Feed activity highlights"
      items={[
        {
          value: "feed-highlights",
          title: "Activity highlights",
          summary: `${activeCount} active`,
          description: "PB, round, challenge, record and tournament counts",
          contentClassName: "px-0 pb-0 pt-0",
          content: (
            <IOSGroupedList label="Feed highlight counts" className="border-0">
              {highlights.map((highlight) => (
                <IOSListRow
                  key={highlight.title}
                  label={highlight.title}
                  detail={highlight.detail}
                  href={highlight.href}
                  status={
                    <IOSInlineStatus
                      label={
                        highlight.status === "ready" ? "Activity available" : "No activity yet"
                      }
                      tone={highlight.status === "ready" ? "positive" : "neutral"}
                    />
                  }
                />
              ))}
            </IOSGroupedList>
          ),
        },
      ]}
    />
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-[#F5F6F4] px-3 py-2">
      <p className="text-lg font-semibold tracking-normal">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SideLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-[#F5F6F4]"
    >
      {icon}
      {label}
    </Link>
  );
}

function PulseRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-semibold tracking-normal">{value}</span>
    </div>
  );
}

function BadgeLike({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-[#F5F6F4] px-2.5 text-xs font-medium">
      {icon}
      {label}
    </span>
  );
}

function FeedActivityLedger({
  activeFilter,
  items,
}: {
  activeFilter: FeedFilter;
  items: FeedActivityRow[];
}) {
  return (
    <section id="feed-activity-ledger" className="grid gap-3" data-workbench-scope="feed-activity">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Activity ledger</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Desktop review of visible feed activity, proof, privacy and engagement before opening
            detailed cards.
          </p>
        </div>
        <StatusPill tone={items.length > 0 ? "green" : "slate"}>
          {items.length} activities
        </StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`feed-activity-${activeFilter}`}
        scope="feed-activity"
        currentViewLabel={feedActivityViewLabel(activeFilter)}
        resultLabel={`${items.length} activities`}
        columns={feedActivityColumns}
        suggestedViews={feedActivitySuggestedViews}
        exportTableId="feed-activity-ledger"
        exportFileName={`forekinghell-feed-activity-${activeFilter}.csv`}
      />
      <DataTableFrame mainTable mainTableLabel="Feed activity ledger table" stickyFirstColumn>
        <Table
          data-workbench-export-table="feed-activity-ledger"
          aria-describedby="feed-activity-ledger-summary"
        >
          <TableCaption id="feed-activity-ledger-summary" className="sr-only">
            Feed activity ledger table showing activity headline, golfer, activity type, metric,
            proof state, privacy, engagement counts, date and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="activity"
                className="sticky left-0 z-20 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Activity
              </TableHead>
              <TableHead data-column="golfer">Golfer</TableHead>
              <TableHead data-column="type">Type</TableHead>
              <TableHead data-column="metric">Metric</TableHead>
              <TableHead data-column="proof">Proof</TableHead>
              <TableHead data-column="privacy">Privacy</TableHead>
              <TableHead data-column="engagement">Engagement</TableHead>
              <TableHead data-column="date">Date</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="activity"
                    className="sticky left-0 z-10 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <p className="font-semibold">{item.headline}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {item.context ?? feedTypeLabel(item.itemType)}
                    </p>
                  </TableCell>
                  <TableCell data-column="golfer">
                    <Link
                      href={`/profile/${item.profile.username}`}
                      prefetch={false}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {item.profile.displayName}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">@{item.profile.username}</p>
                  </TableCell>
                  <TableCell data-column="type">{feedTypeLabel(item.itemType)}</TableCell>
                  <TableCell data-column="metric">
                    {item.metricValue
                      ? `${item.metricLabel ?? "Metric"} · ${item.metricValue}`
                      : "--"}
                  </TableCell>
                  <TableCell data-column="proof">{item.verificationLabel}</TableCell>
                  <TableCell data-column="privacy">{titleCase(item.visibility)}</TableCell>
                  <TableCell data-column="engagement">
                    {item.reactionCount} kudos · {item.commentCount} comments
                  </TableCell>
                  <TableCell data-column="date">{dateFormatter.format(item.createdAt)}</TableCell>
                  <TableCell data-column="action" className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={item.proofUrl ?? `/profile/${item.profile.username}`}
                        prefetch={false}
                      >
                        {item.proofUrl ? "Open proof" : "Open profile"}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No feed activity matches this filter yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function xpFromFeedItem(metricValue: string | null) {
  const match = metricValue?.replace(/,/g, "").match(/^\+?(\d+(?:\.\d+)?)\s*XP$/i);
  return match ? Math.round(Number(match[1])) : 0;
}

function parseFeedFilter(value: string | undefined): FeedFilter {
  return feedFilters.some((filter) => filter.key === value) ? (value as FeedFilter) : "all";
}

function feedActivityViewLabel(filter: FeedFilter) {
  const label = feedFilters.find((item) => item.key === filter)?.label ?? "All";
  return `${label} feed activity`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function profileHeaderBackground(imageUrl: string) {
  return `linear-gradient(90deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0)), url("${imageUrl.replace(/"/g, "%22")}")`;
}

function profileHeaderImageUrl(headerImageUrl: string | null | undefined, username: string) {
  return headerImageUrl ?? tourCoverForKey(username);
}

function tourCoverForKey(key: string) {
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % TOUR_COVER_COUNT;
  }

  return `/assets/tour-covers/tour-cover-${String(hash + 1).padStart(2, "0")}.webp`;
}

function mobileFeedTab(filter: FeedFilter) {
  if (filter === "friends") return "friends";
  if (filter === "pbs") return "pbs";
  if (filter === "records") return "records";
  if (filter === "tournaments" || filter === "challenges") return "events";
  if (filter === "me") return "me";
  return "all";
}

function feedFilterLabel(filter: FeedFilter) {
  return feedFilters.find((item) => item.key === filter)?.label ?? "All";
}

function feedTypeLabel(value: string) {
  const labels: Record<string, string> = {
    rivalry_win: "Rivalry Win",
    squad_streak: "Squad Streak",
    weekly_pb: "Weekly PB",
  };

  if (labels[value]) {
    return labels[value];
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function filterFeedItems(
  items: Awaited<ReturnType<typeof getFeedPageData>>["items"],
  filter: FeedFilter,
  viewerUserId: string,
) {
  switch (filter) {
    case "friends":
      return items.filter((item) => item.userId !== viewerUserId);
    case "pbs":
      return items.filter((item) => isPbFeedType(item.itemType));
    case "achievements":
      return items.filter(
        (item) => item.itemType === "achievement_unlock" || item.itemType === "level_up",
      );
    case "challenges":
      return items.filter(
        (item) => item.itemType.startsWith("challenge_") || item.itemType === "rivalry_win",
      );
    case "records":
      return items.filter((item) => item.itemType.startsWith("course_record"));
    case "tournaments":
      return items.filter((item) => item.itemType.startsWith("tournament"));
    case "rounds":
      return items.filter((item) => item.itemType.includes("round"));
    case "me":
      return items.filter((item) => item.userId === viewerUserId);
    default:
      return items;
  }
}

function isPbFeedType(type: string) {
  return type === "new_pb" || type === "longest_drive" || type === "weekly_pb";
}

function feedItemAvatarUrl(
  item: Awaited<ReturnType<typeof getFeedPageData>>["items"][number],
  data: Awaited<ReturnType<typeof getFeedPageData>>,
) {
  return item.userId === data.viewerUserId ? data.profile.avatarUrl : item.profile.avatarUrl;
}
