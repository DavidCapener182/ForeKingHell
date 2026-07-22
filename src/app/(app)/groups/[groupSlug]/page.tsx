import Link from "next/link";
import type { ReactNode } from "react";
import {
  Award,
  Copy,
  Globe2,
  Lock,
  MessageCircle,
  Plus,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { notFound } from "next/navigation";

import { createGroupPostAction } from "@/app/groups/actions";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getGroupDetailData, type GroupDetailData } from "@/lib/groups";

export const dynamic = "force-dynamic";

type GroupDetailPageProps = {
  params: Promise<{
    groupSlug: string;
  }>;
  searchParams?: Promise<{
    created?: string;
    posted?: string;
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

const groupTabs = [
  { label: "Feed", href: "#feed" },
  { label: "Leaderboard", href: "#leaderboard" },
  { label: "Operations", href: "#group-operations" },
  { label: "Records", href: "#records" },
  { label: "Tournaments", href: "#tournaments" },
  { label: "Challenges", href: "#challenges" },
  { label: "Members", href: "#members" },
  { label: "Invite", href: "#invite" },
  { label: "Settings", href: "#settings" },
];

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

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="group-detail">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="grid gap-4">
            <header className="premium-hero overflow-hidden">
              <div className="h-36 bg-[linear-gradient(135deg,#111827,#047857_52%,#38bdf8)]" />
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
                    <Badge variant="outline" className="gap-1">
                      <Award className="size-3" />
                      records ready
                    </Badge>
                  </div>
                </div>
                <Button asChild variant="outline">
                  <Link href="/groups" prefetch={false}>
                    All groups
                  </Link>
                </Button>
              </div>
              {flags?.created || flags?.posted ? (
                <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  Group updated.
                </div>
              ) : null}
            </header>

            <nav className="premium-card flex flex-wrap gap-2 p-3" aria-label="Group sections">
              {groupTabs.map((tab) => (
                <a
                  key={tab.href}
                  href={tab.href}
                  className="rounded-lg border bg-[#F5F6F4] px-3 py-1.5 text-sm font-medium hover:bg-white"
                >
                  {tab.label}
                </a>
              ))}
            </nav>

            <section id="leaderboard" className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <SquadLeaderboardPanel rivalry={data.rivalry} />
              <WeeklyRivalryPanel rivalry={data.rivalry} />
            </section>

            <GroupOperationsBoard data={data} />

            {data.canPost ? (
              <section id="feed" className="premium-card p-4">
                <form action={createGroupPostAction} className="grid gap-3">
                  <input type="hidden" name="groupId" value={data.group.id} />
                  <input type="hidden" name="slug" value={data.group.slug} />
                  <Input
                    name="title"
                    placeholder="Post title"
                    className="h-9 rounded-lg bg-white"
                  />
                  <textarea
                    name="body"
                    rows={3}
                    placeholder="Share a league update, challenge note or session recap"
                    className="rounded-lg border bg-white px-3 py-2 text-sm"
                    required
                  />
                  <Button
                    type="submit"
                    className="w-fit rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
                  >
                    <Plus className="size-4" />
                    Post to group
                  </Button>
                </form>
              </section>
            ) : null}

            <section className="grid gap-3">
              {data.posts.length === 0 ? (
                <p className="rounded-xl border border-dashed bg-white p-5 text-sm text-muted-foreground">
                  No group posts yet.
                </p>
              ) : (
                data.posts.map((post) => (
                  <article key={post.id} className="premium-card p-4">
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
                  </article>
                ))
              )}
            </section>

            <section id="records" className="premium-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Group records</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Friend and group scopes keep course champions separate from public boards.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/course-records" prefetch={false}>
                    <Award className="size-4" />
                    Open records
                  </Link>
                </Button>
              </div>
            </section>

            <section id="tournaments" className="premium-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Group tournaments</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Run society opens, order-of-merit seasons and major-style events with proof.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/tournaments" prefetch={false}>
                    <Trophy className="size-4" />
                    Open events
                  </Link>
                </Button>
              </div>
            </section>

            <section id="members" className="premium-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold">Members</p>
                <Badge variant="secondary">{data.members.length}</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {data.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 rounded-lg border bg-[#F5F6F4] px-3 py-2 text-sm"
                  >
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
                        className="truncate font-medium hover:underline"
                      >
                        {member.displayName}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        @{member.username} · {label(member.role)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="grid gap-4 lg:sticky lg:top-28">
            <section className="premium-card p-4">
              <p className="text-sm font-semibold">Group activity</p>
              <div className="mt-3 grid gap-2 text-sm">
                <SideMetric
                  icon={<Users className="size-4 text-emerald-600" />}
                  label="Members"
                  value={data.group.memberCount}
                />
                <SideMetric
                  icon={<MessageCircle className="size-4 text-sky-600" />}
                  label="Posts"
                  value={data.group.postCount}
                />
                <SideMetric
                  icon={<Trophy className="size-4 text-amber-600" />}
                  label="Challenges"
                  value={data.group.challengeCount}
                />
              </div>
              <div className="mt-3 grid gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/course-records" prefetch={false}>
                    <Award className="size-4" />
                    Records
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/tournaments" prefetch={false}>
                    <Trophy className="size-4" />
                    Tournaments
                  </Link>
                </Button>
              </div>
            </section>

            <section id="challenges" className="premium-card p-4">
              <p className="text-sm font-semibold">Linked challenges</p>
              <div className="mt-3 grid gap-2">
                {data.challenges.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                    No linked challenges yet.
                  </p>
                ) : (
                  data.challenges.map((challenge) => (
                    <Link
                      key={challenge.id}
                      href={`/challenges/${challenge.id}`}
                      prefetch={false}
                      className="rounded-lg border bg-[#F5F6F4] px-3 py-2 text-sm hover:bg-white"
                    >
                      <p className="font-medium">{challenge.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {challenge.templateName} · {challenge.status}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </section>

            {data.group.rules ? (
              <section className="premium-card p-4">
                <p className="text-sm font-semibold">Rules</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {data.group.rules}
                </p>
              </section>
            ) : null}

            {data.group.inviteCode ? (
              <section id="invite" className="premium-card p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Copy className="size-4 text-emerald-600" />
                  Invite
                </p>
                <div className="mt-3 rounded-xl border bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/groups/qr/${data.group.inviteCode}`}
                    alt={`QR invite for ${data.group.name}`}
                    className="mx-auto aspect-square w-full max-w-36"
                  />
                </div>
                <p className="mt-2 break-all rounded-lg bg-[#F5F6F4] px-3 py-2 font-mono text-xs">
                  {data.group.inviteCode}
                </p>
              </section>
            ) : null}

            <section id="settings" className="premium-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Settings className="size-4 text-slate-700" />
                Settings
              </p>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <p>
                  Groups are private by default. Admin controls can manage rules, invites and linked
                  challenges.
                </p>
                <Badge variant="outline" className="w-fit">
                  {data.group.ownerUserId ? "Admin controls ready" : "Member view"}
                </Badge>
              </div>
            </section>
          </section>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SideMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#F5F6F4] px-3 py-2">
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

function GroupOperationsBoard({ data }: { data: GroupDetailData }) {
  return (
    <section id="group-operations" className="grid scroll-mt-28 gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Group operations board</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Desktop roster, rivalry and linked challenge controls for running the group without
            scanning every card.
          </p>
        </div>
        <StatusPill tone={data.members.length > 0 ? "green" : "slate"}>
          {data.members.length} members
        </StatusPill>
      </div>

      <GroupMemberTable
        group={data.group}
        members={data.members}
        standings={data.rivalry.standings}
      />

      <GroupChallengeTable group={data.group} challenges={data.challenges} />
    </section>
  );
}

function GroupMemberTable({
  group,
  members,
  standings,
}: {
  group: GroupDetailData["group"];
  members: GroupMember[];
  standings: GroupStanding[];
}) {
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
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="member"
                className="sticky left-0 z-20 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                      className="sticky left-0 z-10 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                            className="font-semibold text-emerald-700 hover:underline"
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
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No active members are visible in this group yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function GroupChallengeTable({
  group,
  challenges,
}: {
  group: GroupDetailData["group"];
  challenges: GroupChallenge[];
}) {
  const suggestedViews = groupChallengeSuggestedViews(group.slug);

  return (
    <section className="grid gap-3" data-workbench-scope="group-challenges">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Linked challenge control</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Challenge boards connected to this group, ready for review or tournament conversion.
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
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="challenge"
                className="sticky left-0 z-20 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                    className="sticky left-0 z-10 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <Link
                      href={`/challenges/${challenge.id}`}
                      prefetch={false}
                      className="font-semibold text-emerald-700 hover:underline"
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
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No challenge boards are linked to this group yet.
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
    <section className="premium-card p-4">
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
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-[#F5F6F4] px-3 py-2"
            >
              <span className="grid size-8 place-items-center rounded-full bg-white text-sm font-semibold">
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
    </section>
  );
}

function WeeklyRivalryPanel({ rivalry }: { rivalry: RivalryData }) {
  return (
    <section className="premium-card p-4">
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
              className="rounded-lg border border-amber-100 bg-amber-50/70 p-3"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm">
                <p className="truncate font-semibold">{pairing.userALabel}</p>
                <span className="rounded-full bg-white px-2 py-1 text-xs text-muted-foreground">
                  vs
                </span>
                <p className="truncate text-right font-semibold">{pairing.userBLabel}</p>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <p className="text-2xl font-semibold tracking-normal">{pairing.userAScore}</p>
                <Trophy className="size-4 text-amber-700" />
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
    </section>
  );
}

function groupMemberSuggestedViews(slug: string): DesktopSavedViewSuggestion[] {
  return [
    {
      title: "Member roster",
      href: `/groups/${slug}#group-operations`,
      detail: "Roles, weekly points and scoring evidence for this group.",
    },
    {
      title: "Group leaderboard",
      href: `/groups/${slug}#leaderboard`,
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
      href: `/groups/${slug}#group-operations`,
      detail: "Challenge boards connected to this group.",
    },
    {
      title: "Challenge centre",
      href: "/challenges",
      detail: "Open active, invited and recommended challenge boards.",
    },
    {
      title: "Tournaments",
      href: "/tournaments",
      detail: "Convert suitable group events into tournament workflows.",
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

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
