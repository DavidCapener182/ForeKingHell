import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Globe2,
  Lock,
  MessageCircle,
  Pin,
  Plus,
  Trophy,
  Users,
} from "lucide-react";
import { notFound } from "next/navigation";

import { createGroupPostAction } from "@/app/groups/actions";
import { GroupDangerActions } from "@/app/groups/group-danger-actions";
import { GroupMembersDialog } from "@/app/groups/group-members-dialog";
import { GroupSectionTabs, type GroupSection } from "@/app/groups/group-section-tabs";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Textarea } from "@/components/ui/textarea";
import { PageArtwork } from "@/components/visuals/page-artwork";
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
  hour: "2-digit",
  minute: "2-digit",
});

const eventDateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
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
  const sectionBaseHref = `/groups/${data.group.slug}`;

  return (
    <PageShell>
      <Link
        href="/groups"
        prefetch={false}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All groups
      </Link>

      <header className="premium-hero overflow-hidden" aria-labelledby="group-name">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <SocialAvatar
                displayName={data.group.name}
                avatarUrl={data.group.avatarUrl}
                size="lg"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="green">{label(data.group.groupType)}</StatusPill>
                  <Badge variant="outline" className="gap-1">
                    {data.group.visibility === "public" ? (
                      <Globe2 className="size-3" />
                    ) : (
                      <Lock className="size-3" />
                    )}
                    {label(data.group.visibility)}
                  </Badge>
                </div>
                <h1
                  id="group-name"
                  className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl"
                >
                  {data.group.name}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data.group.memberCount} members · {data.group.postCount} updates
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <GroupMembersDialog members={data.members} />
              {data.group.currentChallenge ? (
                <Button asChild>
                  <Link href={`/challenges/${data.group.currentChallenge.id}`} prefetch={false}>
                    <Trophy className="size-4" />
                    Open challenge
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          <PageArtwork
            variant="groups"
            alt=""
            className="hidden min-h-64 rounded-none border-0 ring-0 lg:block"
            sizes="380px"
            priority
          />
        </div>
      </header>

      {flags?.created || flags?.posted || flags?.joined ? (
        <Alert>
          <AlertDescription>
            {flags?.created
              ? "Your group is ready. Invite the crew when you’re set."
              : flags?.posted
                ? "Your update is live in the group feed."
                : "Welcome to the group."}
          </AlertDescription>
        </Alert>
      ) : null}

      <GroupSectionTabs activeSection={activeSection} baseHref={sectionBaseHref} />

      {activeSection === "overview" ? (
        <GroupOverview data={data} />
      ) : activeSection === "activity" ? (
        <GroupActivity data={data} />
      ) : (
        <GroupMembers data={data} />
      )}

      <GroupClubhouseFooter data={data} />
    </PageShell>
  );
}

function GroupOverview({ data }: { data: GroupDetailData }) {
  const leader = data.rivalry.standings[0] ?? null;

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
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{data.group.rules}</p>
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
            data.rivalry.standings.slice(0, 5).map((standing, index) => (
              <div
                key={standing.userId}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-2.5 last:border-b-0"
              >
                <span className="grid size-8 place-items-center rounded-full bg-muted font-semibold">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{standing.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{standing.summary}</p>
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
        {data.posts.length > 0 ? (
          data.posts.map((post) => (
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
                        {dateTimeFormatter.format(post.createdAt)}
                      </p>
                    </div>
                    {post.pinned ? (
                      <Badge variant="secondary" className="gap-1">
                        <Pin className="size-3" /> Pinned
                      </Badge>
                    ) : null}
                  </div>
                  {post.title ? <h2 className="mt-4 text-lg font-semibold">{post.title}</h2> : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
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
          <GroupPostForm data={data} />
        </Card>
      ) : null}
    </section>
  );
}

function GroupPostForm({ data }: { data: GroupDetailData }) {
  return (
    <form action={createGroupPostAction} className="grid gap-3">
      <div>
        <p className="font-semibold">Share with the group</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Post a result, tee time or crew update.
        </p>
      </div>
      <input type="hidden" name="groupId" value={data.group.id} />
      <input type="hidden" name="slug" value={data.group.slug} />
      <Input name="title" placeholder="Title (optional)" maxLength={180} />
      <Textarea name="body" rows={5} placeholder="What’s happening?" required maxLength={2000} />
      <Button type="submit">
        <Plus className="size-4" />
        Post update
      </Button>
    </form>
  );
}

function GroupMembers({ data }: { data: GroupDetailData }) {
  return (
    <section id="members" className="grid scroll-mt-28 gap-4" aria-labelledby="members-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">The crew</p>
          <h2 id="members-heading" className="mt-1 text-2xl font-semibold tracking-normal">
            {data.members.length} active {data.members.length === 1 ? "member" : "members"}
          </h2>
        </div>
        <GroupMembersDialog members={data.members} />
      </div>

      {data.members.length > 0 ? (
        <Card className="gap-0 p-0">
          {data.members.map((member) => {
            const standing = data.rivalry.standings.find((item) => item.userId === member.userId);
            return (
              <Item
                key={member.userId}
                className="rounded-none border-x-0 border-t-0 p-4 last:border-b-0 sm:px-5"
              >
                <ItemMedia>
                  <SocialAvatar
                    displayName={member.displayName}
                    username={member.username}
                    avatarUrl={member.avatarUrl}
                    href={`/profile/${member.username}`}
                  />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    <Link
                      href={`/profile/${member.username}`}
                      prefetch={false}
                      className="hover:underline"
                    >
                      {member.displayName}
                    </Link>
                  </ItemTitle>
                  <ItemDescription>@{member.username}</ItemDescription>
                </ItemContent>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">
                    {standing ? `${standing.points} pts this week` : "No round this week"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {standing?.summary ?? label(member.role)}
                  </p>
                </div>
                <Badge variant="secondary">{label(member.role)}</Badge>
              </Item>
            );
          })}
        </Card>
      ) : (
        <Card className="p-5">
          <AppEmptyState
            icon={<Users className="size-5" />}
            title="No active members yet"
            description="Invite the first golfer to start the crew."
            primaryAction={null}
          />
        </Card>
      )}
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
                <p className="mt-1 truncate font-mono text-xs">{data.group.inviteCode}</p>
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
