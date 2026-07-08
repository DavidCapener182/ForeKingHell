import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowLeft,
  Award,
  Ban,
  Check,
  Copy,
  QrCode,
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
import {
  DataPanel,
  DataTableFrame,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFriendsPageData, type SocialProfileSummary } from "@/lib/social";

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
  }>;
};

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const [params, requestHeaders] = await Promise.all([searchParams, headers()]);
  const query = params?.q?.trim() ?? "";
  const data = await getFriendsPageData(query);
  const profileUrl = `${getRequestOrigin(requestHeaders)}/profile/${data.profile.username}`;
  const friendGraphRows = buildFriendGraphRows({
    friends: data.friends,
    incomingRequests: data.incomingRequests,
    outgoingRequests: data.outgoingRequests,
    suggestedProfiles: data.suggestedProfiles,
    searchResults: query ? data.searchResults : [],
    blockedUsers: data.blockedUsers,
  });

  return (
    <PageShell>
      <MobileRouteHeader title="Social" group="social" activeKey="friends" />

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
                <Button asChild size="sm" variant="outline" className="rounded-lg bg-white">
                  <Link href="/feed" prefetch={false}>
                    Open feed
                  </Link>
                </Button>
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

        <FriendGraphTable rows={friendGraphRows} query={query} />

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

        <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside aria-label="Friend invite rail" className="min-w-0">
            <DataPanel id="friend-invite">
              <SectionHeader
                title="Invite"
                description="Profile link and compact QR invite."
                action={<QrCode className="size-5 text-emerald-600" />}
              />
              <CardContent className="grid gap-3">
                <div className="rounded-lg border bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/friends/qr/${data.profile.username}`}
                    alt={`QR invite for @${data.profile.username}`}
                    className="mx-auto aspect-square w-full max-w-28 sm:max-w-36"
                  />
                </div>
                <div className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-xs">
                  <p className="font-medium">Invite link</p>
                  <code className="mt-1 block break-all text-muted-foreground">{profileUrl}</code>
                </div>
                <Button asChild variant="outline">
                  <Link href={profileUrl} prefetch={false}>
                    <Copy className="size-4" />
                    Open invite page
                  </Link>
                </Button>
              </CardContent>
            </DataPanel>
          </aside>

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

function FriendGraphTable({ rows, query }: { rows: FriendGraphRow[]; query: string }) {
  return (
    <section id="friend-graph-table" className="grid gap-3" data-workbench-scope="friend-graph">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Friend manager</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            One desktop table for requests, friends, suggestions, blocked users and profile search.
          </p>
        </div>
        <StatusPill tone={rows.length > 0 ? "green" : "slate"}>{rows.length} profiles</StatusPill>
      </div>
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
            Friend graph table showing golfer, relationship status, visibility, home course, launch
            monitor, handicap band and available social action.
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
                  <TableCell data-column="home-course">{row.profile.homeCourse ?? "--"}</TableCell>
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
                  No friend graph rows yet. Search for a public username or share your invite link.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
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
      <div className="flex justify-end gap-2">
        <form action={removeFriendAction}>
          <input type="hidden" name="friendUserId" value={row.profile.userId} />
          <Button type="submit" variant="ghost" size="sm">
            <UserMinus className="size-4" />
            Remove
          </Button>
        </form>
        <form action={blockUserAction} data-friend-block-form>
          <input type="hidden" name="blockedUserId" value={row.profile.userId} />
          <Button type="submit" variant="ghost" size="sm">
            <Ban className="size-4" />
            Block
          </Button>
        </form>
      </div>
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
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>
    );
  }

  return (
    <div className="grid gap-2">
      {profiles.map((profile) => (
        <div
          key={profile.userId}
          className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-3"
          data-friend-user-id={profile.userId}
        >
          <div className="flex min-w-0 items-center gap-3">
            <SocialAvatar
              displayName={profile.displayName}
              username={profile.username}
              avatarUrl={profile.avatarUrl}
              href={`/profile/${profile.username}`}
            />
            <div className="min-w-0">
              <Link
                href={`/profile/${profile.username}`}
                prefetch={false}
                className="truncate text-sm font-semibold hover:underline"
              >
                {profile.displayName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mode === "friends" ? (
              <>
                <form action={removeFriendAction}>
                  <input type="hidden" name="friendUserId" value={profile.userId} />
                  <Button type="submit" variant="ghost" size="sm">
                    <UserMinus className="size-4" />
                    Remove
                  </Button>
                </form>
                <form action={blockUserAction} data-friend-block-form>
                  <input type="hidden" name="blockedUserId" value={profile.userId} />
                  <Button type="submit" variant="ghost" size="sm">
                    <Ban className="size-4" />
                    Block
                  </Button>
                </form>
              </>
            ) : (
              <SearchResultAction profile={profile} />
            )}
          </div>
        </div>
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
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        No blocked users.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {profiles.map((profile) => (
        <div
          key={profile.userId}
          className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-3 shadow-sm"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
          </div>
          <form action={unblockUserAction}>
            <input type="hidden" name="blockedUserId" value={profile.userId} />
            <Button type="submit" variant="outline" size="sm">
              Unblock
            </Button>
          </form>
        </div>
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
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        No pending requests.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div
          key={row.request.id}
          className="grid gap-3 rounded-lg border bg-white px-3 py-3 shadow-sm"
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
                className="truncate text-sm font-semibold hover:underline"
              >
                {row.profile.displayName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">@{row.profile.username}</p>
            </div>
          </div>
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
        </div>
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

function getRequestOrigin(requestHeaders: Headers) {
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function profileHeaderBackground(imageUrl: string) {
  return `linear-gradient(90deg, rgba(15, 23, 42, 0.56), rgba(6, 78, 59, 0.18)), url("${imageUrl.replace(/"/g, "%22")}")`;
}
