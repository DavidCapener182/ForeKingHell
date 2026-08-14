import Link from "next/link";
import { Globe2, Lock, Plus, Trophy } from "lucide-react";

import { joinGroupAction, joinGroupByInviteCodeAction } from "@/app/groups/actions";
import { GroupCreateSheet } from "@/app/groups/group-create-sheet";
import { GroupSectionTabs, type GroupSection } from "@/app/groups/group-section-tabs";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { GroupDigestFeaturePanel } from "@/components/features/feature-panels";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Item } from "@/components/ui/item";
import { PageArtwork } from "@/components/visuals/page-artwork";
import {
  DesktopWorkbenchLayout,
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
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
import { getGroupsPageData, type GroupListItem } from "@/lib/groups";
import { getFeatureIdeasData } from "@/lib/feature-ideas";

export const dynamic = "force-dynamic";

type GroupsPageProps = {
  searchParams?: Promise<{
    created?: string;
    joined?: string;
    invite?: string;
    section?: string;
    left?: string;
    deleted?: string;
  }>;
};

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
    title: "Overview",
    href: "/groups?section=overview",
    detail: "All groups and discoverable leagues in one board.",
  },
  {
    title: "Activity",
    href: "/groups?section=activity",
    detail: "Latest group and league activity.",
  },
  {
    title: "Members",
    href: "/groups?section=members",
    detail: "Groups where you already have a role.",
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
  const activeSection = parseGroupSection(params?.section);

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="groups">
        <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <aside
            aria-label="Group operations rail"
            className="order-2 grid gap-4 lg:order-none lg:sticky lg:top-28"
          >
            <Card className="p-4 py-4">
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
                <MiniStat label="Memberships" value={data.mine.length} />
                <MiniStat label="Open" value={data.discoverable.length} />
              </div>
            </Card>

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
                <Alert className="mt-4">
                  <AlertDescription>Group network updated.</AlertDescription>
                </Alert>
              ) : null}
            </header>

            <GroupSectionTabs activeSection={activeSection} baseHref="/groups" />

            {params?.invite ? (
              <Card className="p-4 py-4">
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
              </Card>
            ) : null}

            {activeSection === "overview" ? (
              <GroupBoardTable
                heading="Group overview"
                description="Review every joined and discoverable league in one board before opening it or joining."
                groups={data.groups}
                viewKey="group-board-overview"
              />
            ) : activeSection === "members" ? (
              <div id="members" className="scroll-mt-28">
                <GroupBoardTable
                  heading="My memberships"
                  description="Private and joined groups where you already have a role."
                  groups={data.mine}
                  viewKey="group-board-members"
                />
              </div>
            ) : (
              <aside
                id="activity"
                aria-label="Group activity digest"
                className="scroll-mt-28 min-w-0"
              >
                <GroupDigestFeaturePanel data={featureData} />
              </aside>
            )}
          </section>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

async function GroupBoardTable({
  heading,
  description,
  groups,
  viewKey,
}: {
  heading: string;
  description: string;
  groups: GroupListItem[];
  viewKey: string;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");

  return (
    <section id="group-board-table" className="grid gap-3" data-workbench-scope="group-board">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">{heading}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <StatusPill tone={groups.length > 0 ? "green" : "slate"}>{groups.length} shown</StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={viewKey}
        scope="group-board"
        currentViewLabel={heading}
        resultLabel={`${groups.length} groups`}
        columns={groupBoardColumns}
        suggestedViews={groupBoardSuggestedViews}
        exportTableId="group-board"
        exportFileName={`forekinghell-${viewKey}.csv`}
      />
      <DataTableFrame mainTable mainTableLabel="Group board table" stickyFirstColumn>
        <Table data-workbench-export-table="group-board" aria-describedby="group-board-summary">
          <TableCaption id="group-board-summary" className="sr-only">
            Group board table showing group, membership status, visibility, group type, member
            count, post count, challenge count and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
            <TableRow>
              <TableHead
                data-column="group"
                className="sticky left-0 z-20 min-w-72 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
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
                    className="sticky left-0 z-10 min-w-72 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    <Link
                      href={`/groups/${group.slug}`}
                      prefetch={false}
                      className="font-semibold text-primary hover:underline"
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
                <TableCell colSpan={8} className="p-4">
                  <AppEmptyState
                    icon={<Plus className="size-5" />}
                    title="No groups match this view"
                    description="Create a private group or browse the overview for a public league."
                    primaryAction={
                      <Button asChild size="sm">
                        <Link href="/groups?section=overview#create-group" prefetch={false}>
                          Create or discover
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
    </section>
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Item variant="muted" size="sm" className="block">
      <p className="text-lg font-semibold tracking-normal">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Item>
  );
}

function parseGroupSection(value?: string): GroupSection {
  return value === "activity" || value === "members" ? value : "overview";
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
