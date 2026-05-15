import Link from "next/link";
import { ArrowLeft, CalendarDays, Plus, Sparkles, Trophy, Users } from "lucide-react";

import { createChallengeAction, joinChallengeAction } from "@/app/challenges/actions";
import {
  BottomSheet,
  ChallengeCard,
  EventHeroCard,
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import {
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { getBillingPageData } from "@/lib/billing";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import { socialVisibilityOptions } from "@/lib/social";

export const dynamic = "force-dynamic";

type ChallengesPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function ChallengesPage({ searchParams }: ChallengesPageProps) {
  const params = await searchParams;
  const [data, billing] = await Promise.all([getChallengesPageData(), getBillingPageData()]);
  const activeTab = parseChallengeHubTab(params?.tab);
  const featured = data.active[0] ?? data.challenges[0] ?? null;
  const friendsCompeting = data.challenges.filter((challenge) => !challenge.viewerJoined && challenge.participantCount > 0).slice(0, 4);
  const activePlanName = billing.plans.find((plan) => plan.key === billing.activePlanKey)?.name ?? titleCase(billing.activePlanKey);
  const privateChallengeLimit = billing.planLimits.find(
    (limit) => limit.planKey === billing.activePlanKey && limit.limitKey === "max_private_challenges",
  );
  const privateChallengeLimitText = privateChallengeLimit ? limitValue(privateChallengeLimit.limitValueJson) : "Public boards only";
  const showPrivateChallengeUpgrade = billing.activePlanKey === "free";

  return (
    <PageShell size="7xl">
      <MobileAppShell>
        <MobileTopBar title="Challenges" />
        <MobileRouteTabs group="social" activeKey="challenges" />
        <MobileTabBar
          activeKey={activeTab}
          className="-mt-4"
          tabs={[
            { key: "live", label: "Live", href: "/challenges" },
            { key: "joined", label: "Joined", href: "/challenges?tab=joined" },
            { key: "templates", label: "Templates", href: "/challenges?tab=templates" },
            { key: "past", label: "Past", href: "/challenges?tab=past" },
          ]}
        />
        <MobileStatusAction
          label="Live challenge boards"
          value={`${data.active.length} active`}
          detail={`${data.mine.length} joined · ${data.templates.length} templates`}
          action={
            <BottomSheet label={<><Plus className="size-4" /> Create</>} title="Create challenge">
              {showPrivateChallengeUpgrade ? (
                <div className="grid gap-3 text-sm text-[#6B7280]">
                  <p>Free players can join public boards. Plus unlocks private friend challenges.</p>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/billing" prefetch={false}>View plans</Link>
                  </Button>
                </div>
              ) : (
                <form action={createChallengeAction} className="grid gap-3">
                  <label className="grid gap-1 text-sm font-medium">
                    Template
                    <select name="templateId" className="h-11 rounded-lg border bg-white px-3 text-sm">
                      {data.templates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                  </label>
                  <Input name="title" placeholder="May Wedge Window" className="h-11 rounded-lg bg-white" required />
                  <textarea name="description" rows={3} placeholder="Description" className="rounded-lg border bg-white px-3 py-2 text-sm" />
                  <select name="visibility" defaultValue="friends" className="h-11 rounded-lg border bg-white px-3 text-sm">
                    {socialVisibilityOptions.map((option) => (
                      <option key={option} value={option}>{titleCase(option)}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="startsAt" type="date" className="h-11 rounded-lg bg-white" />
                    <Input name="endsAt" type="date" className="h-11 rounded-lg bg-white" />
                  </div>
                  <Button type="submit" className="rounded-full bg-[#0B7A3B] text-white">
                    <Plus className="size-4" />
                    Create
                  </Button>
                </form>
              )}
            </BottomSheet>
          }
        />
        {activeTab === "templates" ? (
          <NativeListSection title="Templates">
            {data.templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                <p className="font-semibold">{template.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-[#6B7280]">{template.description}</p>
              </div>
            ))}
          </NativeListSection>
        ) : (
          <>
            {featured ? (
              <EventHeroCard
                eyebrow="Featured challenge"
                title={featured.title}
                description={featured.description ?? `${featured.templateName} · ${featured.participantCount} players`}
                href={`/challenges/${featured.id}`}
                actionLabel="Open"
                media={<PageArtwork variant="range" alt="" className="block h-full min-h-0 rounded-none" sizes="100vw" />}
                meta={
                  <span>
                    {featured.endsAt ? `${formatDate(featured.endsAt)} · ` : ""}
                    {featured.leader ? `Leader: ${featured.leader.displayName}` : "Awaiting qualifying imports"}
                  </span>
                }
                joined={featured.viewerJoined ? <Badge variant="secondary">Joined</Badge> : null}
              />
            ) : null}
            <NativeListSection title={activeTab === "joined" ? "Joined" : "Recommended"}>
              {(activeTab === "joined" ? data.mine : data.challenges).slice(0, 10).map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  title={challenge.title}
                  description={challenge.description ?? challenge.templateName}
                  href={`/challenges/${challenge.id}`}
                  cta="Open"
                  leader={challenge.leader ? `Leader: ${challenge.leader.displayName} · ${challenge.leader.scoreLabel}` : undefined}
                  meta={
                    <>
                      <span>{challenge.participantCount} players</span>
                      <span>{titleCase(challenge.visibility)}</span>
                    </>
                  }
                />
              ))}
            </NativeListSection>
          </>
        )}
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-3 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/leaderboard?tab=challenges" prefetch={false}>
            <Trophy className="size-4" />
            Challenge boards
          </Link>
        </Button>
      </div>

      <div className="hidden sm:contents">
      <PageHeader
        eyebrow={<StatusPill tone="amber">Challenges</StatusPill>}
        title="Competition hub"
        description="Join monthly boards, follow friends competing, and create private launch-monitor challenges without exposing account access."
        metrics={[
          { label: "Active", value: data.active.length, detail: "Visible open challenges" },
          { label: "Joined", value: data.mine.length, detail: "Your active entries" },
          { label: "Templates", value: data.templates.length, detail: "Launch-monitor friendly formats" },
          { label: "Privacy", value: "Friends", detail: "Private challenges stay scoped" },
        ]}
      />

      {featured ? (
        <section className="premium-card overflow-hidden">
          <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <StatusPill tone="green">Featured monthly challenge</StatusPill>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal">{featured.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {featured.description ?? `${featured.templateName} board with ${featured.participantCount} players entered.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary">{featured.templateName}</Badge>
                <Badge variant="outline">{featured.viewerJoined ? "Entered" : "Not entered"}</Badge>
                <Badge variant="outline">{featured.participantCount} friends and players</Badge>
                {featured.viewerRank ? <Badge variant="secondary">Your rank #{featured.viewerRank}</Badge> : null}
              </div>
            </div>
            <div className="grid gap-3 rounded-lg border bg-[#F5F6F4] p-4">
              {featured.leader ? (
                <div>
                  <p className="text-sm text-muted-foreground">Current leader</p>
                  <p className="mt-1 text-xl font-semibold tracking-normal">{featured.leader.displayName}</p>
                  <p className="text-sm text-muted-foreground">{featured.leader.scoreLabel} · {featured.leader.verificationLabel}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Awaiting qualifying imports. New imported shots update the board automatically.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/challenges/${featured.id}`} prefetch={false}>
                    <Trophy className="size-4" />
                    Open event
                  </Link>
                </Button>
                {!featured.viewerJoined ? (
                  <form action={joinChallengeAction}>
                    <input type="hidden" name="challengeId" value={featured.id} />
                    <Button type="submit" variant="outline">Join challenge</Button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.58fr)_minmax(320px,0.42fr)]">
        <DataPanel>
          <SectionHeader
            title="My active entries"
            description="Challenges you have joined or created."
            action={<Trophy className="size-5 text-amber-600" />}
          />
          <CardContent>
            <ChallengeGrid challenges={data.mine} empty="Join a public board or create a private friend challenge." />
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title="Friends competing"
            description="Boards with activity from visible players."
            action={<Users className="size-5 text-sky-600" />}
          />
          <CardContent>
            <ChallengeGrid challenges={friendsCompeting} empty="No friends are competing on visible boards yet." />
          </CardContent>
        </DataPanel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <DataPanel>
          <SectionHeader
            title="Public and friend boards"
            description="Import-scored boards you can open or join."
            action={<Trophy className="size-5 text-amber-600" />}
          />
          <CardContent>
            <ChallengeGrid challenges={data.challenges} empty="No challenges are visible yet." />
          </CardContent>
        </DataPanel>

        <div className="grid gap-4">
          <DataPanel>
            <SectionHeader title="Templates" description="Rapsodo-friendly formats for private leagues and public boards." />
            <CardContent className="grid gap-2">
              {data.templates.map((template) => (
                <div key={template.id} className="rounded-lg border bg-[#F5F6F4] px-3 py-2 text-sm">
                  <p className="font-medium">{template.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
                </div>
              ))}
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Create private challenge"
              description="Start with a template, then invite friends from the event page."
              action={<Plus className="size-5 text-emerald-600" />}
            />
            <CardContent>
              <div className="mb-3 rounded-lg border bg-[#F5F6F4] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">Private challenge entitlement</p>
                    <p className="mt-1 text-muted-foreground">
                      Current plan: {activePlanName}. Limit: {privateChallengeLimitText}.
                    </p>
                  </div>
                  {showPrivateChallengeUpgrade ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/billing" prefetch={false}>
                        <Sparkles className="size-4" />
                        Upgrade
                      </Link>
                    </Button>
                  ) : (
                    <Badge variant="secondary">Private leagues enabled</Badge>
                  )}
                </div>
              </div>
              {showPrivateChallengeUpgrade ? (
                <div className="rounded-xl border border-dashed bg-white p-4 text-sm">
                  <p className="font-semibold">Upgrade to create friend and private leagues.</p>
                  <p className="mt-1 text-muted-foreground">
                    Free players can join public boards and social challenges. Plus unlocks private friend challenges.
                  </p>
                  <Button asChild className="mt-3" variant="outline">
                    <Link href="/billing" prefetch={false}>
                      <Sparkles className="size-4" />
                      View plans
                    </Link>
                  </Button>
                </div>
              ) : (
                <details className="rounded-lg border bg-[#F5F6F4]">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    Create challenge
                  </summary>
                  <form action={createChallengeAction} className="grid gap-4 border-t bg-white p-4">
                    <label className="grid gap-2 text-sm font-medium">
                      <span>Template</span>
                      <select name="templateId" className="h-10 rounded-lg border bg-white px-3 text-sm">
                        {data.templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                      <span>Title</span>
                      <Input name="title" placeholder="May Wedge Control Challenge" className="h-10 rounded-xl bg-white" required />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                      <span>Description</span>
                      <textarea name="description" rows={3} className="rounded-lg border bg-white px-3 py-2 text-sm" />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                      <span>Visibility</span>
                      <select name="visibility" defaultValue="friends" className="h-10 rounded-lg border bg-white px-3 text-sm">
                        {socialVisibilityOptions.map((option) => (
                          <option key={option} value={option}>
                            {titleCase(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium">
                        <span>Starts</span>
                        <Input name="startsAt" type="date" className="h-10 rounded-xl bg-white" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        <span>Ends</span>
                        <Input name="endsAt" type="date" className="h-10 rounded-xl bg-white" />
                      </label>
                    </div>
                    <Button type="submit" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                      <Plus className="size-4" />
                      Create
                    </Button>
                  </form>
                </details>
              )}
            </CardContent>
          </DataPanel>
        </div>
      </section>
      </div>
    </PageShell>
  );
}

function ChallengeGrid({ challenges, empty = "No challenges are visible yet. Create the first private friend challenge." }: { challenges: ChallengeListItem[]; empty?: string }) {
  if (challenges.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {challenges.map((challenge) => (
        <Card key={challenge.id} className="premium-card" size="sm">
          <CardHeader>
            <CardTitle>{challenge.title}</CardTitle>
            <CardDescription>{challenge.templateName}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="line-clamp-2 text-sm text-muted-foreground">{challenge.description ?? "No description."}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="size-3" />
                {challenge.participantCount}
              </Badge>
              <Badge variant="outline">{titleCase(challenge.visibility)}</Badge>
              {challenge.endsAt ? (
                <Badge variant="outline" className="gap-1">
                  <CalendarDays className="size-3" />
                  {formatDate(challenge.endsAt)}
                </Badge>
              ) : null}
            </div>
            {challenge.leader ? (
              <div className="rounded-lg border bg-white p-3 text-sm">
                <p className="font-medium">Leader: {challenge.leader.displayName}</p>
                <p className="text-muted-foreground">{challenge.leader.scoreLabel} · {challenge.leader.verificationLabel}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/challenges/${challenge.id}`} prefetch={false}>Open</Link>
              </Button>
              {!challenge.viewerJoined ? (
                <form action={joinChallengeAction}>
                  <input type="hidden" name="challengeId" value={challenge.id} />
                  <Button type="submit" size="sm">
                    Join
                  </Button>
                </form>
              ) : (
                <Badge variant="secondary">Joined{challenge.viewerRank ? ` · #${challenge.viewerRank}` : ""}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(value);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseChallengeHubTab(value?: string) {
  if (value === "joined" || value === "templates" || value === "past") {
    return value;
  }

  return "live";
}

function limitValue(value: Record<string, unknown>) {
  if (typeof value.label === "string") {
    return value.label;
  }

  if (typeof value.value === "number") {
    return value.value >= 999999 ? "Unlimited" : new Intl.NumberFormat("en-GB").format(value.value);
  }

  if (typeof value.value === "boolean") {
    return value.value ? "Included" : "Not included";
  }

  return "Included";
}
