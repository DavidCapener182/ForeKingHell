import Link from "next/link";
import type { ReactNode } from "react";
import { Copy, Globe2, Lock, MessageCircle, Plus, Trophy, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { createGroupPostAction } from "@/app/groups/actions";
import { GroupDangerActions } from "@/app/groups/group-danger-actions";
import { GroupMembersDialog } from "@/app/groups/group-members-dialog";
import { GroupSectionTabs, type GroupSection } from "@/app/groups/group-section-tabs";
import { AppEmptyState } from "@/components/app/app-empty-state";
import {
  DesktopWorkbenchLayout,
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item } from "@/components/ui/item";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getGroupDetailData, type GroupDetailData } from "@/lib/groups";

export const dynamic = "force-dynamic";

type GroupDetailPageProps = {
  params: Promise<{
    groupSlug: string;
  }>;
  searchParams?: Promise<{
    created?: string;
    posted?: string;
    section?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const weekDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

const groupMemberColumns: DesktopWorkbenchColumn[] = [
  { id: "member", label: "Member", locked: true },
  { id: "role", label: "Role" },
  { id: "points", label: "Points" },
  { id: "best", label: "Best" },
  { id: "rounds", label: "Rounds" },
  { id: "last", label: "Last played" },
  { id: "action", label: "Action", locked: true },
];

const groupChallengeColumns: DesktopWorkbenchColumn[] = [
  { id: "challenge", label: "Challenge", locked: true },
  { id: "template", label: "Template" },
  { id: "status", label: "Status" },
  { id: "action", label: "Action", locked: true },
];

export default async function GroupDetailPage({ params, searchParams }: GroupDetailPageProps) {
  const { groupSlug } = await params;
  const flags = await searchParams;
  const data = await getGroupDetailData(groupSlug);

  if (!data) {
    notFound();
  }

  const activeSection = parseGroupDetailSection(flags?.section);
  const sectionBaseHref = `/groups/${data.group.slug}`;

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="group-detail">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="grid gap-4">
            <header id="overview" className="premium-hero scroll-mt-28 overflow-hidden">
              <div className="h-36 bg-gradient-to-br from-foreground via-primary to-accent" />
              <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div>
                  <StatusPill tone="green">{label(data.group.groupType)}</StatusPill>
                  <h1 className="mt-3 text-3xl font-semibold tracking-normal">{data.group.name}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {data.group.description ?? "No description yet."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1">
                      {data.group.visibility === "public" ? (
                        <Globe2 className="size-3" />
                      ) : (
                        <Lock className="size-3" />
                      )}
                      {label(data.group.visibility)}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Users className="size-3" />
                      {data.group.memberCount} members
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Trophy className="size-3" />
                      {data.group.challengeCount} challenges
                    </Badge>
                    <Badge variant="outline">
                      {data.canAdmin ? "Admin" : label(data.group.viewerRole ?? "Viewer")}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <GroupMembersDialog members={data.members} />
                  <Button asChild variant="outline">
                    <Link href="/groups" prefetch={false}>
                      All groups
                    </Link>
                  </Button>
                </div>
              </div>
              {flags?.created || flags?.posted ? (
                <Alert className="mx-5 mb-5">
                  <AlertDescription>Group updated.</AlertDescription>
                </Alert>
              ) : null}
            </header>

            <GroupSectionTabs activeSection={activeSection} baseHref={sectionBaseHref} />

            <section id="group-operations" className="grid scroll-mt-28 gap-4">
              {activeSection === "overview" ? (
                <>
                  <section id="leaderboard" className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <SquadLeaderboardPanel rivalry={data.rivalry} />
                    <WeeklyRivalryPanel rivalry={data.rivalry} />
                  </section>
                  <GroupChallengeTable group={data.group} challenges={data.challenges} />
                </>
              ) : activeSection === "activity" ? (
                <GroupActivitySection data={data} />
              ) : (
                <GroupMemberTable
                  group={data.group}
                  members={data.members}
                  standings={data.rivalry.standings}
                />
              )}
            </section>
          </section>

          <section className="grid gap-4 lg:sticky lg:top-28">
            <Card className="p-4 py-4">
              <p className="text-sm font-semibold">Group activity</p>
              <div className="mt-3 grid gap-2 text-sm">
                <SideMetric
                  icon={<Users className="size-4 text-primary" />}
                  label="Members"
                  value={data.group.memberCount}
                />
                <SideMetric
                  icon={<MessageCircle className="size-4 text-primary" />}
                  label="Posts"
                  value={data.group.postCount}
                />
                <SideMetric
                  icon={<Trophy className="size-4 text-primary" />}
                  label="Challenges"
                  value={data.group.challengeCount}
                />
              </div>
            </Card>

            <Card className="p-4 py-4">
              <p className="text-sm font-semibold">Membership controls</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Leaving removes member-only access. Deleting is available only to the group owner.
              </p>
              <div className="mt-3">
                <GroupDangerActions
                  groupId={data.group.id}
                  groupName={data.group.name}
                  isOwner={data.isOwner}
                  isMember={Boolean(data.group.viewerRole)}
                />
              </div>
            </Card>

            {data.group.rules ? (
              <Card className="p-4 py-4">
                <p className="text-sm font-semibold">Rules</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {data.group.rules}
                </p>
              </Card>
            ) : null}

            {data.canAdmin && data.group.inviteCode ? (
              <Card id="invite" className="p-4 py-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Copy className="size-4 text-primary" />
                  Invite
                </p>
                <Item variant="muted" className="mt-3 block p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/groups/qr/${data.group.inviteCode}`}
                    alt={`QR invite for ${data.group.name}`}
                    className="mx-auto aspect-square w-full max-w-36"
                  />
                </Item>
                <p className="mt-2 break-all rounded-lg bg-muted/55 px-3 py-2 font-mono text-xs">
                  {data.group.inviteCode}
                </p>
              </Card>
            ) : null}

            <Card id="access" className="p-4 py-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Lock className="size-4 text-primary" />
                Access
              </p>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <p>
                  {data.canAdmin
                    ? "Your current group role has admin authority. Invite and rule information is available above."
                    : "Only a group admin can manage invite and rule settings. Your current view remains read-only for those controls."}
                </p>
                <Badge variant="outline" className="w-fit">
                  {data.canAdmin ? "Admin" : label(data.group.viewerRole ?? "Viewer")}
                </Badge>
              </div>
            </Card>
          </section>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function GroupActivitySection({ data }: { data: GroupDetailData }) {
  return (
    <section id="activity" className="grid scroll-mt-28 gap-3">
      {data.canPost ? (
        <Item id="feed" variant="outline" className="block p-4">
          <GroupPostForm data={data} />
        </Item>
      ) : null}
      {data.posts.length === 0 ? (
        <AppEmptyState
          icon={<MessageCircle className="size-5" />}
          title="No group posts yet"
          description="The first group update will appear here for members."
          primaryAction={
            data.canPost ? (
              <Button asChild variant="outline" size="sm">
                <a href="#feed">Create first post</a>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/groups" prefetch={false}>
                  Back to groups
                </Link>
              </Button>
            )
          }
        />
      ) : (
        data.posts.map((post) => (
          <Item key={post.id} variant="outline" className="block p-4">
            <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
              <SocialAvatar
                displayName={post.profile.displayName}
                username={post.profile.username}
                avatarUrl={post.profile.avatarUrl}
                href={`/profile/${post.profile.username}`}
              />
              <div className="min-w-0">
                <Link
                  href={`/profile/${post.profile.username}`}
                  prefetch={false}
                  className="text-sm font-semibold hover:underline"
                >
                  {post.profile.displayName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  @{post.profile.username} · {dateFormatter.format(post.createdAt)}
                </p>
              </div>
              {post.pinned ? <Badge variant="secondary">Pinned</Badge> : null}
            </header>
            {post.title ? (
              <h2 className="mt-4 text-lg font-semibold tracking-normal">{post.title}</h2>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {post.body}
            </p>
          </Item>
        ))
      )}
    </section>
  );
}

function GroupPostForm({ data }: { data: GroupDetailData }) {
  return (
    <form action={createGroupPostAction} className="grid gap-3">
      <input type="hidden" name="groupId" value={data.group.id} />
      <input type="hidden" name="slug" value={data.group.slug} />
      <label className="grid gap-1 text-sm font-medium">
        <span>
          Title <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
        <Input name="title" placeholder="Group update" className="h-9 rounded-lg bg-background" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        <span>Update</span>
        <Textarea
          name="body"
          rows={3}
          placeholder="Share a league update, challenge note or session recap"
          className="rounded-lg bg-background"
          required
        />
      </label>
      <Button type="submit" className="w-fit rounded-lg">
        <Plus className="size-4" />
        Post to group
      </Button>
    </form>
  );
}

function SideMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/55 px-3 py-2">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-semibold tracking-normal">{value}</span>
    </div>
  );
}

type RivalryData = GroupDetailData["rivalry"];
type GroupMember = GroupDetailData["members"][number];
type GroupChallenge = GroupDetailData["challenges"][number];
type GroupStanding = RivalryData["standings"][number];

async function GroupMemberTable({
  group,
  members,
  standings,
}: {
  group: GroupDetailData["group"];
  members: GroupMember[];
  standings: GroupStanding[];
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const standingsByUserId = new Map(standings.map((standing) => [standing.userId, standing]));
  const suggestedViews = groupMemberSuggestedViews(group.slug);

  return (
    <section className="grid gap-3" data-workbench-scope="group-members">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Member roster</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Role, weekly points and latest scoring evidence for this group.
          </p>
        </div>
        <StatusPill tone={standings.length > 0 ? "green" : "slate"}>
          {standings.length} in rivalry
        </StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`group-members-${group.slug}`}
        scope="group-members"
        currentViewLabel={`${group.name} members`}
        resultLabel={`${members.length} members`}
        columns={groupMemberColumns}
        suggestedViews={suggestedViews}
        exportTableId="group-member-roster"
        exportFileName={`forekinghell-group-${group.slug}-members.csv`}
      />

      <DataTableFrame mainTable mainTableLabel="Group member roster table" stickyFirstColumn>
        <Table
          data-workbench-export-table="group-member-roster"
          aria-describedby="group-member-roster-summary"
        >
          <TableCaption id="group-member-roster-summary" className="sr-only">
            Group member roster table showing member, role, weekly points, best score, round count,
            last played date and profile action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
            <TableRow>
              <TableHead
                data-column="member"
                className="sticky left-0 z-20 min-w-72 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
              >
                Member
              </TableHead>
              <TableHead data-column="role">Role</TableHead>
              <TableHead data-column="points">Points</TableHead>
              <TableHead data-column="best">Best</TableHead>
              <TableHead data-column="rounds">Rounds</TableHead>
              <TableHead data-column="last">Last played</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length > 0 ? (
              members.map((member) => {
                const standing = standingsByUserId.get(member.userId);

                return (
                  <TableRow key={member.userId} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="member"
                      className="sticky left-0 z-10 min-w-72 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <SocialAvatar
                          displayName={member.displayName}
                          username={member.username}
                          avatarUrl={member.avatarUrl}
                          href={`/profile/${member.username}`}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/profile/${member.username}`}
                            prefetch={false}
                            className="font-semibold text-primary hover:underline"
                          >
                            {member.displayName}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">@{member.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-column="role">
                      <Badge variant="outline">{label(member.role)}</Badge>
                    </TableCell>
                    <TableCell data-column="points">{standing?.points ?? 0}</TableCell>
                    <TableCell data-column="best">{formatBestScore(standing)}</TableCell>
                    <TableCell data-column="rounds">{standing?.roundsPlayed ?? 0}</TableCell>
                    <TableCell data-column="last">
                      {standing?.lastPlayedAt ? dateFormatter.format(standing.lastPlayedAt) : "--"}
                    </TableCell>
                    <TableCell data-column="action" className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/profile/${member.username}`} prefetch={false}>
                          Open profile
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="p-4">
                  <AppEmptyState
                    icon={<Users className="size-5" />}
                    title="No active members"
                    description="The roster will populate when golfers accept access to this group."
                    primaryAction={<GroupMembersDialog members={members} />}
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

async function GroupChallengeTable({
  group,
  challenges,
}: {
  group: GroupDetailData["group"];
  challenges: GroupChallenge[];
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const suggestedViews = groupChallengeSuggestedViews(group.slug);

  return (
    <section className="grid gap-3" data-workbench-scope="group-challenges">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Linked challenge review</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Challenge boards that are genuinely connected to this group.
          </p>
        </div>
        <StatusPill tone={challenges.length > 0 ? "amber" : "slate"}>
          {challenges.length} linked
        </StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`group-challenges-${group.slug}`}
        scope="group-challenges"
        currentViewLabel={`${group.name} challenges`}
        resultLabel={`${challenges.length} challenges`}
        columns={groupChallengeColumns}
        suggestedViews={suggestedViews}
        exportTableId="group-linked-challenges"
        exportFileName={`forekinghell-group-${group.slug}-challenges.csv`}
      />

      <DataTableFrame label="Group linked challenges table" stickyFirstColumn>
        <Table
          data-workbench-export-table="group-linked-challenges"
          aria-describedby="group-linked-challenges-summary"
        >
          <TableCaption id="group-linked-challenges-summary" className="sr-only">
            Group linked challenges table showing challenge, template, status and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
            <TableRow>
              <TableHead
                data-column="challenge"
                className="sticky left-0 z-20 min-w-72 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
              >
                Challenge
              </TableHead>
              <TableHead data-column="template">Template</TableHead>
              <TableHead data-column="status">Status</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {challenges.length > 0 ? (
              challenges.map((challenge) => (
                <TableRow key={challenge.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="challenge"
                    className="sticky left-0 z-10 min-w-72 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    <Link
                      href={`/challenges/${challenge.id}`}
                      prefetch={false}
                      className="font-semibold text-primary hover:underline"
                    >
                      {challenge.title}
                    </Link>
                  </TableCell>
                  <TableCell data-column="template">{challenge.templateName}</TableCell>
                  <TableCell data-column="status">
                    <Badge variant="secondary">{label(challenge.status)}</Badge>
                  </TableCell>
                  <TableCell data-column="action" className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/challenges/${challenge.id}`} prefetch={false}>
                        Open board
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="p-4">
                  <AppEmptyState
                    icon={<Trophy className="size-5" />}
                    title="No linked challenge boards"
                    description="Link a challenge to this group before it can appear in the operations board."
                    primaryAction={
                      <Button asChild variant="outline" size="sm">
                        <Link href="/challenges" prefetch={false}>
                          Open challenges
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

function SquadLeaderboardPanel({ rivalry }: { rivalry: RivalryData }) {
  const leader = rivalry.standings[0] ?? null;

  return (
    <Card className="p-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Squad leaderboard</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {weekDateFormatter.format(rivalry.startsAt)} -{" "}
            {weekDateFormatter.format(rivalry.endsAt)} · {rivalry.periodKey}
          </p>
        </div>
        <StatusPill tone={leader ? "green" : "slate"}>{rivalry.sourceLabel}</StatusPill>
      </div>
      <div className="mt-4 grid gap-2">
        {rivalry.standings.length > 0 ? (
          rivalry.standings.slice(0, 6).map((standing, index) => (
            <div
              key={standing.userId}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-muted/55 px-3 py-2"
            >
              <span className="grid size-8 place-items-center rounded-full bg-card text-sm font-semibold">
                {index + 1}
              </span>
              <div className="min-w-0">
                {standing.username ? (
                  <Link
                    href={`/profile/${standing.username}`}
                    prefetch={false}
                    className="truncate text-sm font-semibold hover:underline"
                  >
                    {standing.displayName}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-semibold">{standing.displayName}</p>
                )}
                <p className="truncate text-xs text-muted-foreground">{standing.summary}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold tracking-normal">{standing.points}</p>
                <p className="text-xs text-muted-foreground">pts</p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No active members yet.
          </p>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/leaderboard" prefetch={false}>
            Open leaderboards
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function WeeklyRivalryPanel({ rivalry }: { rivalry: RivalryData }) {
  return (
    <Card className="p-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{rivalry.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Head-to-head pairings from current squad points.
          </p>
        </div>
        <StatusPill tone="amber">{rivalry.pairings.length} matches</StatusPill>
      </div>
      <div className="mt-4 grid gap-2">
        {rivalry.pairings.length > 0 ? (
          rivalry.pairings.slice(0, 4).map((pairing) => (
            <div
              key={`${pairing.userAId}:${pairing.userBId ?? "bye"}`}
              className="rounded-lg border bg-muted/55 p-3"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm">
                <p className="truncate font-semibold">{pairing.userALabel}</p>
                <span className="rounded-full bg-card px-2 py-1 text-xs text-muted-foreground">
                  vs
                </span>
                <p className="truncate text-right font-semibold">{pairing.userBLabel}</p>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <p className="text-2xl font-semibold tracking-normal">{pairing.userAScore}</p>
                <Trophy className="size-4 text-primary" />
                <p className="text-right text-2xl font-semibold tracking-normal">
                  {pairing.userBScore ?? "--"}
                </p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{pairing.summary}</p>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Add members and scored rounds to generate pairings.
          </p>
        )}
      </div>
    </Card>
  );
}

function groupMemberSuggestedViews(slug: string): DesktopSavedViewSuggestion[] {
  return [
    {
      title: "Member roster",
      href: `/groups/${slug}?section=members#group-operations`,
      detail: "Roles, weekly points and scoring evidence for this group.",
    },
    {
      title: "Group leaderboard",
      href: `/groups/${slug}?section=overview#leaderboard`,
      detail: "Open the live rivalry and pairings for the current week.",
    },
    {
      title: "Friends",
      href: "/friends",
      detail: "Manage requests and friend comparisons.",
    },
  ];
}

function groupChallengeSuggestedViews(slug: string): DesktopSavedViewSuggestion[] {
  return [
    {
      title: "Linked challenges",
      href: `/groups/${slug}?section=overview#group-operations`,
      detail: "Challenge boards connected to this group.",
    },
    {
      title: "Challenge centre",
      href: "/challenges",
      detail: "Open active, invited and recommended challenge boards.",
    },
    {
      title: "Group overview",
      href: `/groups/${slug}`,
      detail: "Return to the current group feed and weekly summary.",
    },
  ];
}

function formatBestScore(standing: GroupStanding | undefined) {
  if (!standing || standing.bestScore === null) {
    return "--";
  }

  return `${standing.bestScore} (${formatToPar(standing.bestToPar)})`;
}

function formatToPar(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value === 0) {
    return "E";
  }

  return value > 0 ? `+${value}` : String(value);
}

function parseGroupDetailSection(value?: string): GroupSection {
  return value === "activity" || value === "members" ? value : "overview";
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
