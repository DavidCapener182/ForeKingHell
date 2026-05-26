import Link from "next/link";
import {
  Award,
  Globe2,
  Lock,
  MessageCircle,
  Plus,
  Radio,
  Search,
  Settings,
  Trophy,
  Users,
} from "lucide-react";

import {
  createGroupAction,
  joinGroupAction,
  joinGroupByInviteCodeAction,
} from "@/app/groups/actions";
import { GroupDigestFeaturePanel } from "@/components/features/feature-panels";
import {
  BottomSheet,
  ChallengeCard,
  MobileAppShell,
  MobileIconButton,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import { PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGroupsPageData, type GroupListItem } from "@/lib/groups";
import { getChallengesPageData } from "@/lib/challenges";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { socialVisibilityOptions } from "@/lib/social";

export const dynamic = "force-dynamic";

type GroupsPageProps = {
  searchParams?: Promise<{
    created?: string;
    joined?: string;
    invite?: string;
    tab?: string;
  }>;
};

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const [data, challengeData, featureData] = await Promise.all([
    getGroupsPageData(params?.invite),
    getChallengesPageData(),
    getFeatureIdeasData(),
  ]);
  const activeTab = parseGroupsTab(params?.tab);
  const featuredChallenge = challengeData.active[0] ?? challengeData.challenges[0] ?? null;

  return (
    <PageShell size="7xl">
      <MobileAppShell>
        <MobileTopBar
          title="Groups"
          leading={<MobileIconButton href="/groups" label="Search groups" icon={Search} />}
          actions={
            <>
              <MobileIconButton href="/friends" label="Messages" icon={MessageCircle} />
              <MobileIconButton href="/settings" label="Settings" icon={Settings} />
            </>
          }
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
          label="Competition network"
          value={`${data.mine.length} active groups`}
          detail={`${challengeData.active.length} live challenges · ${data.discoverable.length} discoverable clubs`}
          action={
            <BottomSheet
              label={
                <>
                  <Plus className="size-4" /> Create
                </>
              }
              title="Create group"
            >
              <form action={createGroupAction} className="grid gap-3">
                <label className="grid gap-1 text-sm font-medium">
                  <span>Name</span>
                  <Input
                    name="name"
                    placeholder="LM World Tour Launch Monitor League"
                    className="h-11 rounded-lg bg-white"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <span>Type</span>
                  <select name="groupType" className="h-11 rounded-lg border bg-white px-3 text-sm">
                    {data.groupTypes.map((type) => (
                      <option key={type} value={type}>
                        {label(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <span>Visibility</span>
                  <select
                    name="visibility"
                    defaultValue="private"
                    className="h-11 rounded-lg border bg-white px-3 text-sm"
                  >
                    {socialVisibilityOptions.map((option) => (
                      <option key={option} value={option}>
                        {label(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Description"
                  className="rounded-lg border bg-white px-3 py-2 text-sm"
                />
                <Button type="submit" className="rounded-full bg-[#0B7A3B] text-white">
                  <Plus className="size-4" />
                  Create group
                </Button>
              </form>
            </BottomSheet>
          }
        />
        {activeTab === "challenges" ? (
          <NativeListSection title="Challenges">
            {featuredChallenge ? (
              <ChallengeCard
                title={featuredChallenge.title}
                description={featuredChallenge.description ?? featuredChallenge.templateName}
                href={`/challenges/${featuredChallenge.id}`}
                cta={featuredChallenge.viewerJoined ? "Open" : "Join"}
                leader={
                  featuredChallenge.leader
                    ? `Leader: ${featuredChallenge.leader.displayName} · ${featuredChallenge.leader.scoreLabel}`
                    : "No attempts yet"
                }
                meta={
                  <>
                    <span>{featuredChallenge.participantCount} players</span>
                    <span>{featuredChallenge.viewerJoined ? "Joined" : "Not entered"}</span>
                  </>
                }
              />
            ) : null}
            {challengeData.challenges.slice(1, 8).map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                title={challenge.title}
                description={challenge.templateName}
                href={`/challenges/${challenge.id}`}
                cta={challenge.viewerJoined ? "Open" : "Join"}
                leader={challenge.leader ? `Leader: ${challenge.leader.displayName}` : undefined}
                meta={<span>{challenge.participantCount} players</span>}
              />
            ))}
          </NativeListSection>
        ) : activeTab === "clubs" ? (
          <NativeListSection title="Clubs and societies">
            {[...data.mine, ...data.discoverable].slice(0, 12).map((group) => (
              <MobileGroupCard key={group.id} group={group} />
            ))}
          </NativeListSection>
        ) : (
          <NativeListSection title="Active now">
            {data.mine.slice(0, 8).map((group) => (
              <MobileGroupCard key={group.id} group={group} />
            ))}
            {data.mine.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#E5E7EB] p-4 text-sm text-[#6B7280]">
                Join a public league or create a private friend group.
              </p>
            ) : null}
            {challengeData.active.slice(0, 3).map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                title={challenge.title}
                description="Live group challenge"
                href={`/challenges/${challenge.id}`}
                meta={<span>{challenge.participantCount} players</span>}
              />
            ))}
          </NativeListSection>
        )}
        <GroupDigestFeaturePanel data={featureData} />
      </MobileAppShell>

      <section className="hidden gap-4 sm:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <aside className="order-2 grid gap-4 lg:order-none lg:sticky lg:top-28">
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

          <section className="premium-card p-4">
            <p className="text-sm font-semibold">Create group</p>
            <form action={createGroupAction} className="mt-3 grid gap-3">
              <label className="grid gap-1 text-sm font-medium">
                <span>Name</span>
                <Input
                  name="name"
                  placeholder="LM World Tour Launch Monitor League"
                  className="h-9 rounded-lg bg-white"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Type</span>
                <select name="groupType" className="h-9 rounded-lg border bg-white px-3 text-sm">
                  {data.groupTypes.map((type) => (
                    <option key={type} value={type}>
                      {label(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Visibility</span>
                <select
                  name="visibility"
                  defaultValue="private"
                  className="h-9 rounded-lg border bg-white px-3 text-sm"
                >
                  {socialVisibilityOptions.map((option) => (
                    <option key={option} value={option}>
                      {label(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Description</span>
                <textarea
                  name="description"
                  rows={3}
                  className="rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </label>
              <Button
                type="submit"
                className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
              >
                <Plus className="size-4" />
                Create group
              </Button>
            </form>
          </section>
        </aside>

        <main className="order-1 grid gap-4 lg:order-none">
          <header className="premium-hero p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <StatusPill tone="green">Groups and leagues</StatusPill>
                <h1 className="mt-3 text-3xl font-semibold tracking-normal">Groups</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Build launch-monitor leagues, golf societies, coach stables and simulator venue
                  communities with their own feed, records, events and leaderboards.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/course-records" prefetch={false}>
                    <Award className="size-4" />
                    Records
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
            {params?.created || params?.joined ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Group network updated.
              </div>
            ) : null}
          </header>

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

          <section className="premium-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">My groups</p>
                <p className="text-sm text-muted-foreground">
                  Private and joined groups stay scoped to members.
                </p>
              </div>
              <Badge variant="secondary">{data.mine.length} joined</Badge>
            </div>
            <GroupGrid groups={data.mine} empty="You have not joined a group yet." />
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
            />
          </section>

          <GroupDigestFeaturePanel data={featureData} />
        </main>
      </section>
    </PageShell>
  );
}

function GroupGrid({ groups, empty }: { groups: GroupListItem[]; empty: string }) {
  if (groups.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {groups.map((group) => (
        <article key={group.id} className="rounded-lg border bg-[#F5F6F4] p-4">
          <div className="flex items-start justify-between gap-3">
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
            <Badge variant="outline" className="gap-1">
              {group.visibility === "public" ? (
                <Globe2 className="size-3" />
              ) : (
                <Lock className="size-3" />
              )}
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
            <Badge variant="outline" className="gap-1">
              <Award className="size-3" />
              Records
            </Badge>
            <Badge variant="outline">{label(group.groupType)}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/groups/${group.slug}`} prefetch={false}>
                Open
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/course-records" prefetch={false}>
                <Award className="size-4" />
                Records
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/tournaments" prefetch={false}>
                <Trophy className="size-4" />
                Events
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
          </div>
        </article>
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

function MobileGroupCard({ group }: { group: GroupListItem }) {
  return (
    <Link
      href={`/groups/${group.slug}`}
      prefetch={false}
      className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-normal">{group.name}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#6B7280]">
            {group.description ?? label(group.groupType)}
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          {group.visibility === "public" ? (
            <Globe2 className="size-3" />
          ) : (
            <Lock className="size-3" />
          )}
          {label(group.visibility)}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-medium text-[#6B7280]">
        <span>{group.memberCount} members</span>
        <span>{group.challengeCount} live events</span>
        <span>{group.postCount} posts</span>
      </div>
      <span className="text-sm font-semibold text-[#0B7A3B]">Open</span>
    </Link>
  );
}

function parseGroupsTab(value?: string) {
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
