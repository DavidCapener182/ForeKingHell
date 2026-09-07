import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarDays, Copy, MessageCircle, Pin, Trophy, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { GroupPostForm } from "@/app/groups/group-post-form";
import { GroupMemberList } from "@/app/groups/group-member-list";
import { GroupDangerActions } from "@/app/groups/group-danger-actions";
import { GroupMembersDialog } from "@/app/groups/group-members-dialog";
import { GroupSectionTabs, type GroupSection } from "@/app/groups/group-section-tabs";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { PageShell, PageHeader, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getGroupDetailData, type GroupDetailData } from "@/lib/groups";

export const dynamic = "force-dynamic";

type GroupDetailPageProps = {
  params: Promise<{ groupSlug: string }>;
  searchParams?: Promise<{
    created?: string;
    posted?: string;
    joined?: string;
    section?: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const eventDateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const weekDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export default async function GroupDetailPage({ params, searchParams }: GroupDetailPageProps) {
  const { groupSlug } = await params;
  const flags = await searchParams;
  const data = await getGroupDetailData(groupSlug);

  if (!data) notFound();

  const activeSection = parseGroupDetailSection(flags?.section);

  return (
    <PageShell>
      <div className="grid min-w-0 gap-6 pb-28" data-group-clubhouse>
        <Link
          href="/groups"
          prefetch={false}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All groups
        </Link>

        <PageHeader
          eyebrow={`${label(data.group.groupType)} · ${label(data.group.visibility)}`}
          title={data.group.name}
          description={`${data.group.memberCount} members · ${data.group.postCount} updates`}
          actions={
            <GroupMembersDialog
              members={data.members.map((member) => ({
                ...member,
                ...memberPerformance(data, member.userId),
              }))}
            />
          }
        />
        <GroupSectionTabs
          key={data.group.id}
          activeSection={activeSection}
          items={[
            { id: "overview", label: "Overview", content: <GroupOverview data={data} /> },
            { id: "activity", label: "Activity", content: <GroupActivity data={data} /> },
            { id: "members", label: "Members", content: <GroupMembers data={data} /> },
          ]}
        />

        <GroupClubhouseFooter data={data} />
      </div>
    </PageShell>
  );
}

function GroupOverview({ data }: { data: GroupDetailData }) {
  const first = data.rivalry.standings[0];
  const leader =
    first &&
    first.points > 0 &&
    !data.rivalry.standings.some((standing, index) => index > 0 && standing.points === first.points)
      ? first
      : null;

  return (
    <section
      id="overview"
      className="grid scroll-mt-28 gap-4 lg:grid-cols-2"
      aria-label="Group overview"
    >
      <Card className="p-5 sm:p-6">
        <SectionEyebrow icon={<Users className="size-4" />} label="The crew" />
        <h2 className="text-xl font-semibold tracking-normal">About this group</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {data.group.description ?? "This group has not added a description yet."}
        </p>
        {data.group.rules ? (
          <div className="mt-5 border-l-2 border-primary/25 pl-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Club rules
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
              {data.group.rules}
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionEyebrow icon={<Trophy className="size-4" />} label="Playing for" />
        <h2 className="text-xl font-semibold tracking-normal">Current challenge</h2>
        {data.group.currentChallenge ? (
          <div className="mt-4">
            <p className="text-2xl font-semibold tracking-normal">
              {data.group.currentChallenge.title}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {challengeWindow(data.group.currentChallenge)} ·{" "}
              {label(data.group.currentChallenge.status)}
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href={`/challenges/${data.group.currentChallenge.id}`} prefetch={false}>
                See the challenge
                <Trophy className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            There is no live challenge for this group yet.
          </p>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionEyebrow icon={<Trophy className="size-4" />} label="Recent group performance" />
            <h2 className="text-xl font-semibold tracking-normal">This week in the clubhouse</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {weekDateFormatter.format(data.rivalry.startsAt)}–
              {weekDateFormatter.format(data.rivalry.endsAt)}
            </p>
          </div>
          {leader ? <StatusPill tone="green">{leader.displayName} leads</StatusPill> : null}
        </div>
        <div className="mt-5 grid gap-2">
          {data.rivalry.standings.length > 0 ? (
            data.rivalry.standings.map((standing, index) => (
              <div
                key={standing.userId}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-2.5 last:border-b-0"
              >
                <span className="grid size-8 place-items-center rounded-full bg-muted font-semibold">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="break-words font-medium">{standing.displayName}</p>
                  <p className="break-words text-xs text-muted-foreground">{standing.summary}</p>
                </div>
                <p className="font-score text-lg font-semibold tabular-nums">
                  {standing.points} pts
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              No qualifying group rounds have landed this week.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionEyebrow icon={<CalendarDays className="size-4" />} label="Next tee time" />
        <h2 className="text-xl font-semibold tracking-normal">Next event</h2>
        {data.nextEvent ? (
          <div className="mt-4">
            <p className="text-2xl font-semibold tracking-normal">{data.nextEvent.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {eventDateFormatter.format(data.nextEvent.startsAt)}
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href={`/tournaments/${data.nextEvent.id}`} prefetch={false}>
                Event details
                <CalendarDays className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm leading-6 text-muted-foreground">
              Nothing is in the group calendar yet.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/tournaments" prefetch={false}>
                Browse events
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}

function GroupActivity({ data }: { data: GroupDetailData }) {
  return (
    <section
      id="activity"
      className="grid scroll-mt-28 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
    >
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Loaded group posts, newest first. Up to 40 posts are available; pinned posts are retained
          in this selection.
        </p>
        {data.posts.length > 0 ? (
          [...data.posts]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((post) => (
              <Card key={post.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <SocialAvatar
                    displayName={post.profile.displayName}
                    username={post.profile.username}
                    avatarUrl={post.profile.avatarUrl}
                    href={`/profile/${post.profile.username}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/profile/${post.profile.username}`}
                          prefetch={false}
                          className="font-semibold hover:underline"
                        >
                          {post.profile.displayName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          <time dateTime={post.createdAt.toISOString()}>
                            {dateTimeFormatter.format(post.createdAt)}
                          </time>
                        </p>
                      </div>
                      {post.pinned ? (
                        <Badge variant="secondary" className="gap-1">
                          <Pin className="size-3" /> Pinned
                        </Badge>
                      ) : null}
                    </div>
                    {post.title ? (
                      <h2 className="mt-4 text-lg font-semibold">{post.title}</h2>
                    ) : null}
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {post.body}
                    </p>
                  </div>
                </div>
              </Card>
            ))
        ) : (
          <Card className="p-5">
            <AppEmptyState
              icon={<MessageCircle className="size-5" />}
              title="No group updates yet"
              description="The first clubhouse update will appear here for members."
              primaryAction={null}
            />
          </Card>
        )}
      </div>

      {data.canPost ? (
        <Card className="p-4 sm:sticky sm:top-28">
          <GroupPostForm
            groupId={data.group.id}
            groupName={data.group.name}
            visibility={label(data.group.visibility)}
          />
        </Card>
      ) : null}
    </section>
  );
}

function memberPerformance(data: GroupDetailData, userId: string) {
  const standing = data.rivalry.standings.find((item) => item.userId === userId);
  return { points: standing?.points, summary: standing?.summary };
}
function GroupMembers({ data }: { data: GroupDetailData }) {
  return (
    <section aria-label="Group member roster">
      <GroupMemberList
        members={data.members.map((member) => ({
          ...member,
          ...memberPerformance(data, member.userId),
        }))}
      />
    </section>
  );
}

function GroupClubhouseFooter({ data }: { data: GroupDetailData }) {
  return (
    <section
      className="grid gap-4 border-t pt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
      aria-label="Group membership controls"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {data.canAdmin && data.group.inviteCode ? (
          <Card className="p-4">
            <p className="flex items-center gap-2 font-semibold">
              <Copy className="size-4 text-primary" /> Invite the crew
            </p>
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/groups/qr/${data.group.inviteCode}`}
                alt={`QR invite for ${data.group.name}`}
                className="size-20 rounded-lg border bg-background p-1"
              />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Scan to join</p>
                <p className="mt-1 break-all font-mono text-xs">{data.group.inviteCode}</p>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
      <div className="lg:pt-1">
        <GroupDangerActions
          groupId={data.group.id}
          groupName={data.group.name}
          isOwner={data.isOwner}
          isMember={Boolean(data.group.viewerRole)}
        />
      </div>
    </section>
  );
}

function SectionEyebrow({ icon, label: sectionLabel }: { icon: ReactNode; label: string }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
      {icon}
      {sectionLabel}
    </p>
  );
}

function challengeWindow(challenge: NonNullable<GroupDetailData["group"]["currentChallenge"]>) {
  const start = weekDateFormatter.format(challenge.startsAt);
  const end = challenge.endsAt ? weekDateFormatter.format(challenge.endsAt) : null;
  return end ? `${start}–${end}` : `From ${start}`;
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
