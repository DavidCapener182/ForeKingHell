import Link from "next/link";
import { Globe2, Lock, Plus, Radio, Search, Trophy, Users } from "lucide-react";

import { createGroupAction, joinGroupAction, joinGroupByInviteCodeAction } from "@/app/groups/actions";
import { PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGroupsPageData, type GroupListItem } from "@/lib/groups";
import { socialVisibilityOptions } from "@/lib/social";

export const dynamic = "force-dynamic";

type GroupsPageProps = {
  searchParams?: Promise<{
    created?: string;
    joined?: string;
    invite?: string;
  }>;
};

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const data = await getGroupsPageData(params?.invite);

  return (
    <PageShell size="7xl">
      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <aside className="order-2 grid gap-4 lg:order-none lg:sticky lg:top-28">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
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

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Create group</p>
            <form action={createGroupAction} className="mt-3 grid gap-3">
              <label className="grid gap-1 text-sm font-medium">
                <span>Name</span>
                <Input name="name" placeholder="ForeKingHell Rapsodo UK League" className="h-9 rounded-xl bg-slate-50" required />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Type</span>
                <select name="groupType" className="h-9 rounded-xl border bg-slate-50 px-3 text-sm">
                  {data.groupTypes.map((type) => (
                    <option key={type} value={type}>{label(type)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Visibility</span>
                <select name="visibility" defaultValue="private" className="h-9 rounded-xl border bg-slate-50 px-3 text-sm">
                  {socialVisibilityOptions.map((option) => (
                    <option key={option} value={option}>{label(option)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Description</span>
                <textarea name="description" rows={3} className="rounded-xl border bg-slate-50 px-3 py-2 text-sm" />
              </label>
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                <Plus className="size-4" />
                Create group
              </Button>
            </form>
          </section>
        </aside>

        <main className="order-1 grid gap-4 lg:order-none">
          <header className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <StatusPill tone="green">Groups and leagues</StatusPill>
                <h1 className="mt-3 text-3xl font-semibold tracking-normal">Groups</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Build Rapsodo leagues, golf societies, coach stables and simulator venue communities with their own feed, challenges and leaderboards.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/challenges" prefetch={false}>
                  <Trophy className="size-4" />
                  Challenges
                </Link>
              </Button>
            </div>
            {params?.created || params?.joined ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Group network updated.
              </div>
            ) : null}
          </header>

          {params?.invite ? (
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              {data.invitePreview ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Invite to {data.invitePreview.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.invitePreview.description ?? `${data.invitePreview.memberCount} members · ${label(data.invitePreview.visibility)}`}
                    </p>
                  </div>
                  {data.invitePreview.viewerRole ? (
                    <Button asChild variant="outline">
                      <Link href={`/groups/${data.invitePreview.slug}`} prefetch={false}>Open group</Link>
                    </Button>
                  ) : (
                    <form action={joinGroupByInviteCodeAction}>
                      <input type="hidden" name="inviteCode" value={data.invitePreview.inviteCode} />
                      <Button type="submit">Join from invite</Button>
                    </form>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">That group invite is not valid or has expired.</p>
              )}
            </section>
          ) : null}

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">My groups</p>
                <p className="text-sm text-muted-foreground">Private and joined groups stay scoped to members.</p>
              </div>
              <Badge variant="secondary">{data.mine.length} joined</Badge>
            </div>
            <GroupGrid groups={data.mine} empty="You have not joined a group yet." />
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Discoverable leagues</p>
                <p className="text-sm text-muted-foreground">Public opt-in groups for monthly boards and community challenges.</p>
              </div>
              <Search className="size-5 text-sky-600" />
            </div>
            <GroupGrid groups={data.discoverable} empty="No public groups yet. Create the first Rapsodo league." />
          </section>
        </main>
      </section>
    </PageShell>
  );
}

function GroupGrid({ groups, empty }: { groups: GroupListItem[]; empty: string }) {
  if (groups.length === 0) {
    return <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {groups.map((group) => (
        <article key={group.id} className="rounded-xl border bg-slate-50/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/groups/${group.slug}`} prefetch={false} className="font-semibold hover:underline">
                {group.name}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{group.description ?? "No group description yet."}</p>
            </div>
            <Badge variant="outline" className="gap-1">
              {group.visibility === "public" ? <Globe2 className="size-3" /> : <Lock className="size-3" />}
              {label(group.visibility)}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
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
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/groups/${group.slug}`} prefetch={false}>Open</Link>
            </Button>
            {!group.viewerRole && group.visibility === "public" ? (
              <form action={joinGroupAction}>
                <input type="hidden" name="groupId" value={group.id} />
                <Button type="submit" size="sm">Join</Button>
              </form>
            ) : group.viewerRole ? (
              <Badge variant="secondary">{label(group.viewerRole)}</Badge>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-slate-50 px-3 py-2">
      <p className="text-lg font-semibold tracking-normal">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
