import Link from "next/link";
import type { ReactNode } from "react";
import { Globe2, Lock, MessageCircle, Plus, Trophy, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { createGroupPostAction } from "@/app/groups/actions";
import { PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGroupDetailData } from "@/lib/groups";

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

export default async function GroupDetailPage({ params, searchParams }: GroupDetailPageProps) {
  const { groupSlug } = await params;
  const flags = await searchParams;
  const data = await getGroupDetailData(groupSlug);

  if (!data) {
    notFound();
  }

  return (
    <PageShell size="7xl">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <main className="grid gap-4">
          <header className="overflow-hidden rounded-xl border bg-white shadow-sm">
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
                    {data.group.visibility === "public" ? <Globe2 className="size-3" /> : <Lock className="size-3" />}
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
                </div>
              </div>
              <Button asChild variant="outline">
                <Link href="/groups" prefetch={false}>All groups</Link>
              </Button>
            </div>
            {flags?.created || flags?.posted ? (
              <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Group updated.
              </div>
            ) : null}
          </header>

          {data.canPost ? (
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <form action={createGroupPostAction} className="grid gap-3">
                <input type="hidden" name="groupId" value={data.group.id} />
                <input type="hidden" name="slug" value={data.group.slug} />
                <Input name="title" placeholder="Post title" className="h-9 rounded-xl bg-slate-50" />
                <textarea
                  name="body"
                  rows={3}
                  placeholder="Share a league update, challenge note or session recap"
                  className="rounded-xl border bg-slate-50 px-3 py-2 text-sm"
                  required
                />
                <Button type="submit" className="w-fit rounded-xl bg-[#111827] text-white">
                  <Plus className="size-4" />
                  Post to group
                </Button>
              </form>
            </section>
          ) : null}

          <section className="grid gap-3">
            {data.posts.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-white p-5 text-sm text-muted-foreground">No group posts yet.</p>
            ) : (
              data.posts.map((post) => (
                <article key={post.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
                    <SocialAvatar
                      displayName={post.profile.displayName}
                      username={post.profile.username}
                      avatarUrl={post.profile.avatarUrl}
                      href={`/profile/${post.profile.username}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{post.profile.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{post.profile.username} · {dateFormatter.format(post.createdAt)}</p>
                    </div>
                    {post.pinned ? <Badge variant="secondary">Pinned</Badge> : null}
                  </header>
                  {post.title ? <h2 className="mt-4 text-lg font-semibold tracking-normal">{post.title}</h2> : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{post.body}</p>
                </article>
              ))
            )}
          </section>
        </main>

        <aside className="grid gap-4 lg:sticky lg:top-28">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Group activity</p>
            <div className="mt-3 grid gap-2 text-sm">
              <SideMetric icon={<Users className="size-4 text-emerald-600" />} label="Members" value={data.group.memberCount} />
              <SideMetric icon={<MessageCircle className="size-4 text-sky-600" />} label="Posts" value={data.group.postCount} />
              <SideMetric icon={<Trophy className="size-4 text-amber-600" />} label="Challenges" value={data.group.challengeCount} />
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Linked challenges</p>
            <div className="mt-3 grid gap-2">
              {data.challenges.length === 0 ? (
                <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No linked challenges yet.</p>
              ) : (
                data.challenges.map((challenge) => (
                  <Link
                    key={challenge.id}
                    href={`/challenges/${challenge.id}`}
                    prefetch={false}
                    className="rounded-xl border bg-slate-50 px-3 py-2 text-sm hover:bg-white"
                  >
                    <p className="font-medium">{challenge.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{challenge.templateName} · {challenge.status}</p>
                  </Link>
                ))
              )}
            </div>
          </section>

          {data.group.rules ? (
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold">Rules</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{data.group.rules}</p>
            </section>
          ) : null}

          {data.group.inviteCode ? (
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold">Invite code</p>
              <p className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs">{data.group.inviteCode}</p>
            </section>
          ) : null}
        </aside>
      </section>
    </PageShell>
  );
}

function SideMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="font-semibold tracking-normal">{value}</span>
    </div>
  );
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
