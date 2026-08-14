import Link from "next/link";
import type { ReactNode } from "react";
import { Award, BarChart3, Trophy, Users } from "lucide-react";

import { FeedCardList } from "@/components/social/feed-card-list";
import { StatusUpdateComposerSheet } from "@/app/feed/status-update-composer";
import { FeedFilterControls } from "@/app/feed/feed-filter-controls";
import { buildFeedActivityCsvHref, feedActivityExportFileName } from "@/app/feed/feed-csv-export";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { SocialAvatar } from "@/components/social/social-avatar";
import { PageHeader, PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { getFeedPageData } from "@/lib/social";

export const dynamic = "force-dynamic";

const TOUR_COVER_COUNT = 10;

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
  const filteredItems = filterFeedItems(data.items, activeFilter, data.viewerUserId);
  const exportHref = buildFeedActivityCsvHref(filteredItems);

  return (
    <PageShell className="bg-muted/20">
      <DesktopWorkbenchLayout scope="feed">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <main className="grid min-w-0 gap-4" data-feed-timeline-first>
            <PageHeader
              eyebrow={<Badge variant="secondary">Social feed</Badge>}
              title="Feed"
              description="PBs, achievements, imports, rounds, course records and tournament moments from your golf network."
            />

            <Card id="create-feed-post" className="scroll-mt-28">
              <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
                <SocialAvatar
                  displayName={data.profile.displayName}
                  username={data.profile.username}
                  avatarUrl={data.profile.avatarUrl}
                  href="/profile"
                />
                <div>
                  <p className="font-semibold">Share a golf update</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Post a range note, round recap, swing feel or golf photo.
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
                title="Build your golf network"
                description="Add a friend or join a group to unlock friend-only PBs, challenge entries and comments in this feed."
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

            <section className="grid min-w-0 gap-3" aria-labelledby="feed-stream-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="feed-stream-title" className="text-xl font-semibold tracking-normal">
                    Latest activity
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    One chronological stream from the current visibility and feed filter.
                  </p>
                </div>
                <Badge variant="outline">
                  {filteredItems.length} {filteredItems.length === 1 ? "update" : "updates"}
                </Badge>
              </div>

              <FeedFilterControls
                activeFilter={activeFilter}
                filters={feedFilters}
                exportHref={exportHref}
                exportFileName={feedActivityExportFileName(activeFilter)}
                exportItemCount={filteredItems.length}
              />
              <FeedCardList items={filteredItems} />
            </section>
          </main>

          <aside aria-label="Feed shortcuts and privacy" className="lg:sticky lg:top-28">
            <Card className="gap-0 py-0 shadow-sm" data-feed-utility-rail>
              <div
                className="h-20 bg-cover bg-center"
                style={{
                  backgroundImage: profileHeaderBackground(
                    profileHeaderImageUrl(data.profile.headerImageUrl, data.profile.username),
                  ),
                }}
              />
              <CardContent className="grid gap-4 p-4 pt-0">
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
                  <p className="mt-2 text-xs text-muted-foreground">
                    {data.friendCount} friends · {numberFormatter.format(data.totalXp)} XP
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/profile" prefetch={false}>
                    Edit profile
                  </Link>
                </Button>

                <Separator />

                <nav className="grid gap-1" aria-label="Social shortcuts">
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
                </nav>

                <Separator />

                <section aria-labelledby="feed-privacy-title" className="grid gap-3">
                  <div>
                    <h2 id="feed-privacy-title" className="text-sm font-semibold">
                      Privacy state
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Default visibility is{" "}
                      <span className="font-medium text-foreground">
                        {data.profile.feedVisibilityDefault}
                      </span>
                      . {data.publicProfileCount} golfers are discoverable through public search.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/profile" prefetch={false}>
                      Change social defaults
                    </Link>
                  </Button>
                </section>
              </CardContent>
            </Card>
          </aside>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

const numberFormatter = new Intl.NumberFormat("en-GB");

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
  return feedFilters.some((filter) => filter.key === value) ? (value as FeedFilter) : "all";
}

function profileHeaderBackground(imageUrl: string) {
  return `linear-gradient(90deg, color-mix(in srgb, var(--foreground) 8%, transparent), transparent), url("${imageUrl.replace(/"/g, "%22")}")`;
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
