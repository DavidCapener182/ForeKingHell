import Link from "next/link";
import { ArrowLeft, Check, Search, UserPlus, Users, X } from "lucide-react";

import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  sendFriendRequestAction,
  unblockUserAction,
} from "@/app/friends/actions";
import { FriendActionMenu } from "@/app/friends/friend-action-menu";
import { FriendInviteDialog } from "@/app/friends/friend-invite-dialog";
import { FriendsTabs, type FriendsTab } from "@/app/friends/friends-tabs";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DesktopWorkbenchLayout,
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Input } from "@/components/ui/input";
import { Item } from "@/components/ui/item";
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
    href: "/friends?tab=incoming#friend-graph-table",
    detail: "Approve or decline pending requests from one table.",
  },
  {
    title: "Find friends",
    href: "/friends?tab=discover#find-friends",
    detail: "Search public profiles and send a request.",
  },
  {
    title: "Blocked users",
    href: "/friends?tab=blocked#friend-graph-table",
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
      <DesktopWorkbenchLayout scope="friends">
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
            className="hidden h-24 bg-gradient-to-br from-foreground via-primary to-accent bg-cover bg-center sm:block"
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
                  <Button asChild size="sm" variant="outline" className="rounded-lg bg-card">
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
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

async function FriendGraphTable({
  rows,
  query,
  activeTab,
}: {
  rows: FriendGraphRow[];
  query: string;
  activeTab: FriendsTab;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");

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
      {activeTab === "discover" ? (
        <Item id="find-friends" variant="outline" className="block">
          <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" action="/friends">
            <input type="hidden" name="tab" value="discover" />
            <Input
              name="q"
              aria-label="Search public profiles by username"
              defaultValue={query}
              placeholder="Search by username"
              className="h-10 bg-background"
            />
            <Button type="submit">
              <Search className="size-4" />
              Search
            </Button>
          </form>
        </Item>
      ) : null}
      <div className="grid gap-3">
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
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
              <TableRow>
                <TableHead
                  data-column="golfer"
                  className="sticky left-0 z-20 min-w-64 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
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
                      className="sticky left-0 z-10 min-w-64 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
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
                            className="truncate text-sm font-semibold text-primary hover:underline"
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
                  <TableCell colSpan={7} className="p-4">
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
          <ConfirmSubmitButton
            type="submit"
            variant="outline"
            size="sm"
            confirmTitle={`Decline ${row.profile.displayName}'s request?`}
            confirmMessage="This removes the incoming request without blocking the golfer."
            confirmActionLabel="Decline request"
          >
            <X className="size-4" />
            Decline
          </ConfirmSubmitButton>
        </form>
      </div>
    );
  }

  if (row.status === "outgoing" && row.requestId) {
    return (
      <form action={cancelFriendRequestAction}>
        <input type="hidden" name="requestId" value={row.requestId} />
        <ConfirmSubmitButton
          type="submit"
          variant="outline"
          size="sm"
          confirmTitle={`Cancel request to ${row.profile.displayName}?`}
          confirmMessage="This removes the pending friend request. You can send another request later."
          confirmActionLabel="Cancel request"
        >
          <X className="size-4" />
          Cancel
        </ConfirmSubmitButton>
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
    <Item variant="muted" className="block px-3 py-2">
      <p className="text-xl font-semibold tracking-normal">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </Item>
  );
}

function profileHeaderBackground(imageUrl: string) {
  return `linear-gradient(90deg, rgba(15, 23, 42, 0.56), rgba(6, 78, 59, 0.18)), url("${imageUrl.replace(/"/g, "%22")}")`;
}
