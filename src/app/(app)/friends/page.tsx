import Link from "next/link";
import {
  ArrowLeft,
  Award,
  Ban,
  Check,
  Copy,
  Search,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  acceptFriendRequestAction,
  blockUserAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  removeFriendAction,
  sendFriendRequestAction,
  unblockUserAction,
} from "@/app/friends/actions";
import { FriendActionMenu } from "@/app/friends/friend-action-menu";
import { FriendInviteDialog } from "@/app/friends/friend-invite-dialog";
import { FriendsTabs, type FriendsTab } from "@/app/friends/friends-tabs";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import {
  DataPair,
  DataPanel,
  DataTableFrame,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import {
  BottomSheet,
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
  type IOSDisclosureItem,
} from "@/components/app/ios-mobile";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFriendsPageData, type SocialProfileSummary } from "@/lib/social";
import { getSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

type FriendGraphStatus = "friend" | "incoming" | "outgoing" | "suggested" | "search" | "blocked";

type FriendGraphRow = {
  id: string;
  profile: SocialProfileSummary;
  status: FriendGraphStatus;
  requestId?: string;
};

type FriendsPageData = Awaited<ReturnType<typeof getFriendsPageData>>;

const friendGraphColumns: DesktopWorkbenchColumn[] = [
  { id: "golfer", label: "Golfer", locked: true },
  { id: "status", label: "Status" },
  { id: "visibility", label: "Visibility" },
  { id: "home-course", label: "Home course" },
  { id: "monitor", label: "Monitor" },
  { id: "handicap", label: "Handicap" },
  { id: "action", label: "Action", locked: true },
];

const friendGraphSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Friends",
    href: "/friends",
    detail: "Connected golfers who power friend-scoped boards.",
  },
  {
    title: "Incoming requests",
    href: "#friend-graph-table",
    detail: "Approve or decline pending requests from one table.",
  },
  {
    title: "Find friends",
    href: "#find-friends",
    detail: "Search public profiles and send a request.",
  },
  {
    title: "Blocked users",
    href: "#blocked-users",
    detail: "Review users hidden from friend-scoped activity.",
  },
];

type FriendsPageProps = {
  searchParams?: Promise<{
    q?: string;
    request?: string;
    friend?: string;
    user?: string;
    tab?: string;
  }>;
};

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const data = await getFriendsPageData(query);
  const profileUrl = `${getSiteOrigin()}/profile/${data.profile.username}`;
  const activeTab = parseFriendsTab(params?.tab, query);
  const friendGraphRows = filterFriendGraphRows(
    buildFriendGraphRows({
      friends: data.friends,
      incomingRequests: data.incomingRequests,
      outgoingRequests: data.outgoingRequests,
      suggestedProfiles: data.suggestedProfiles,
      searchResults: query ? data.searchResults : [],
      blockedUsers: data.blockedUsers,
    }),
    activeTab,
  );

  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar title="Friends" />
        <MobileRouteTabs group="social" activeKey="friends" />
        <MobileStatusAction
          label="Connections"
          value={`${data.friends.length} ${data.friends.length === 1 ? "friend" : "friends"}`}
          detail={`${data.incomingRequests.length} incoming · ${data.outgoingRequests.length} sent`}
          action={
            <BottomSheet label="Find" title="Find friends">
              <MobileFriendSearch data={data} query={query} />
            </BottomSheet>
          }
        />

        {params?.request || params?.friend || params?.user ? (
          <IOSGroupedList label="Friend update status">
            <IOSListRow
              label="Friends updated"
              detail="Your relationship and visibility state has been refreshed."
              status={<IOSInlineStatus label="Saved" tone="positive" />}
            />
          </IOSGroupedList>
        ) : null}

        <MobileFriendRequests rows={data.incomingRequests} />
        <MobileFriendList profiles={data.friends} />
        <MobileFriendDetails data={data} profileUrl={profileUrl} />
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="friends" className="hidden lg:grid">
        <div className="hidden items-center justify-between gap-3 sm:flex">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard" prefetch={false}>
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile" prefetch={false}>
              @{data.profile.username}
            </Link>
          </Button>
        </div>

        <header className="premium-hero overflow-hidden p-3 sm:p-0">
          <div
            className="hidden h-24 bg-[linear-gradient(135deg,#111827,#047857_52%,#38bdf8)] bg-cover bg-center sm:block"
            style={
              data.profile.headerImageUrl
                ? { backgroundImage: profileHeaderBackground(data.profile.headerImageUrl) }
                : undefined
            }
          />
          <div className="grid gap-3 sm:gap-4 sm:p-5 sm:pt-0">
            <div className="flex items-start justify-between gap-3 sm:-mt-9 sm:items-end">
              <div className="flex min-w-0 items-start gap-3 sm:items-end sm:gap-4">
                <SocialAvatar
                  displayName={data.profile.displayName}
                  username={data.profile.username}
                  avatarUrl={data.profile.avatarUrl}
                  href="/profile"
                  size="lg"
                />
                <div className="min-w-0 pb-0 sm:pb-1">
                  <StatusPill tone="green">Social graph</StatusPill>
                  <h1 className="mt-2 text-xl font-semibold tracking-normal sm:text-3xl">
                    Friends
                  </h1>
                  <p className="line-clamp-1 max-w-2xl text-sm leading-5 text-muted-foreground sm:line-clamp-none sm:leading-6">
                    Find golfers by username, approve requests, and keep friendships separate from
                    coach/viewer/editor access. Friend scopes now power records, boards and private
                    events.
                  </p>
                </div>
              </div>
              <div data-primary-action className="shrink-0">
                <div className="flex flex-wrap justify-end gap-2">
                  <FriendInviteDialog username={data.profile.username} profileUrl={profileUrl} />
                  <Button asChild size="sm" variant="outline" className="rounded-lg bg-white">
                    <Link href="/feed" prefetch={false}>
                      Open feed
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
            <div className="hidden gap-2 sm:grid sm:grid-cols-4">
              <SocialStat label="Friends" value={data.friends.length} detail="Connected golfers" />
              <SocialStat
                label="Incoming"
                value={data.incomingRequests.length}
                detail="Pending approvals"
              />
              <SocialStat
                label="Outgoing"
                value={data.outgoingRequests.length}
                detail="Sent requests"
              />
              <SocialStat
                label="Search"
                value={query ? data.searchResults.length : "--"}
                detail="Username matches"
              />
            </div>
          </div>
        </header>

        {params?.request || params?.friend || params?.user ? (
          <Alert>
            <Check className="size-4" />
            <AlertTitle>Social graph updated</AlertTitle>
            <AlertDescription>
              Your friend list and visibility scopes have been refreshed.
            </AlertDescription>
          </Alert>
        ) : null}

        <FriendsTabs activeTab={activeTab} />
        <FriendGraphTable rows={friendGraphRows} query={query} activeTab={activeTab} />

        <section className="grid gap-4 lg:grid-cols-3">
          <DataPanel>
            <SectionHeader
              title="Incoming requests"
              description="Approve only people you want in friend-scoped feed and leaderboard views."
            />
            <CardContent>
              <RequestList rows={data.incomingRequests} direction="incoming" />
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Friends"
              description="Friends do not get account access unless you separately invite them from settings."
            />
            <CardContent>
              <ProfileList empty="No friends yet." profiles={data.friends} mode="friends" />
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Outgoing requests"
              description="Cancel requests that have not been accepted yet."
            />
            <CardContent>
              <RequestList rows={data.outgoingRequests} direction="outgoing" />
            </CardContent>
          </DataPanel>
        </section>

        <section className="grid gap-4">
          <aside aria-label="Friend discovery rail" className="min-w-0">
            <DataPanel>
              <SectionHeader
                title="Suggested friends"
                description="Public profiles outside your current graph."
                action={<Users className="size-5 text-sky-600" />}
              />
              <CardContent>
                <ProfileList
                  empty="No public suggestions yet."
                  profiles={data.suggestedProfiles}
                  mode="search"
                />
              </CardContent>
            </DataPanel>
          </aside>
        </section>

        <DataPanel id="find-friends">
          <SectionHeader
            title="Find friends"
            description="Private profiles do not appear in search. Search requires public profile opt-in."
            action={<Search className="size-5 text-sky-600" />}
          />
          <CardContent className="grid gap-4">
            <form className="grid gap-2 sm:grid-cols-[1fr_auto]" action="/friends">
              <Input
                name="q"
                aria-label="Search public profiles by username"
                defaultValue={query}
                placeholder="Search by username"
                className="h-10 rounded-lg bg-white"
              />
              <Button
                type="submit"
                className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
              >
                <Search className="size-4" />
                Search
              </Button>
            </form>
            {query ? (
              <ProfileList
                empty="No public profiles matched that username."
                profiles={data.searchResults}
                mode="search"
              />
            ) : null}
          </CardContent>
        </DataPanel>

        <CompareWithFriendPanel friendCount={data.friends.length} />

        <section className="grid gap-4 lg:grid-cols-2">
          <DataPanel>
            <SectionHeader
              title="Active this week"
              description="Shortcuts for friend-scoped competition."
              action={<Trophy className="size-5 text-amber-600" />}
            />
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="outline">
                <Link href="/leaderboard?tab=friends" prefetch={false}>
                  <Users className="size-4" />
                  Friends leaderboard
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/course-records" prefetch={false}>
                  <Award className="size-4" />
                  Friend records
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/challenges" prefetch={false}>
                  <Trophy className="size-4" />
                  Start challenge
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tournaments" prefetch={false}>
                  <Trophy className="size-4" />
                  Friend event
                </Link>
              </Button>
            </CardContent>
          </DataPanel>

          <aside aria-label="Friend safety rail" className="min-w-0">
            <DataPanel id="blocked-users">
              <SectionHeader
                title="Blocked users"
                description="Blocked users cannot see friend-scoped profile or feed activity."
                action={<Ban className="size-5 text-red-600" />}
              />
              <CardContent>
                <BlockedList profiles={data.blockedUsers} />
              </CardContent>
            </DataPanel>
          </aside>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function MobileFriendRequests({ rows }: { rows: FriendsPageData["incomingRequests"] }) {
  if (rows.length === 0) {
    return null;
  }

  const primaryRows = rows.slice(0, 3);
  const olderRows = rows.slice(3);

  return (
    <section className="grid gap-2" aria-label="Incoming friend requests">
      <IOSSectionHeader
        title="Requests"
        description={`${rows.length} ${rows.length === 1 ? "person is" : "people are"} waiting for your response`}
      />
      <MobileFriendRequestRows rows={primaryRows} />
      {olderRows.length > 0 ? (
        <IOSDisclosureGroup
          label="More incoming friend requests"
          items={[
            {
              value: "more-friend-requests",
              title: "More requests",
              summary: olderRows.length,
              description: "Additional people waiting for a response",
              contentClassName: "px-0 pb-0 pt-0",
              content: <MobileFriendRequestRows rows={olderRows} />,
            },
          ]}
        />
      ) : null}
    </section>
  );
}

function MobileFriendRequestRows({ rows }: { rows: FriendsPageData["incomingRequests"] }) {
  return (
    <IOSGroupedList label="Incoming friend requests">
      {rows.map((row) => (
        <IOSListRow
          key={row.request.id}
          label={row.profile.displayName}
          detail={`@${row.profile.username}`}
          leading={
            <span className="hidden min-[360px]:block">
              <SocialAvatar
                displayName={row.profile.displayName}
                username={row.profile.username}
                avatarUrl={row.profile.avatarUrl}
                href={`/profile/${row.profile.username}`}
                size="sm"
              />
            </span>
          }
          status={<IOSInlineStatus label="Requested you" tone="attention" />}
          className="max-[359px]:gap-2 max-[359px]:px-3"
          trailing={
            <div className="flex items-center gap-1">
              <form action={acceptFriendRequestAction}>
                <input type="hidden" name="requestId" value={row.request.id} />
                <Button
                  type="submit"
                  size="icon"
                  className="size-11 rounded-full"
                  aria-label={`Accept ${row.profile.displayName}'s friend request`}
                >
                  <Check className="size-4" />
                </Button>
              </form>
              <form action={declineFriendRequestAction}>
                <input type="hidden" name="requestId" value={row.request.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-full"
                  aria-label={`Decline ${row.profile.displayName}'s friend request`}
                >
                  <X className="size-4" />
                </Button>
              </form>
            </div>
          }
        />
      ))}
    </IOSGroupedList>
  );
}

function MobileFriendList({ profiles }: { profiles: FriendsPageData["friends"] }) {
  return (
    <section className="grid gap-2" aria-label="Friends">
      <IOSSectionHeader
        title="Friends"
        description={`${profiles.length} connected ${profiles.length === 1 ? "golfer" : "golfers"}`}
      />
      <IOSGroupedList label="Connected friends">
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <IOSListRow
              key={profile.userId}
              label={profile.displayName}
              detail={`@${profile.username}${profile.homeCourse ? ` · ${profile.homeCourse}` : ""}`}
              value={profile.handicapBand ?? undefined}
              href={`/profile/${profile.username}`}
              leading={
                <SocialAvatar
                  displayName={profile.displayName}
                  username={profile.username}
                  avatarUrl={profile.avatarUrl}
                  size="sm"
                />
              }
              status={<IOSInlineStatus label="Friend" tone="positive" />}
            />
          ))
        ) : (
          <IOSListRow
            label="No friends yet"
            detail="Find a public profile or share your invite link to get started."
          />
        )}
      </IOSGroupedList>
    </section>
  );
}

function MobileFriendSearch({ data, query }: { data: FriendsPageData; query: string }) {
  return (
    <div className="grid gap-4">
      <form className="grid gap-3" action="/friends">
        <label className="grid gap-1 text-sm font-medium">
          Username
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search public profiles"
            autoCapitalize="none"
            autoCorrect="off"
            className="h-11"
          />
        </label>
        <Button type="submit" className="min-h-11">
          <Search className="size-4" />
          Search
        </Button>
      </form>
      {query ? (
        <IOSGroupedList label="Friend search results">
          {data.searchResults.length > 0 ? (
            data.searchResults.map((profile) => (
              <IOSListRow
                key={profile.userId}
                label={profile.displayName}
                detail={`@${profile.username}`}
                leading={
                  <SocialAvatar
                    displayName={profile.displayName}
                    username={profile.username}
                    avatarUrl={profile.avatarUrl}
                    href={`/profile/${profile.username}`}
                    size="sm"
                  />
                }
                trailing={<SearchResultAction profile={profile} />}
              />
            ))
          ) : (
            <IOSListRow label="No public match" detail={`No visible profile matched “${query}”.`} />
          )}
        </IOSGroupedList>
      ) : null}
    </div>
  );
}

function MobileFriendDetails({ data, profileUrl }: { data: FriendsPageData; profileUrl: string }) {
  const items: IOSDisclosureItem[] = [];

  if (data.outgoingRequests.length > 0) {
    items.push({
      value: "sent-requests",
      title: "Sent requests",
      summary: data.outgoingRequests.length,
      description: "Requests still awaiting a response",
      contentClassName: "px-0 pb-0 pt-0",
      content: (
        <IOSGroupedList label="Sent friend requests" className="border-0">
          {data.outgoingRequests.map((row) => (
            <IOSListRow
              key={row.request.id}
              label={row.profile.displayName}
              detail={`@${row.profile.username}`}
              leading={
                <SocialAvatar
                  displayName={row.profile.displayName}
                  username={row.profile.username}
                  avatarUrl={row.profile.avatarUrl}
                  href={`/profile/${row.profile.username}`}
                  size="sm"
                />
              }
              trailing={
                <form action={cancelFriendRequestAction}>
                  <input type="hidden" name="requestId" value={row.request.id} />
                  <Button type="submit" variant="outline" className="min-h-11">
                    Cancel
                  </Button>
                </form>
              }
            />
          ))}
        </IOSGroupedList>
      ),
    });
  }

  items.push({
    value: "manage-friends",
    title: "Manage friends",
    summary: data.friends.length,
    description: "Remove or block a connected golfer",
    contentClassName: "px-0 pb-0 pt-0",
    content: (
      <IOSGroupedList label="Manage connected friends" className="border-0">
        {data.friends.length > 0 ? (
          data.friends.map((profile) => (
            <IOSListRow
              key={profile.userId}
              label={profile.displayName}
              detail={`@${profile.username}`}
              leading={
                <SocialAvatar
                  displayName={profile.displayName}
                  username={profile.username}
                  avatarUrl={profile.avatarUrl}
                  href={`/profile/${profile.username}`}
                  size="sm"
                />
              }
              trailing={
                <div className="flex items-center gap-1">
                  <form action={removeFriendAction}>
                    <input type="hidden" name="friendUserId" value={profile.userId} />
                    <ConfirmSubmitButton
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-full"
                      aria-label={`Remove ${profile.displayName} as a friend`}
                      confirmTitle="Remove this friend?"
                      confirmMessage={`${profile.displayName} will be removed from your connected friends.`}
                      confirmActionLabel="Remove friend"
                    >
                      <UserMinus className="size-4" />
                    </ConfirmSubmitButton>
                  </form>
                  <form action={blockUserAction} data-friend-block-form>
                    <input type="hidden" name="blockedUserId" value={profile.userId} />
                    <ConfirmSubmitButton
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-full text-destructive"
                      aria-label={`Block ${profile.displayName}`}
                      confirmTitle="Block this golfer?"
                      confirmMessage={`${profile.displayName} will no longer be able to interact with you.`}
                      confirmActionLabel="Block golfer"
                    >
                      <Ban className="size-4" />
                    </ConfirmSubmitButton>
                  </form>
                </div>
              }
            />
          ))
        ) : (
          <IOSListRow label="No connected friends to manage" />
        )}
      </IOSGroupedList>
    ),
  });

  items.push({
    value: "suggested-friends",
    title: "Suggested golfers",
    summary: data.suggestedProfiles.length,
    description: "Public profiles outside your friend graph",
    contentClassName: "px-0 pb-0 pt-0",
    content: (
      <IOSGroupedList label="Suggested golfers" className="border-0">
        {data.suggestedProfiles.length > 0 ? (
          data.suggestedProfiles.map((profile) => (
            <IOSListRow
              key={profile.userId}
              label={profile.displayName}
              detail={`@${profile.username}`}
              leading={
                <SocialAvatar
                  displayName={profile.displayName}
                  username={profile.username}
                  avatarUrl={profile.avatarUrl}
                  href={`/profile/${profile.username}`}
                  size="sm"
                />
              }
              trailing={<SearchResultAction profile={profile} />}
            />
          ))
        ) : (
          <IOSListRow label="No public suggestions yet" />
        )}
      </IOSGroupedList>
    ),
  });

  items.push({
    value: "invite",
    title: "Invite a friend",
    summary: "QR or link",
    description: "Share your real public profile address",
    content: (
      <div className="grid gap-3">
        <div className="rounded-xl border bg-background p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/friends/qr/${data.profile.username}`}
            alt={`QR invite for @${data.profile.username}`}
            className="mx-auto aspect-square w-full max-w-40"
          />
        </div>
        <code className="break-all rounded-lg bg-muted px-3 py-2 text-xs">{profileUrl}</code>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={profileUrl} prefetch={false}>
            <Copy className="size-4" />
            Open invite page
          </Link>
        </Button>
      </div>
    ),
  });

  items.push({
    value: "friend-activity",
    title: "Friend activity",
    summary: "Open",
    description: "Feed, leaderboard and challenge views",
    contentClassName: "px-0 pb-0 pt-0",
    content: (
      <IOSGroupedList label="Friend activity shortcuts" className="border-0">
        <IOSListRow label="Friends feed" href="/feed?filter=friends" icon={Users} />
        <IOSListRow label="Friends leaderboard" href="/leaderboard?tab=friends" icon={Trophy} />
        <IOSListRow label="Challenges" href="/challenges" icon={Award} />
      </IOSGroupedList>
    ),
  });

  if (data.blockedUsers.length > 0) {
    items.push({
      value: "blocked-users",
      title: "Blocked users",
      summary: data.blockedUsers.length,
      description: "Profiles hidden from friend-scoped activity",
      contentClassName: "px-0 pb-0 pt-0",
      content: (
        <IOSGroupedList label="Blocked users" className="border-0">
          {data.blockedUsers.map((profile) => (
            <IOSListRow
              key={profile.userId}
              label={profile.displayName}
              detail={`@${profile.username}`}
              destructive
              trailing={
                <form action={unblockUserAction}>
                  <input type="hidden" name="blockedUserId" value={profile.userId} />
                  <Button type="submit" variant="outline" className="min-h-11">
                    Unblock
                  </Button>
                </form>
              }
            />
          ))}
        </IOSGroupedList>
      ),
    });
  }

  return <IOSDisclosureGroup label="Friend details" items={items} />;
}

function FriendGraphTable({
  rows,
  query,
  activeTab,
}: {
  rows: FriendGraphRow[];
  query: string;
  activeTab: FriendsTab;
}) {
  return (
    <section id="friend-graph-table" className="grid gap-3" data-workbench-scope="friend-graph">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">{friendsTabLabel(activeTab)}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {friendsTabDescription(activeTab)}
          </p>
        </div>
        <StatusPill tone={rows.length > 0 ? "green" : "slate"}>{rows.length} profiles</StatusPill>
      </div>
      <NativeListSection
        title="Golfer list"
        description={`${rows.length} profiles across the current friend graph.`}
        className="sm:hidden"
      >
        {rows.length > 0 ? (
          rows.map((row) => (
            <article key={row.id} className="apple-panel-strong p-3">
              <div className="flex min-w-0 items-start gap-3">
                <SocialAvatar
                  displayName={row.profile.displayName}
                  username={row.profile.username}
                  avatarUrl={row.profile.avatarUrl}
                  href={`/profile/${row.profile.username}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/profile/${row.profile.username}`}
                        prefetch={false}
                        className="block truncate text-sm font-semibold text-emerald-700"
                      >
                        {row.profile.displayName}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        @{row.profile.username}
                      </p>
                    </div>
                    <Badge variant={row.status === "friend" ? "secondary" : "outline"}>
                      {friendGraphStatusLabel(row.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <DataPair label="Home course" value={row.profile.homeCourse ?? "Not set"} />
                    <DataPair label="Handicap" value={row.profile.handicapBand ?? "Not set"} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <FriendGraphRowAction row={row} />
                  </div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <AppEmptyState
            icon={<Users className="size-5" />}
            title={`No ${friendsTabLabel(activeTab).toLowerCase()} yet`}
            description="Search public profiles or share your invite link to grow your golf network."
            primaryAction={
              <Button asChild size="sm">
                <Link href="/friends?tab=discover#find-friends" prefetch={false}>
                  Discover golfers
                </Link>
              </Button>
            }
          />
        )}
      </NativeListSection>
      <div className="hidden sm:grid sm:gap-3">
        <DesktopTableWorkbenchControls
          viewKey={`friend-graph-${query || "all"}`}
          scope="friend-graph"
          currentViewLabel={query ? `Search: ${query}` : "Friend graph"}
          resultLabel={`${rows.length} profiles`}
          columns={friendGraphColumns}
          suggestedViews={friendGraphSuggestedViews}
          exportTableId="friend-graph"
          exportFileName="forekinghell-friend-graph.csv"
        />
        <DataTableFrame mainTable mainTableLabel="Friend graph table" stickyFirstColumn>
          <Table data-workbench-export-table="friend-graph" aria-describedby="friend-graph-summary">
            <TableCaption id="friend-graph-summary" className="sr-only">
              Friend graph table showing golfer, relationship status, visibility, home course,
              launch monitor, handicap band and available social action.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead
                  data-column="golfer"
                  className="sticky left-0 z-20 min-w-64 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  Golfer
                </TableHead>
                <TableHead data-column="status">Status</TableHead>
                <TableHead data-column="visibility">Visibility</TableHead>
                <TableHead data-column="home-course">Home course</TableHead>
                <TableHead data-column="monitor">Monitor</TableHead>
                <TableHead data-column="handicap">Handicap</TableHead>
                <TableHead data-column="action" className="text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <TableRow key={row.id} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="golfer"
                      className="sticky left-0 z-10 min-w-64 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <SocialAvatar
                          displayName={row.profile.displayName}
                          username={row.profile.username}
                          avatarUrl={row.profile.avatarUrl}
                          href={`/profile/${row.profile.username}`}
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/profile/${row.profile.username}`}
                            prefetch={false}
                            className="truncate text-sm font-semibold text-emerald-700 hover:underline"
                          >
                            {row.profile.displayName}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            @{row.profile.username}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-column="status">
                      <Badge variant={row.status === "friend" ? "secondary" : "outline"}>
                        {friendGraphStatusLabel(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell data-column="visibility">
                      {row.profile.publicProfile
                        ? "Public"
                        : row.profile.friendProfile
                          ? "Friends"
                          : "Private"}
                    </TableCell>
                    <TableCell data-column="home-course">
                      {row.profile.homeCourse ?? "--"}
                    </TableCell>
                    <TableCell data-column="monitor">
                      {row.profile.primaryLaunchMonitor ?? "--"}
                    </TableCell>
                    <TableCell data-column="handicap">{row.profile.handicapBand ?? "--"}</TableCell>
                    <TableCell data-column="action" className="text-right">
                      <FriendGraphRowAction row={row} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No {friendsTabLabel(activeTab).toLowerCase()} yet. Use Discover to find a public
                    golfer or share your invite link.
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

function FriendGraphRowAction({ row }: { row: FriendGraphRow }) {
  if (row.status === "incoming" && row.requestId) {
    return (
      <div className="flex justify-end gap-2">
        <form action={acceptFriendRequestAction}>
          <input type="hidden" name="requestId" value={row.requestId} />
          <Button type="submit" size="sm">
            <Check className="size-4" />
            Accept
          </Button>
        </form>
        <form action={declineFriendRequestAction}>
          <input type="hidden" name="requestId" value={row.requestId} />
          <Button type="submit" variant="outline" size="sm">
            <X className="size-4" />
            Decline
          </Button>
        </form>
      </div>
    );
  }

  if (row.status === "outgoing" && row.requestId) {
    return (
      <form action={cancelFriendRequestAction}>
        <input type="hidden" name="requestId" value={row.requestId} />
        <Button type="submit" variant="outline" size="sm">
          <X className="size-4" />
          Cancel
        </Button>
      </form>
    );
  }

  if (row.status === "friend") {
    return (
      <FriendActionMenu
        userId={row.profile.userId}
        username={row.profile.username}
        displayName={row.profile.displayName}
      />
    );
  }

  if (row.status === "blocked") {
    return (
      <form action={unblockUserAction}>
        <input type="hidden" name="blockedUserId" value={row.profile.userId} />
        <Button type="submit" variant="outline" size="sm">
          Unblock
        </Button>
      </form>
    );
  }

  return <SearchResultAction profile={row.profile} />;
}

function CompareWithFriendPanel({ friendCount }: { friendCount: number }) {
  const compareItems = [
    { label: "Bag", href: "/compare?scope=bag", detail: "Stock yardages and gapping" },
    { label: "PBs", href: "/leaderboard?tab=friends", detail: "Personal bests and XP" },
    { label: "Handicap", href: "/compare?scope=handicap", detail: "Scoring trend and form" },
    { label: "Records", href: "/course-records", detail: "Friend course-record boards" },
  ];

  return (
    <DataPanel>
      <SectionHeader
        title="Compare with a friend"
        description="Keep social secondary by turning friend activity into useful golf comparisons."
        action={
          <StatusPill tone={friendCount > 0 ? "green" : "slate"}>{friendCount} friends</StatusPill>
        }
      />
      <CardContent className="grid gap-2 sm:grid-cols-4">
        {compareItems.map((item) => (
          <Button
            key={item.label}
            asChild
            variant="outline"
            className="h-auto justify-start rounded-lg p-3"
          >
            <Link href={item.href} prefetch={false}>
              <span className="text-left">
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {item.detail}
                </span>
              </span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </DataPanel>
  );
}

function ProfileList({
  profiles,
  empty,
  mode,
}: {
  profiles: SocialProfileSummary[];
  empty: string;
  mode: "search" | "friends";
}) {
  if (profiles.length === 0) {
    return (
      <AppEmptyState
        icon={<Users className="size-5" />}
        title="No golfers here yet"
        description={empty}
        primaryAction={
          <Button asChild size="sm" variant="outline">
            <Link href="/friends?tab=discover#find-friends" prefetch={false}>
              Discover golfers
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-2">
      {profiles.map((profile) => (
        <Item key={profile.userId} variant="outline" data-friend-user-id={profile.userId}>
          <ItemMedia>
            <SocialAvatar
              displayName={profile.displayName}
              username={profile.username}
              avatarUrl={profile.avatarUrl}
              href={`/profile/${profile.username}`}
            />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              <Link
                href={`/profile/${profile.username}`}
                prefetch={false}
                className="hover:underline"
              >
                {profile.displayName}
              </Link>
            </ItemTitle>
            <ItemDescription>
              @{profile.username} · {profile.homeCourse ?? "Home course not set"}
            </ItemDescription>
          </ItemContent>
          <Badge variant={mode === "friends" ? "secondary" : "outline"}>
            {mode === "friends" ? "Friend" : "Discover"}
          </Badge>
          <ItemActions>
            {mode === "friends" ? (
              <FriendActionMenu
                userId={profile.userId}
                username={profile.username}
                displayName={profile.displayName}
              />
            ) : (
              <SearchResultAction profile={profile} />
            )}
          </ItemActions>
        </Item>
      ))}
    </div>
  );
}

function SearchResultAction({ profile }: { profile: SocialProfileSummary }) {
  if (profile.relationship === "friend") {
    return <Badge variant="secondary">Friend</Badge>;
  }

  if (profile.relationship === "outgoing") {
    return <Badge variant="outline">Pending</Badge>;
  }

  if (profile.relationship === "incoming") {
    return <Badge variant="outline">Requested you</Badge>;
  }

  return (
    <form action={sendFriendRequestAction}>
      <input type="hidden" name="recipientUserId" value={profile.userId} />
      <Button type="submit" size="sm">
        <UserPlus className="size-4" />
        Add
      </Button>
    </form>
  );
}

function BlockedList({ profiles }: { profiles: SocialProfileSummary[] }) {
  if (profiles.length === 0) {
    return (
      <AppEmptyState
        icon={<Ban className="size-5" />}
        title="No blocked users"
        description="People you block will appear here so you can review or restore access."
        primaryAction={
          <Button asChild size="sm" variant="outline">
            <Link href="/friends?tab=friends" prefetch={false}>
              Back to friends
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-2">
      {profiles.map((profile) => (
        <Item key={profile.userId} variant="outline">
          <ItemMedia>
            <SocialAvatar
              displayName={profile.displayName}
              username={profile.username}
              avatarUrl={profile.avatarUrl}
              href={`/profile/${profile.username}`}
            />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{profile.displayName}</ItemTitle>
            <ItemDescription>@{profile.username}</ItemDescription>
          </ItemContent>
          <Badge variant="destructive">Blocked</Badge>
          <ItemActions>
            <form action={unblockUserAction}>
              <input type="hidden" name="blockedUserId" value={profile.userId} />
              <Button type="submit" variant="outline" size="sm">
                Unblock
              </Button>
            </form>
          </ItemActions>
        </Item>
      ))}
    </div>
  );
}

function RequestList({
  rows,
  direction,
}: {
  rows: Array<{ request: { id: string }; profile: SocialProfileSummary }>;
  direction: "incoming" | "outgoing";
}) {
  if (rows.length === 0) {
    return (
      <AppEmptyState
        icon={<UserPlus className="size-5" />}
        title="No pending requests"
        description="New incoming or sent friend requests will appear here."
        primaryAction={
          <Button asChild size="sm" variant="outline">
            <Link href="/friends?tab=discover#find-friends" prefetch={false}>
              Find golfers
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <Item key={row.request.id} variant="outline" className="items-start">
          <ItemMedia>
            <SocialAvatar
              displayName={row.profile.displayName}
              username={row.profile.username}
              avatarUrl={row.profile.avatarUrl}
              href={`/profile/${row.profile.username}`}
            />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              <Link
                href={`/profile/${row.profile.username}`}
                prefetch={false}
                className="hover:underline"
              >
                {row.profile.displayName}
              </Link>
            </ItemTitle>
            <ItemDescription>@{row.profile.username}</ItemDescription>
          </ItemContent>
          <ItemActions className="self-center">
            {direction === "incoming" ? (
              <div className="flex gap-2">
                <form action={acceptFriendRequestAction}>
                  <input type="hidden" name="requestId" value={row.request.id} />
                  <Button type="submit" size="sm">
                    <Check className="size-4" />
                    Accept
                  </Button>
                </form>
                <form action={declineFriendRequestAction}>
                  <input type="hidden" name="requestId" value={row.request.id} />
                  <Button type="submit" variant="outline" size="sm">
                    <X className="size-4" />
                    Decline
                  </Button>
                </form>
              </div>
            ) : (
              <form action={cancelFriendRequestAction}>
                <input type="hidden" name="requestId" value={row.request.id} />
                <Button type="submit" variant="outline" size="sm">
                  <X className="size-4" />
                  Cancel
                </Button>
              </form>
            )}
          </ItemActions>
        </Item>
      ))}
    </div>
  );
}

function buildFriendGraphRows(input: {
  friends: SocialProfileSummary[];
  incomingRequests: Array<{ request: { id: string }; profile: SocialProfileSummary }>;
  outgoingRequests: Array<{ request: { id: string }; profile: SocialProfileSummary }>;
  suggestedProfiles: SocialProfileSummary[];
  searchResults: SocialProfileSummary[];
  blockedUsers: SocialProfileSummary[];
}) {
  const rows: FriendGraphRow[] = [];
  const seenUserIds = new Set<string>();
  const pushRow = (
    profile: SocialProfileSummary,
    status: FriendGraphStatus,
    requestId?: string,
  ) => {
    if (seenUserIds.has(profile.userId)) {
      return;
    }

    seenUserIds.add(profile.userId);
    rows.push({
      id: `${status}:${requestId ?? profile.userId}`,
      profile,
      status,
      requestId,
    });
  };

  input.incomingRequests.forEach((row) => pushRow(row.profile, "incoming", row.request.id));
  input.outgoingRequests.forEach((row) => pushRow(row.profile, "outgoing", row.request.id));
  input.friends.forEach((profile) => pushRow(profile, "friend"));
  input.blockedUsers.forEach((profile) => pushRow(profile, "blocked"));
  input.searchResults.forEach((profile) => pushRow(profile, "search"));
  input.suggestedProfiles.forEach((profile) => pushRow(profile, "suggested"));

  return rows;
}

function parseFriendsTab(value: string | undefined, query: string): FriendsTab {
  if (query) {
    return "discover";
  }

  return value === "incoming" || value === "sent" || value === "discover" || value === "blocked"
    ? value
    : "friends";
}

function filterFriendGraphRows(rows: FriendGraphRow[], activeTab: FriendsTab) {
  if (activeTab === "friends") {
    return rows.filter((row) => row.status === "friend");
  }
  if (activeTab === "incoming") {
    return rows.filter((row) => row.status === "incoming");
  }
  if (activeTab === "sent") {
    return rows.filter((row) => row.status === "outgoing");
  }
  if (activeTab === "blocked") {
    return rows.filter((row) => row.status === "blocked");
  }
  return rows.filter((row) => row.status === "suggested" || row.status === "search");
}

function friendsTabLabel(tab: FriendsTab) {
  if (tab === "incoming") return "Incoming requests";
  if (tab === "sent") return "Sent requests";
  if (tab === "discover") return "Discover golfers";
  if (tab === "blocked") return "Blocked users";
  return "Friends";
}

function friendsTabDescription(tab: FriendsTab) {
  if (tab === "incoming") return "Approve or decline people who have asked to connect.";
  if (tab === "sent") return "Review friend requests that are still waiting for a response.";
  if (tab === "discover") return "Search public profiles and build your golf network.";
  if (tab === "blocked")
    return "Review people hidden from friend-scoped profile and feed activity.";
  return "Connected golfers who power friend-scoped feeds, records and leaderboards.";
}

function friendGraphStatusLabel(status: FriendGraphStatus) {
  if (status === "incoming") {
    return "Requested you";
  }

  if (status === "outgoing") {
    return "Pending";
  }

  if (status === "suggested") {
    return "Suggested";
  }

  if (status === "search") {
    return "Search result";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Friend";
}

function SocialStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-[#F5F6F4] px-3 py-2">
      <p className="text-xl font-semibold tracking-normal">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function profileHeaderBackground(imageUrl: string) {
  return `linear-gradient(90deg, rgba(15, 23, 42, 0.56), rgba(6, 78, 59, 0.18)), url("${imageUrl.replace(/"/g, "%22")}")`;
}
