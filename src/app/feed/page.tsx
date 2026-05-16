import Link from "next/link";
import type { ReactNode } from "react";
import { Award, BarChart3, Bell, Filter, Lock, MessageCircle, Plus, Radio, Search, Trophy, Upload, Users, Zap } from "lucide-react";

import { FeedCardList } from "@/components/social/feed-card-list";
import { SocialAvatar } from "@/components/social/social-avatar";
import {
  ActivityCard,
  EventHeroCard,
  MobileAppShell,
  MobileIconButton,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import {
  PageShell,
  StatusPill,
} from "@/components/premium";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Button } from "@/components/ui/button";
import { getFeedPageData } from "@/lib/social";

export const dynamic = "force-dynamic";

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

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const activeFilter = parseFeedFilter(params?.filter);
  const data = await getFeedPageData();
  const kudos = data.items.reduce((total, item) => total + item.reactionCount, 0);
  const comments = data.items.reduce((total, item) => total + item.commentCount, 0);
  const feedXp = data.items.reduce((total, item) => total + xpFromFeedItem(item.metricValue), 0);
  const filteredItems = filterFeedItems(data.items, activeFilter, data.viewerUserId);
  const pbCount = data.items.filter((item) => item.itemType === "new_pb" || item.itemType === "longest_drive").length;
  const challengeCount = data.items.filter((item) => item.itemType.startsWith("challenge_")).length;
  const recordCount = data.items.filter((item) => item.itemType.startsWith("course_record")).length;
  const tournamentCount = data.items.filter((item) => item.itemType.startsWith("tournament")).length;

  return (
    <PageShell size="7xl" className="bg-slate-50/20">
      <MobileAppShell>
        <MobileTopBar
          title="Social"
          actions={
            <>
              <MobileIconButton href="/feed?filter=all" label="Search feed" icon={Search} />
              <MobileIconButton href="/friends" label="Messages" icon={MessageCircle} />
              <MobileIconButton href="/achievements" label="Notifications" icon={Bell} />
            </>
          }
        />
        <MobileRouteTabs group="social" activeKey="feed" />
        <MobileTabBar
          activeKey={mobileFeedTab(activeFilter)}
          className="-mt-4"
          tabs={[
            { key: "all", label: "All", href: "/feed" },
            { key: "friends", label: "Friends", href: "/feed?filter=friends" },
            { key: "records", label: "Records", href: "/feed?filter=records" },
            { key: "events", label: "Events", href: "/feed?filter=tournaments" },
            { key: "me", label: "Me", href: "/feed?filter=me" },
          ]}
        />
        <MobileStatusAction
          label="Today’s golf goal"
          value="PW Launch Window"
          detail="12 shots · 24-34° launch window · Rapsodo proof accepted"
          action={
            <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href="/challenges" prefetch={false}>Start</Link>
            </Button>
          }
        />
        {filteredItems[0] ? (
          <NativeListSection title="Latest activity">
            {filteredItems.slice(0, 8).map((item) => (
              <ActivityCard
                key={item.id}
                avatar={
                  <SocialAvatar
                    displayName={item.profile.displayName}
                    username={item.profile.username}
                    avatarUrl={feedItemAvatarUrl(item, data)}
                    href={`/profile/${item.profile.username}`}
                    size="sm"
                  />
                }
                actor={item.profile.displayName}
                meta={`${dateFormatter.format(item.createdAt)} · ${item.verificationLabel}`}
                title={item.headline}
                description={item.context}
                metric={item.metricValue ? `${item.metricLabel ?? "Metric"} · ${item.metricValue}` : feedTypeLabel(item.itemType)}
                reactionCount={item.reactionCount}
                commentCount={item.commentCount}
                media={
                  <PageArtwork
                    variant={artworkForFeedType(item.itemType)}
                    alt=""
                    crop="random"
                    cropKey={item.id}
                    className="block h-40 min-h-0"
                    sizes="100vw"
                  />
                }
              />
            ))}
          </NativeListSection>
        ) : (
          <EventHeroCard
            eyebrow="No activity yet"
            title="Import a Rapsodo session"
            description="PBs, records, achievements and event eligibility will appear here first."
            href="/import"
            actionLabel="Import"
            media={<PageArtwork variant="fairway" alt="" className="h-full min-h-0" sizes="100vw" />}
          />
        )}
      </MobileAppShell>

      <section className="hidden gap-4 sm:grid lg:grid-cols-[260px_minmax(0,1fr)_300px] lg:items-start">
        <aside className="hidden lg:grid lg:sticky lg:top-28 lg:gap-4">
          <section className="premium-card overflow-hidden">
            <div
              className="h-20 bg-[linear-gradient(135deg,#111827,#047857_55%,#38bdf8)] bg-cover bg-center"
              style={data.profile.headerImageUrl ? { backgroundImage: profileHeaderBackground(data.profile.headerImageUrl) } : undefined}
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
                <Link href="/profile" prefetch={false}>Edit profile</Link>
              </Button>
            </div>
          </section>

          <section className="premium-card p-3">
            <p className="px-1 text-sm font-semibold">Social shortcuts</p>
            <div className="mt-2 grid gap-1">
              <SideLink href="/friends" icon={<Users className="size-4" />} label="Friends" />
              <SideLink href="/groups" icon={<Users className="size-4" />} label="Groups" />
              <SideLink href="/challenges" icon={<Trophy className="size-4" />} label="Challenges" />
              <SideLink href="/course-records" icon={<Award className="size-4" />} label="Course records" />
              <SideLink href="/tournaments" icon={<Trophy className="size-4" />} label="Tournaments" />
              <SideLink href="/leaderboard" icon={<BarChart3 className="size-4" />} label="Leaderboards" />
            </div>
          </section>
        </aside>

        <main className="grid gap-4">
          <header className="premium-hero p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <StatusPill tone="green">Social feed</StatusPill>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">Feed</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  PBs, achievements, imports, rounds, course records and tournament moments from your golf network.
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
                  {data.friendCount} friends connected · {pbCount} PBs · {recordCount} records · {tournamentCount} events · {comments} comments.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <BadgeLike icon={<Users className="size-3" />} label={`${data.friendCount} friends`} />
                <BadgeLike icon={<Award className="size-3" />} label={`${pbCount} PBs`} />
                <BadgeLike icon={<Trophy className="size-3" />} label={`${challengeCount} challenges`} />
                <BadgeLike icon={<Award className="size-3" />} label={`${recordCount} records`} />
                <BadgeLike icon={<Trophy className="size-3" />} label={`${tournamentCount} events`} />
                <BadgeLike icon={<MessageCircle className="size-3" />} label={`${comments} comments`} />
              </div>
            </div>
          </section>

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
                  Your feed is automatic right now. Import a session, complete a round, or join a challenge to post a verified update.
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
                Add a friend or join a group to unlock friend-only PBs, challenge entries and comments in this feed.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/friends" prefetch={false}>Find friends</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/groups" prefetch={false}>Browse groups</Link>
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
                <Button key={filter.key} asChild variant={filter.key === activeFilter ? "default" : "outline"} size="sm">
                  <Link href={filter.key === "all" ? "/feed" : `/feed?filter=${filter.key}`} prefetch={false}>
                    {filter.label}
                  </Link>
                </Button>
              ))}
            </div>
          </section>

          <FeedCardList items={filteredItems} />
        </main>

        <aside className="grid gap-4 lg:sticky lg:top-28">
          <section className="premium-card p-4">
            <p className="text-sm font-semibold">Network pulse</p>
            <div className="mt-3 grid gap-2">
              <PulseRow icon={<Zap className="size-4 text-emerald-600" />} label="Total XP" value={numberFormatter.format(data.totalXp)} />
              <PulseRow icon={<Award className="size-4 text-orange-500" />} label="Feed XP" value={numberFormatter.format(feedXp)} />
              <PulseRow icon={<Award className="size-4 text-emerald-600" />} label="Kudos" value={kudos} />
              <PulseRow icon={<Radio className="size-4 text-sky-600" />} label="Comments" value={comments} />
            </div>
          </section>

          <section className="premium-card p-4">
            <p className="text-sm font-semibold">Privacy state</p>
            <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
              <p>Default feed visibility is <span className="font-medium text-foreground">{data.profile.feedVisibilityDefault}</span>.</p>
              <p>{data.publicProfileCount} golfers are discoverable through public profile search.</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/profile" prefetch={false}>Change social defaults</Link>
              </Button>
            </div>
          </section>
        </aside>
      </section>
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
    <Link href={href} prefetch={false} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-[#F5F6F4]">
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

function xpFromFeedItem(metricValue: string | null) {
  const match = metricValue?.replace(/,/g, "").match(/^\+?(\d+(?:\.\d+)?)\s*XP$/i);
  return match ? Math.round(Number(match[1])) : 0;
}

function parseFeedFilter(value: string | undefined): FeedFilter {
  return feedFilters.some((filter) => filter.key === value) ? (value as FeedFilter) : "all";
}

function profileHeaderBackground(imageUrl: string) {
  return `linear-gradient(90deg, rgba(15, 23, 42, 0.56), rgba(6, 78, 59, 0.18)), url("${imageUrl.replace(/"/g, "%22")}")`;
}

function mobileFeedTab(filter: FeedFilter) {
  if (filter === "friends") return "friends";
  if (filter === "records") return "records";
  if (filter === "tournaments" || filter === "challenges") return "events";
  if (filter === "me") return "me";
  return "all";
}

function artworkForFeedType(type: string) {
  if (type.includes("tournament") || type.includes("round")) {
    return "scorecard" as const;
  }

  if (type.includes("challenge")) {
    return "range" as const;
  }

  if (type.includes("achievement")) {
    return "achievements" as const;
  }

  if (type.includes("pb") || type.includes("drive")) {
    return "stockYardages" as const;
  }

  return "fairway" as const;
}

function feedTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function filterFeedItems(items: Awaited<ReturnType<typeof getFeedPageData>>["items"], filter: FeedFilter, viewerUserId: string) {
  switch (filter) {
    case "friends":
      return items.filter((item) => item.userId !== viewerUserId);
    case "pbs":
      return items.filter((item) => item.itemType === "new_pb" || item.itemType === "longest_drive");
    case "achievements":
      return items.filter((item) => item.itemType === "achievement_unlock" || item.itemType === "level_up");
    case "challenges":
      return items.filter((item) => item.itemType.startsWith("challenge_"));
    case "records":
      return items.filter((item) => item.itemType.startsWith("course_record"));
    case "tournaments":
      return items.filter((item) => item.itemType.startsWith("tournament"));
    case "rounds":
      return items.filter((item) => item.itemType === "round_completed");
    case "me":
      return items.filter((item) => item.userId === viewerUserId);
    default:
      return items;
  }
}

function feedItemAvatarUrl(
  item: Awaited<ReturnType<typeof getFeedPageData>>["items"][number],
  data: Awaited<ReturnType<typeof getFeedPageData>>,
) {
  return item.userId === data.viewerUserId ? data.profile.avatarUrl : item.profile.avatarUrl;
}
