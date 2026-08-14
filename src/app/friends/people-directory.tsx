import Link from "next/link";
import { Search, Users } from "lucide-react";

import { PeopleActionMenu, type PeopleDirectoryStatus } from "@/app/friends/friend-action-menu";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { DataTableFrame } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { SocialProfileSummary } from "@/lib/social";

import type { FriendsTab } from "./friends-tabs";

export type PeopleDirectoryRow = {
  id: string;
  profile: SocialProfileSummary;
  status: PeopleDirectoryStatus;
  requestId?: string;
  section?: "results" | "recommended";
};

export function PeopleDirectory({
  rows,
  query,
  activeTab,
}: {
  rows: PeopleDirectoryRow[];
  query: string;
  activeTab: FriendsTab;
}) {
  const groups = groupRows(rows, activeTab, query);
  const returnHref = directoryReturnHref(activeTab, query);
  const mobile = (
    <div className="grid gap-4">
      {groups.map((group) => (
        <section key={group.label} className="grid gap-2" aria-labelledby={group.mobileHeadingId}>
          {group.showLabel ? (
            <h3
              id={group.mobileHeadingId}
              className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {group.label}
            </h3>
          ) : null}
          {group.rows.map((row) => (
            <PeopleItemRow key={row.id} row={row} returnHref={returnHref} />
          ))}
        </section>
      ))}
      {rows.length === 0 ? <DirectoryEmptyState activeTab={activeTab} /> : null}
    </div>
  );

  return (
    <section className="grid gap-4" aria-labelledby="people-directory-heading">
      {activeTab === "discover" ? (
        <form
          id="find-friends"
          className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          action="/friends"
        >
          <input type="hidden" name="tab" value="discover" />
          <Input
            name="q"
            aria-label="Search golfers by username or name"
            defaultValue={query}
            placeholder="Search by username or name"
            className="h-10 bg-background"
          />
          <Button type="submit">
            <Search className="size-4" />
            Search
          </Button>
        </form>
      ) : null}

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="people-directory-heading" className="text-lg font-semibold">
            {directoryTitle(activeTab, query)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{directoryDescription(activeTab)}</p>
        </div>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {rows.length} {rows.length === 1 ? "person" : "people"}
        </span>
      </div>

      <div className="hidden min-[1024px]:block">
        <DataTableFrame
          mainTable
          mainTableId="people-directory"
          mainTableLabel={`${directoryTitle(activeTab, query)} directory`}
          className="rounded-xl"
        >
          <Table aria-describedby="people-directory-summary">
            <TableCaption id="people-directory-summary" className="sr-only">
              People directory showing golfer, home course, visible handicap, connection and
              actions.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Golfer</TableHead>
                <TableHead>Home course</TableHead>
                <TableHead>Handicap</TableHead>
                <TableHead>Connection</TableHead>
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                groups.flatMap((group) => [
                  ...(group.showLabel
                    ? [
                        <TableRow
                          key={`${group.label}:heading`}
                          className="bg-muted/45 hover:bg-muted/45"
                        >
                          <TableCell
                            colSpan={5}
                            className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {group.label}
                          </TableCell>
                        </TableRow>,
                      ]
                    : []),
                  ...group.rows.map((row) => (
                    <PeopleTableRow key={row.id} row={row} returnHref={returnHref} />
                  )),
                ])
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="p-4">
                    <DirectoryEmptyState activeTab={activeTab} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </div>
      <div className="min-w-0 min-[1024px]:hidden">{mobile}</div>
    </section>
  );
}

function PeopleTableRow({ row, returnHref }: { row: PeopleDirectoryRow; returnHref: string }) {
  return (
    <TableRow>
      <TableCell>
        <GolferIdentity row={row} />
      </TableCell>
      <TableCell>{row.profile.homeCourse ?? "Not shared"}</TableCell>
      <TableCell>{row.profile.handicapBand ?? "Not shared"}</TableCell>
      <TableCell>
        <Badge variant={row.status === "friend" ? "secondary" : "outline"}>
          {connectionLabel(row)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <PeopleActionMenuForRow row={row} returnHref={returnHref} />
      </TableCell>
    </TableRow>
  );
}

function PeopleItemRow({ row, returnHref }: { row: PeopleDirectoryRow; returnHref: string }) {
  return (
    <Item variant="outline" className="items-start">
      <ItemMedia>
        <SocialAvatar
          displayName={row.profile.displayName}
          username={row.profile.username}
          avatarUrl={row.profile.avatarUrl}
          href={`/profile/${row.profile.username}`}
          size="sm"
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <Link href={`/profile/${row.profile.username}`} prefetch={false}>
            {row.profile.displayName}
          </Link>
        </ItemTitle>
        <ItemDescription>@{row.profile.username}</ItemDescription>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-muted-foreground">
          <span>{row.profile.homeCourse ?? "Home course not shared"}</span>
          {row.profile.handicapBand ? <span>Hcap {row.profile.handicapBand}</span> : null}
        </div>
        <Badge className="mt-2" variant={row.status === "friend" ? "secondary" : "outline"}>
          {connectionLabel(row)}
        </Badge>
      </ItemContent>
      <ItemActions>
        <PeopleActionMenuForRow row={row} returnHref={returnHref} />
      </ItemActions>
    </Item>
  );
}

function GolferIdentity({ row }: { row: PeopleDirectoryRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <SocialAvatar
        displayName={row.profile.displayName}
        username={row.profile.username}
        avatarUrl={row.profile.avatarUrl}
        href={`/profile/${row.profile.username}`}
        size="sm"
      />
      <div className="min-w-0">
        <Link
          href={`/profile/${row.profile.username}`}
          prefetch={false}
          className="block truncate text-sm font-semibold hover:underline"
        >
          {row.profile.displayName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">@{row.profile.username}</p>
      </div>
    </div>
  );
}

function PeopleActionMenuForRow({
  row,
  returnHref,
}: {
  row: PeopleDirectoryRow;
  returnHref: string;
}) {
  return (
    <PeopleActionMenu
      userId={row.profile.userId}
      username={row.profile.username}
      displayName={row.profile.displayName}
      status={row.status}
      relationship={row.profile.relationship}
      requestId={row.requestId}
      returnHref={returnHref}
    />
  );
}

function DirectoryEmptyState({ activeTab }: { activeTab: FriendsTab }) {
  return (
    <AppEmptyState
      icon={<Users className="size-5" />}
      title={`No ${directoryTitle(activeTab, "").toLowerCase()} yet`}
      description={emptyDescription(activeTab)}
      primaryAction={
        activeTab === "discover" ? (
          <Button asChild size="sm" variant="outline">
            <Link href="#find-friends">Search golfers</Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href="/friends?tab=discover" prefetch={false}>
              Discover golfers
            </Link>
          </Button>
        )
      }
    />
  );
}

function groupRows(rows: PeopleDirectoryRow[], activeTab: FriendsTab, query: string) {
  if (activeTab !== "discover") {
    return [
      {
        label: directoryTitle(activeTab, query),
        mobileHeadingId: `${activeTab}-people-heading`,
        rows,
        showLabel: false,
      },
    ];
  }

  const groups = [];
  const results = rows.filter((row) => row.section === "results");
  const recommended = rows.filter((row) => row.section === "recommended");

  if (query) {
    groups.push({
      label: "Search results",
      mobileHeadingId: "search-results-heading",
      rows: results,
      showLabel: true,
    });
  }
  if (recommended.length > 0 || !query) {
    groups.push({
      label: "Recommended golfers",
      mobileHeadingId: "recommended-golfers-heading",
      rows: recommended,
      showLabel: true,
    });
  }

  return groups;
}

function directoryTitle(tab: FriendsTab, query: string) {
  if (tab === "incoming") return "Incoming";
  if (tab === "sent") return "Sent";
  if (tab === "discover") return query ? "Discover" : "Recommended golfers";
  if (tab === "blocked") return "Blocked";
  return "Friends";
}

function directoryDescription(tab: FriendsTab) {
  if (tab === "incoming") return "People waiting for your response.";
  if (tab === "sent") return "Friend requests you have sent.";
  if (tab === "discover") return "Search golfers, then browse recommended people below.";
  if (tab === "blocked") return "People you have blocked.";
  return "The golfers you are connected with.";
}

function emptyDescription(tab: FriendsTab) {
  if (tab === "incoming") return "New friend requests will appear here.";
  if (tab === "sent") return "Requests you send will appear here until they are answered.";
  if (tab === "blocked") return "People you block will appear here.";
  if (tab === "discover") return "Try searching for a golfer by name or username.";
  return "Find golfers to start building your people directory.";
}

function connectionLabel(row: PeopleDirectoryRow) {
  if (row.status === "incoming") return "Incoming request";
  if (row.status === "outgoing") return "Request sent";
  if (row.status === "blocked") return "Blocked";
  if (row.status === "friend" || row.profile.relationship === "friend") return "Friend";
  if (row.profile.relationship === "incoming") return "Requested you";
  if (row.profile.relationship === "outgoing") return "Request sent";
  if (row.status === "suggested") return "Recommended";
  return "Not connected";
}

function directoryReturnHref(activeTab: FriendsTab, query: string) {
  const params = new URLSearchParams({ tab: activeTab });
  if (query) params.set("q", query);
  return `/friends?${params.toString()}`;
}
