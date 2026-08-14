import Link from "next/link";
import type { ReactNode } from "react";
import { Award, Flag, Target, Trophy, UserPlus, Users } from "lucide-react";

import { FeedFilterControls } from "@/app/feed/feed-filter-controls";
import { buildFeedActivityCsvHref, feedActivityExportFileName } from "@/app/feed/feed-csv-export";
import { StatusUpdateComposerSheet } from "@/app/feed/status-update-composer";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { FeedCardList } from "@/components/social/feed-card-list";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { PageHeader, PageShell } from "@/components/premium";
import { getFeedPageData } from "@/lib/social";

export const dynamic = "force-dynamic";

type FeedPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

type FeedFilter = "following" | "friends" | "groups" | "achievements" | "me" | "all";

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const activeFilter = parseFeedFilter(params?.filter);
  const data = await getFeedPageData();
  const filteredItems = filterFeedItems(data.items, activeFilter, {
    viewerUserId: data.viewerUserId,
    friendIds: data.friendIds,
    followingIds: data.followingIds,
  });
  const exportHref = buildFeedActivityCsvHref(filteredItems);

  return (
    <PageShell className="bg-muted/20">
      <DesktopWorkbenchLayout scope="feed">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_264px] lg:items-start">
          <main className="grid min-w-0 gap-3" data-feed-timeline-first>
            <PageHeader
              eyebrow={<Badge variant="secondary">Golf activity network</Badge>}
              title="Clubhouse"
              description="Rounds, practice, personal bests and milestones from your golf circle — strictly in time order."
            />

            <Card id="create-feed-post" className="scroll-mt-28 py-0 shadow-sm">
              <CardContent className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:p-4">
                <SocialAvatar
                  displayName={data.profile.displayName}
                  username={data.profile.username}
                  avatarUrl={data.profile.avatarUrl}
                  href="/profile"
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Add to the clubhouse</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Share a result, golf thought or quick update.
                  </p>
                </div>
                <StatusUpdateComposerSheet
                  displayName={data.profile.displayName}
                  username={data.profile.username}
                  avatarUrl={data.profile.avatarUrl}
                  defaultVisibility={data.profile.feedVisibilityDefault}
                />
              </CardContent>
            </Card>

            {data.friendCount === 0 ? (
              <AppEmptyState
                icon={<Users />}
                title="Build your golf circle"
                description="Add a friend or join a group to bring more real golf activity into this chronological feed."
                primaryAction={
                  <Button asChild size="sm">
                    <Link href="/friends" prefetch={false}>
                      Find friends
                    </Link>
                  </Button>
                }
                secondaryAction={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/groups" prefetch={false}>
                      Browse groups
                    </Link>
                  </Button>
                }
              />
            ) : null}

            <section className="grid min-w-0 gap-3" aria-labelledby="clubhouse-stream-title">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="clubhouse-stream-title" className="text-lg font-semibold">
                    Latest activity
                  </h2>
                  <p className="text-xs text-muted-foreground">Newest first · no suggested posts</p>
                </div>
                <Badge variant="outline">
                  {filteredItems.length} {filteredItems.length === 1 ? "activity" : "activities"}
                </Badge>
              </div>

              <FeedFilterControls
                activeFilter={
                  activeFilter === "all" || activeFilter === "me" ? "following" : activeFilter
                }
                filters={feedFilters}
                exportHref={exportHref}
                exportFileName={feedActivityExportFileName(activeFilter)}
                exportItemCount={filteredItems.length}
              />
              <FeedCardList items={filteredItems} />
            </section>
          </main>

          <aside aria-label="Clubhouse network shortcuts" className="lg:sticky lg:top-28">
            <Card className="gap-0 py-0 shadow-sm" data-feed-utility-rail>
              <CardContent className="grid gap-4 p-4">
                <div className="flex items-center gap-3">
                  <SocialAvatar
                    displayName={data.profile.displayName}
                    username={data.profile.username}
                    avatarUrl={data.profile.avatarUrl}
                    href="/profile"
                    size="md"
                  />
                  <div className="min-w-0">
                    <Link
                      href="/profile"
                      prefetch={false}
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {data.profile.displayName}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      @{data.profile.username}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x rounded-lg border bg-muted/25 py-2 text-center">
                  <NetworkStat value={data.followingIds.length} label="Following" />
                  <NetworkStat value={data.friendCount} label="Friends" />
                  <NetworkStat value={data.totalXp} label="XP" />
                </div>

                <Separator />

                <nav className="grid gap-1" aria-label="Clubhouse shortcuts">
                  <SideLink
                    href="/friends"
                    icon={<UserPlus className="size-4" />}
                    label="Find golfers"
                  />
                  <SideLink href="/groups" icon={<Users className="size-4" />} label="Groups" />
                  <SideLink
                    href="/challenges"
                    icon={<Trophy className="size-4" />}
                    label="Challenges"
                  />
                  <SideLink
                    href="/achievements"
                    icon={<Award className="size-4" />}
                    label="Achievements"
                  />
                  <SideLink
                    href="/course-records"
                    icon={<Flag className="size-4" />}
                    label="Course records"
                  />
                  <SideLink
                    href="/practice"
                    icon={<Target className="size-4" />}
                    label="Start practice"
                  />
                </nav>

                <Separator />

                <div>
                  <p className="text-xs font-semibold">Posting default</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    New updates are shared with{" "}
                    <span className="font-medium text-foreground">
                      {data.profile.feedVisibilityDefault}
                    </span>{" "}
                    unless you change it in the composer.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

const feedFilters: Array<{ key: Exclude<FeedFilter, "me" | "all">; label: string }> = [
  { key: "following", label: "Following" },
  { key: "friends", label: "Friends" },
  { key: "groups", label: "Groups" },
  { key: "achievements", label: "Achievements" },
];

function NetworkStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 px-1">
      <p className="truncate text-sm font-semibold tabular-nums">{numberFormatter.format(value)}</p>
      <p className="truncate text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}

function SideLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link href={href} prefetch={false} className="focus-aaa block rounded-xl outline-none">
      <Item variant="muted" size="sm">
        <ItemMedia className="text-primary">{icon}</ItemMedia>
        <ItemContent>
          <ItemTitle>{label}</ItemTitle>
        </ItemContent>
      </Item>
    </Link>
  );
}

function parseFeedFilter(value: string | undefined): FeedFilter {
  if (value === "me" || value === "all") return value;
  return feedFilters.some((filter) => filter.key === value) ? (value as FeedFilter) : "following";
}

function filterFeedItems(
  items: Awaited<ReturnType<typeof getFeedPageData>>["items"],
  filter: FeedFilter,
  network: { viewerUserId: string; friendIds: string[]; followingIds: string[] },
) {
  const friendIds = new Set(network.friendIds);
  const followingIds = new Set(network.followingIds);

  switch (filter) {
    case "following":
      return items.filter(
        (item) => item.userId === network.viewerUserId || followingIds.has(item.userId),
      );
    case "friends":
      return items.filter((item) => friendIds.has(item.userId));
    case "groups":
      return items.filter((item) => item.itemType.startsWith("group_"));
    case "achievements":
      return items.filter(
        (item) => item.itemType === "achievement_unlock" || item.itemType === "level_up",
      );
    case "me":
      return items.filter((item) => item.userId === network.viewerUserId);
    default:
      return items;
  }
}

const numberFormatter = new Intl.NumberFormat("en-GB");
