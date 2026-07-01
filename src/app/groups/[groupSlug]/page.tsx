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
import { PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  { label: "Records", href: "#records" },
  { label: "Tournaments", href: "#tournaments" },
  { label: "Challenges", href: "#challenges" },
  { label: "Members", href: "#members" },
  { label: "Invite", href: "#invite" },
  { label: "Settings", href: "#settings" },
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

          {data.canPost ? (
            <section id="feed" className="premium-card p-4">
              <form action={createGroupPostAction} className="grid gap-3">
                <input type="hidden" name="groupId" value={data.group.id} />
                <input type="hidden" name="slug" value={data.group.slug} />
                <Input name="title" placeholder="Post title" className="h-9 rounded-lg bg-white" />
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

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
