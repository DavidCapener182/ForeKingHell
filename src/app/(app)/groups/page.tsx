import Link from "next/link";
import { Globe2, Lock, Plus, Radio, Search, Settings, Trophy, Users } from "lucide-react";

import { joinGroupAction, joinGroupByInviteCodeAction } from "@/app/groups/actions";
import { GroupCreateForm, GroupCreateSheet } from "@/app/groups/group-create-sheet";
import { GroupSectionTabs } from "@/app/groups/group-section-tabs";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { GroupDigestFeaturePanel } from "@/components/features/feature-panels";
import {
  BottomSheet,
  MobileAppShell,
  MobileIconButton,
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
import { SocialAvatar } from "@/components/social/social-avatar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageArtwork } from "@/components/visuals/page-artwork";
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
import { getGroupsPageData, type GroupLinkedChallengeItem, type GroupListItem } from "@/lib/groups";
import { getFeatureIdeasData } from "@/lib/feature-ideas";

export const dynamic = "force-dynamic";

type GroupsPageProps = {
  searchParams?: Promise<{
    created?: string;
    joined?: string;
    invite?: string;
    tab?: string;
    left?: string;
    deleted?: string;
  }>;
};

type GroupsTab = "active" | "challenges" | "clubs";

const groupBoardColumns: DesktopWorkbenchColumn[] = [
  { id: "group", label: "Group", locked: true },
  { id: "status", label: "Status" },
  { id: "visibility", label: "Visibility" },
  { id: "type", label: "Type" },
  { id: "members", label: "Members" },
  { id: "posts", label: "Posts" },
  { id: "challenges", label: "Challenges" },
  { id: "action", label: "Action", locked: true },
];

const groupBoardSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Active groups",
    href: "/groups",
    detail: "Groups where you already have a role.",
  },
  {
    title: "Challenge groups",
    href: "/groups?tab=challenges",
    detail: "Groups with linked live challenge boards.",
  },
  {
    title: "Clubs",
    href: "/groups?tab=clubs",
    detail: "Discoverable clubs, societies and simulator leagues.",
  },
  {
    title: "Create group",
    href: "#create-group",
    detail: "Start a private friend group or public league.",
  },
];

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const [data, featureData] = await Promise.all([
    getGroupsPageData(params?.invite),
    getFeatureIdeasData(),
  ]);
  const activeTab = parseGroupsTab(params?.tab);
  const groupBoardRows = filterGroupBoardRows(data.groups, activeTab);
  const mobileGroupIds = new Set(groupBoardRows.map((group) => group.id));
  const mobileLinkedChallenges = data.linkedChallenges.filter((challenge) =>
    mobileGroupIds.has(challenge.groupId),
  );
  const mobileStatus = mobileGroupStatus(activeTab, groupBoardRows);

  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar
          title="Groups"
          actions={<MobileIconButton href="/settings" label="Settings" icon={Settings} />}
        />
        <MobileRouteTabs group="social" activeKey="groups" />
        <MobileTabBar
          activeKey={activeTab}
          className="-mt-4"
          tabs={[
            { key: "active", label: "Active", href: "/groups" },
            { key: "challenges", label: "Challenges", href: "/groups?tab=challenges" },
            { key: "clubs", label: "Clubs", href: "/groups?tab=clubs" },
          ]}
        />
        <MobileStatusAction
          label={mobileStatus.label}
          value={mobileStatus.value}
          detail={mobileStatus.detail}
          action={
            <BottomSheet
              label={
                <>
                  <Plus className="size-4" /> Create
                </>
              }
              title="Create group"
            >
              <GroupCreateForm groupTypes={data.groupTypes} />
            </BottomSheet>
          }
        />
        {params?.invite ? (
          <section className="premium-card p-4">
            {data.invitePreview ? (
              <div className="grid gap-3">
                <div>
                  <p className="font-semibold">Invite to {data.invitePreview.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.invitePreview.description ??
                      `${data.invitePreview.memberCount} members · ${label(data.invitePreview.visibility)}`}
                  </p>
                </div>
                {data.invitePreview.viewerRole ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/groups/${data.invitePreview.slug}`} prefetch={false}>
                      Open group
                    </Link>
                  </Button>
                ) : (
                  <form action={joinGroupByInviteCodeAction}>
                    <input type="hidden" name="inviteCode" value={data.invitePreview.inviteCode} />
                    <Button type="submit" className="w-full">
                      Join from invite
                    </Button>
                  </form>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                That group invite is not valid or has expired.
              </p>
            )}
          </section>
        ) : null}
        <MobileGroupList activeTab={activeTab} groups={groupBoardRows} />
        <MobileLinkedGroupChallenges challenges={mobileLinkedChallenges} />
        <GroupDigestFeaturePanel data={featureData} />
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="groups" className="hidden lg:grid">
        <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <aside
            aria-label="Group operations rail"
            className="order-2 grid gap-4 lg:order-none lg:sticky lg:top-28"
          >
            <section className="premium-card p-4">
              <div className="flex items-center gap-3">
                <SocialAvatar
                  displayName={data.profile.displayName}
                  username={data.profile.username}
                  avatarUrl={data.profile.avatarUrl}
                  href="/profile"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{data.profile.displayName}</p>
                  <p className="truncate text-sm text-muted-foreground">@{data.profile.username}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniStat label="My groups" value={data.mine.length} />
                <MiniStat label="Open" value={data.discoverable.length} />
              </div>
            </section>

            <Card id="create-group" className="scroll-mt-28">
              <CardHeader>
                <CardTitle>Build a league</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create the group in a focused side panel without losing this board.
                </p>
              </CardHeader>
              <CardFooter>
                <GroupCreateSheet groupTypes={data.groupTypes} />
              </CardFooter>
            </Card>
          </aside>

          <section className="order-1 grid gap-4 lg:order-none" aria-labelledby="groups-heading">
            <header id="overview" className="premium-hero scroll-mt-28 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <StatusPill tone="green">Groups and leagues</StatusPill>
                  <h1 id="groups-heading" className="mt-3 text-3xl font-semibold tracking-normal">
                    Groups
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Build launch-monitor leagues, golf societies, coach stables and simulator venue
                    communities with their own feed, linked challenges and weekly rivalry.
                  </p>
                </div>
                <PageArtwork
                  variant="groups"
                  alt=""
                  className="hidden h-28 w-48 shrink-0 lg:block"
                  sizes="192px"
                  priority
                />
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/challenges?tab=seasons" prefetch={false}>
                      <Trophy className="size-4" />
                      Season leagues
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/tournaments" prefetch={false}>
                      <Trophy className="size-4" />
                      Events
                    </Link>
                  </Button>
                </div>
              </div>
              {params?.created || params?.joined || params?.left || params?.deleted ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  Group network updated.
                </div>
              ) : null}
            </header>

            <GroupSectionTabs />

            {params?.invite ? (
              <section className="premium-card p-4">
                {data.invitePreview ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Invite to {data.invitePreview.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {data.invitePreview.description ??
                          `${data.invitePreview.memberCount} members · ${label(data.invitePreview.visibility)}`}
                      </p>
                    </div>
                    {data.invitePreview.viewerRole ? (
                      <Button asChild variant="outline">
                        <Link href={`/groups/${data.invitePreview.slug}`} prefetch={false}>
                          Open group
                        </Link>
                      </Button>
                    ) : (
                      <form action={joinGroupByInviteCodeAction}>
                        <input
                          type="hidden"
                          name="inviteCode"
                          value={data.invitePreview.inviteCode}
                        />
                        <Button type="submit">Join from invite</Button>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    That group invite is not valid or has expired.
                  </p>
                )}
              </section>
            ) : null}

            <GroupBoardTable
              activeTab={activeTab}
              groups={groupBoardRows}
              totalCount={data.groups.length}
            />

            <section id="members" className="premium-card scroll-mt-28 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">My groups</p>
                  <p className="text-sm text-muted-foreground">
                    Private and joined groups stay scoped to members.
                  </p>
                </div>
                <Badge variant="secondary">{data.mine.length} joined</Badge>
              </div>
              <GroupGrid
                groups={data.mine}
                empty="You have not joined a group yet."
                groupTypes={data.groupTypes}
              />
            </section>

            <section className="premium-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Discoverable leagues</p>
                  <p className="text-sm text-muted-foreground">
                    Public opt-in groups for monthly boards and community challenges.
                  </p>
                </div>
                <Search className="size-5 text-sky-600" />
              </div>
              <GroupGrid
                groups={data.discoverable}
                empty="No public groups yet. Create the first golf league."
                groupTypes={data.groupTypes}
              />
            </section>

            <aside
              id="activity"
              aria-label="Group activity digest rail"
              className="scroll-mt-28 min-w-0"
            >
              <GroupDigestFeaturePanel data={featureData} />
            </aside>
          </section>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function GroupBoardTable({
  activeTab,
  groups,
  totalCount,
}: {
  activeTab: GroupsTab;
  groups: GroupListItem[];
  totalCount: number;
}) {
  return (
    <section id="group-board-table" className="grid gap-3" data-workbench-scope="group-board">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Group board</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Review membership, visibility, activity and challenge volume before opening a league or
            joining a public club.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={groups.length > 0 ? "green" : "slate"}>
            {groups.length} shown
          </StatusPill>
          <StatusPill tone="slate">{totalCount} total</StatusPill>
        </div>
      </div>

      <GroupBoardFilterTabs activeTab={activeTab} />

      <DesktopTableWorkbenchControls
        viewKey={`group-board-${activeTab}`}
        scope="group-board"
        currentViewLabel={groupBoardViewLabel(activeTab)}
        resultLabel={`${groups.length} groups`}
        columns={groupBoardColumns}
        suggestedViews={groupBoardSuggestedViews}
        exportTableId="group-board"
        exportFileName={`forekinghell-groups-${activeTab}.csv`}
      />
      <DataTableFrame mainTable mainTableLabel="Group board table" stickyFirstColumn>
        <Table data-workbench-export-table="group-board" aria-describedby="group-board-summary">
          <TableCaption id="group-board-summary" className="sr-only">
            Group board table showing group, membership status, visibility, group type, member
            count, post count, challenge count and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="group"
                className="sticky left-0 z-20 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Group
              </TableHead>
              <TableHead data-column="status">Status</TableHead>
              <TableHead data-column="visibility">Visibility</TableHead>
              <TableHead data-column="type">Type</TableHead>
              <TableHead data-column="members">Members</TableHead>
              <TableHead data-column="posts">Posts</TableHead>
              <TableHead data-column="challenges">Challenges</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length > 0 ? (
              groups.map((group) => (
                <TableRow key={group.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="group"
                    className="sticky left-0 z-10 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <Link
                      href={`/groups/${group.slug}`}
                      prefetch={false}
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      {group.name}
                    </Link>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {group.description ?? "No group description yet."}
                    </p>
                  </TableCell>
                  <TableCell data-column="status">
                    <Badge variant={group.viewerRole ? "secondary" : "outline"}>
                      {group.viewerRole ? label(group.viewerRole) : "Discoverable"}
                    </Badge>
                  </TableCell>
                  <TableCell data-column="visibility">
                    <span className="inline-flex items-center gap-1">
                      {group.visibility === "public" ? (
                        <Globe2 className="size-3" />
                      ) : (
                        <Lock className="size-3" />
                      )}
                      {label(group.visibility)}
                    </span>
                  </TableCell>
                  <TableCell data-column="type">{label(group.groupType)}</TableCell>
                  <TableCell data-column="members">{group.memberCount}</TableCell>
                  <TableCell data-column="posts">{group.postCount}</TableCell>
                  <TableCell data-column="challenges">{group.challengeCount}</TableCell>
                  <TableCell data-column="action" className="text-right">
                    <GroupBoardAction group={group} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No groups match this view.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function GroupBoardFilterTabs({ activeTab }: { activeTab: GroupsTab }) {
  const tabs: Array<{ key: GroupsTab; label: string; href: string }> = [
    { key: "active", label: "Active", href: "/groups" },
    { key: "challenges", label: "Challenges", href: "/groups?tab=challenges" },
    { key: "clubs", label: "Clubs", href: "/groups?tab=clubs" },
  ];

  return (
    <nav aria-label="Group board views" className="flex flex-wrap gap-2">
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

function GroupBoardAction({ group }: { group: GroupListItem }) {
  if (!group.viewerRole && group.visibility === "public") {
    return (
      <form action={joinGroupAction}>
        <input type="hidden" name="groupId" value={group.id} />
        <Button type="submit" size="sm">
          Join
        </Button>
      </form>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/groups/${group.slug}`} prefetch={false}>
        Open
      </Link>
    </Button>
  );
}

function GroupGrid({
  groups,
  empty,
  groupTypes,
}: {
  groups: GroupListItem[];
  empty: string;
  groupTypes: readonly string[];
}) {
  if (groups.length === 0) {
    return (
      <AppEmptyState
        className="mt-4"
        icon={<Users className="size-5" />}
        title="No groups in this section"
        description={empty}
        primaryAction={<GroupCreateSheet groupTypes={groupTypes} />}
      />
    );
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {groups.map((group) => (
        <Card key={group.id} className="gap-3">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar className="size-10 border bg-emerald-950 text-white">
                <AvatarFallback className="bg-emerald-950 text-white">
                  {group.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <Link
                  href={`/groups/${group.slug}`}
                  prefetch={false}
                  className="font-semibold hover:underline"
                >
                  {group.name}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {group.description ?? "No group description yet."}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              {group.visibility === "public" ? (
                <Globe2 className="size-3" />
              ) : (
                <Lock className="size-3" />
              )}
              {label(group.visibility)}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <Users className="size-3" />
              {group.memberCount}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Radio className="size-3" />
              {group.postCount} posts
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Trophy className="size-3" />
              {group.challengeCount}
            </Badge>
            <Badge variant="outline">{label(group.groupType)}</Badge>
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/groups/${group.slug}`} prefetch={false}>
                Open
              </Link>
            </Button>
            {!group.viewerRole && group.visibility === "public" ? (
              <form action={joinGroupAction}>
                <input type="hidden" name="groupId" value={group.id} />
                <Button type="submit" size="sm">
                  Join
                </Button>
              </form>
            ) : group.viewerRole ? (
              <Badge variant="secondary">{label(group.viewerRole)}</Badge>
            ) : null}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-[#F5F6F4] px-3 py-2">
      <p className="text-lg font-semibold tracking-normal">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function MobileGroupList({ activeTab, groups }: { activeTab: GroupsTab; groups: GroupListItem[] }) {
  return (
    <section className="grid gap-2" aria-label={groupBoardViewLabel(activeTab)}>
      <IOSSectionHeader
        title={groupBoardViewLabel(activeTab)}
        description={`${groups.length} ${groups.length === 1 ? "group" : "groups"} in this view`}
      />
      <IOSGroupedList label={groupBoardViewLabel(activeTab)}>
        {groups.length > 0 ? (
          groups.map((group) => (
            <IOSListRow
              key={group.id}
              label={group.name}
              value={group.viewerRole ? label(group.viewerRole) : "Discover"}
              detail={`${label(group.groupType)} · ${group.memberCount} members · ${group.postCount} posts · ${group.challengeCount} linked challenges`}
              href={`/groups/${group.slug}`}
              icon={group.visibility === "public" ? Globe2 : Lock}
              status={
                <IOSInlineStatus
                  label={group.visibility === "public" ? "Public" : "Private"}
                  tone={group.viewerRole ? "positive" : "neutral"}
                />
              }
            />
          ))
        ) : (
          <IOSListRow label="No groups in this view" detail={groupMobileEmptyDetail(activeTab)} />
        )}
      </IOSGroupedList>
    </section>
  );
}

function MobileLinkedGroupChallenges({ challenges }: { challenges: GroupLinkedChallengeItem[] }) {
  return (
    <IOSDisclosureGroup
      label="Linked group challenges"
      items={[
        {
          value: "linked-group-challenges",
          title: "Linked challenges",
          summary: `${challenges.length}`,
          description: "Challenge boards attached to groups in this view",
          contentClassName: "px-0 pb-0 pt-0",
          content: (
            <IOSGroupedList label="Linked challenges" className="border-0">
              {challenges.length > 0 ? (
                challenges.map((challenge) => (
                  <IOSListRow
                    key={`${challenge.groupId}:${challenge.id}`}
                    label={challenge.title}
                    value={label(challenge.status)}
                    detail={`${challenge.groupName} · ${challenge.templateName}`}
                    href={`/challenges/${challenge.id}`}
                    status={<IOSInlineStatus label="Linked board" tone="info" />}
                  />
                ))
              ) : (
                <IOSListRow
                  label="No linked challenges"
                  detail="Groups in this view do not have a linked challenge board yet."
                />
              )}
            </IOSGroupedList>
          ),
        },
      ]}
    />
  );
}

function mobileGroupStatus(activeTab: GroupsTab, groups: GroupListItem[]) {
  const firstGroup = groups[0] ?? null;

  return {
    label: groupBoardViewLabel(activeTab),
    value: `${groups.length} ${groups.length === 1 ? "group" : "groups"}`,
    detail: firstGroup
      ? `${firstGroup.memberCount} members · ${firstGroup.challengeCount} linked`
      : groupMobileEmptyDetail(activeTab),
  };
}

function groupMobileEmptyDetail(activeTab: GroupsTab) {
  if (activeTab === "challenges") {
    return "No visible group has a linked challenge board yet.";
  }

  if (activeTab === "clubs") {
    return "No discoverable club, society or simulator league is visible yet.";
  }

  return "Join a public group or create a private group to get started.";
}

function filterGroupBoardRows(groups: GroupListItem[], activeTab: GroupsTab) {
  if (activeTab === "challenges") {
    return groups.filter((group) => group.challengeCount > 0);
  }

  if (activeTab === "clubs") {
    return groups.filter(
      (group) =>
        group.groupType === "club" ||
        group.groupType === "society" ||
        group.groupType === "rapsodo_league" ||
        group.groupType === "simulator_venue" ||
        group.visibility === "public",
    );
  }

  return groups.filter((group) => group.viewerRole);
}

function groupBoardViewLabel(activeTab: GroupsTab) {
  if (activeTab === "challenges") {
    return "Challenge groups";
  }

  if (activeTab === "clubs") {
    return "Clubs and leagues";
  }

  return "Active groups";
}

function parseGroupsTab(value?: string): GroupsTab {
  if (value === "challenges" || value === "clubs") {
    return value;
  }

  return "active";
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
