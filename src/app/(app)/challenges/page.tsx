import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Brain, CalendarDays, Plus, Sparkles, Trophy, Users, Zap } from "lucide-react";

import { createChallengeAction, joinChallengeAction } from "@/app/challenges/actions";
import { CompetitionFeaturePanel } from "@/components/features/feature-panels";
import {
  BottomSheet,
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import {
  DataPanel,
  DataTableFrame,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { DataFirstFlowPanel } from "@/components/product-polish";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { getBillingPageData } from "@/lib/billing";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import {
  buildCoachDrillChallenges,
  buildCoachSummary,
  type CoachDrillChallenge,
} from "@/lib/coach";
import { getCoachDrillAwardStatuses, type CoachDrillAwardStatus } from "@/lib/coach-drill-awards";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProgressData } from "@/lib/progress-data";
import { socialVisibilityOptions } from "@/lib/social";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ChallengeHubTab = "live" | "joined" | "seasons" | "templates" | "past";
type ChallengeTemplateItem = Awaited<ReturnType<typeof getChallengesPageData>>["templates"][number];
type ChallengeBoardRow =
  | { kind: "challenge"; id: string; challenge: ChallengeListItem }
  | { kind: "template"; id: string; template: ChallengeTemplateItem };

const challengeBoardColumns: DesktopWorkbenchColumn[] = [
  { id: "board", label: "Board", locked: true },
  { id: "status", label: "Status" },
  { id: "visibility", label: "Visibility" },
  { id: "template", label: "Template" },
  { id: "window", label: "Window" },
  { id: "players", label: "Players" },
  { id: "leader", label: "Leader" },
  { id: "proof", label: "Proof" },
  { id: "action", label: "Action", locked: true },
];

const challengeBoardSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Live boards",
    href: "/challenges",
    detail: "Open boards ready to join or review.",
  },
  {
    title: "Joined",
    href: "/challenges?tab=joined",
    detail: "Boards where your entry already counts.",
  },
  {
    title: "Season leagues",
    href: "/challenges?tab=seasons",
    detail: "Four-week or longer evidence windows with a persistent measured board.",
  },
  {
    title: "Templates",
    href: "/challenges?tab=templates",
    detail: "Launch-monitor friendly challenge formats.",
  },
  {
    title: "Past boards",
    href: "/challenges?tab=past",
    detail: "Closed or expired boards kept for review.",
  },
];

type ChallengesPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function ChallengesPage({ searchParams }: ChallengesPageProps) {
  const params = await searchParams;
  const userId = await requireCurrentUserId();
  const [data, billing, progressData, featureData] = await Promise.all([
    getChallengesPageData(),
    getBillingPageData(),
    getProgressData(userId),
    getFeatureIdeasData(),
  ]);
  const coach = buildCoachSummary(progressData.clubs);
  const drillChallenges = buildCoachDrillChallenges(coach);
  const drillStatuses = await getCoachDrillAwardStatuses(drillChallenges);
  const activeTab = parseChallengeHubTab(params?.tab);
  const featured = data.active[0] ?? data.challenges[0] ?? null;
  const challengeBoardRows = buildChallengeBoardRows({
    activeTab,
    challenges: data.challenges,
    mine: data.mine,
    templates: data.templates,
  });
  const friendsCompeting = data.challenges
    .filter((challenge) => !challenge.viewerJoined && challenge.participantCount > 0)
    .slice(0, 4);
  const activePlanName =
    billing.plans.find((plan) => plan.key === billing.activePlanKey)?.name ??
    titleCase(billing.activePlanKey);
  const privateChallengeLimit = billing.planLimits.find(
    (limit) =>
      limit.planKey === billing.activePlanKey && limit.limitKey === "max_private_challenges",
  );
  const privateChallengeLimitText = privateChallengeLimit
    ? limitValue(privateChallengeLimit.limitValueJson)
    : "Public boards only";
  const showPrivateChallengeUpgrade = billing.activePlanKey === "free";
  const dailyMicroChallengeSteps = [
    {
      title: "Wedge window",
      detail: "12 shots inside the launch and carry window.",
      href: "/coach#more-drills",
      status: "ready" as const,
    },
    {
      title: "Fairway finders",
      detail: "Ten tee shots with playable offline misses.",
      href: "/today?club=driver",
      status: "ready" as const,
    },
    {
      title: "7i consistency",
      detail: "Seven-iron carry and start-line repeatability.",
      href: "/bag",
      status: "ready" as const,
    },
    {
      title: "Closest to pin",
      detail: "Short target ladder for launch-monitor proof.",
      href: "/challenges?tab=templates",
      status: "optional" as const,
    },
    {
      title: "Review XP",
      detail: "Daily coach drills award XP when imports prove completion.",
      href: "/achievements",
      status: "optional" as const,
    },
  ];

  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar title="Challenges" />
        <MobileRouteTabs group="social" activeKey="challenges" />
        <MobileTabBar
          activeKey={activeTab}
          className="-mt-4"
          tabs={[
            { key: "live", label: "Live", href: "/challenges" },
            { key: "joined", label: "Joined", href: "/challenges?tab=joined" },
            { key: "seasons", label: "Seasons", href: "/challenges?tab=seasons" },
            { key: "templates", label: "Templates", href: "/challenges?tab=templates" },
            { key: "past", label: "Past", href: "/challenges?tab=past" },
          ]}
        />
        <MobileStatusAction
          label="Live challenge boards"
          value={`${data.active.length} active`}
          detail={`${data.mine.length} joined · ${data.templates.length} templates`}
          action={
            <BottomSheet
              label={
                <>
                  <Plus className="size-4" /> Create
                </>
              }
              title="Create challenge"
            >
              {showPrivateChallengeUpgrade ? (
                <div className="grid gap-3 text-sm text-[#6B7280]">
                  <p>
                    Free players can join public boards. Plus unlocks private friend challenges.
                  </p>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/billing" prefetch={false}>
                      View plans
                    </Link>
                  </Button>
                </div>
              ) : (
                <form action={createChallengeAction} className="grid gap-3">
                  <BuilderStep
                    number="1"
                    title="Choose the measured challenge"
                    detail="The template defines the scoring rule and proof requirement."
                  />
                  <label className="grid gap-1 text-sm font-medium">
                    Template
                    <select
                      name="templateId"
                      className="h-11 rounded-lg border bg-background px-3 text-sm"
                    >
                      {data.templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    name="title"
                    placeholder="May Wedge Window"
                    className="h-11 rounded-lg bg-background"
                    required
                  />
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Description"
                    className="rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                  <BuilderStep
                    number="2"
                    title="Choose who can enter"
                    detail="Visibility controls discovery; exact shot rows remain private."
                  />
                  <select
                    name="visibility"
                    defaultValue="friends"
                    className="h-11 rounded-lg border bg-background px-3 text-sm"
                  >
                    {socialVisibilityOptions.map((option) => (
                      <option key={option} value={option}>
                        {titleCase(option)}
                      </option>
                    ))}
                  </select>
                  <BuilderStep
                    number="3"
                    title="Set the evidence window"
                    detail="Only qualifying imported evidence inside these dates counts."
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      name="startsAt"
                      type="date"
                      className="h-11 rounded-lg bg-background"
                      aria-label="Challenge starts"
                    />
                    <Input
                      name="endsAt"
                      type="date"
                      className="h-11 rounded-lg bg-background"
                      aria-label="Challenge ends"
                    />
                  </div>
                  <ChallengeEligibilityPreview />
                  <Button type="submit" className="rounded-full">
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
            {featured ? <MobilePremiumChallengeCard challenge={featured} featured /> : null}
            <NativeListSection title={activeTab === "joined" ? "Joined" : "Recommended"}>
              {(activeTab === "joined" ? data.mine : data.challenges)
                .slice(0, 10)
                .map((challenge, index) => (
                  <MobilePremiumChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    eager={index === 0}
                  />
                ))}
            </NativeListSection>
          </>
        )}
        <MobileDailyCoachDrills challenges={drillChallenges} statuses={drillStatuses} />
        <CompetitionFeaturePanel data={featureData} />
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="challenges">
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
            visual={
              <PageArtwork variant="challenges" alt="" className="h-full min-h-36" priority />
            }
            metrics={[
              { label: "Active", value: data.active.length, detail: "Visible open challenges" },
              { label: "Joined", value: data.mine.length, detail: "Your active entries" },
              {
                label: "Templates",
                value: data.templates.length,
                detail: "Launch-monitor friendly formats",
              },
              { label: "Privacy", value: "Friends", detail: "Private challenges stay scoped" },
            ]}
          />

          {activeTab === "seasons" ? (
            <section className="grid gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <StatusPill tone="green">Seasonal leagues</StatusPill>
                <h2 className="mt-2 text-xl font-semibold">
                  Long-form boards, measured automatically
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  A season is any challenge running for at least four weeks. Imported qualifying
                  shots update the same proof-backed board; manual claims and out-of-window shots
                  stay excluded. Use friends visibility for a private league or public for an opt-in
                  community season.
                </p>
              </div>
              <Button asChild className="min-h-11 rounded-xl">
                <Link href="/challenges?tab=seasons#create-challenge" prefetch={false}>
                  <Plus className="size-4" />
                  Create season
                </Link>
              </Button>
            </section>
          ) : null}

          {featured ? (
            <section className="premium-card overflow-hidden">
              <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                <div>
                  <StatusPill tone="green">Featured monthly challenge</StatusPill>
                  <h2 className="mt-3 text-3xl font-semibold tracking-normal">{featured.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {featured.description ??
                      `${featured.templateName} board with ${featured.participantCount} players entered.`}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="secondary">{featured.templateName}</Badge>
                    <Badge variant="outline">
                      {featured.viewerJoined ? "Entered" : "Not entered"}
                    </Badge>
                    <Badge variant="outline">{featured.participantCount} friends and players</Badge>
                    {featured.viewerRank ? (
                      <Badge variant="secondary">Your rank #{featured.viewerRank}</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3 rounded-lg border bg-[#F5F6F4] p-4">
                  {featured.leader ? (
                    <div>
                      <p className="text-sm text-muted-foreground">Current leader</p>
                      <p className="mt-1 text-xl font-semibold tracking-normal">
                        {featured.leader.displayName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {featured.leader.scoreLabel} · {featured.leader.verificationLabel}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Awaiting qualifying imports. New imported shots update the board
                      automatically.
                    </p>
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
                        <Button type="submit" variant="outline">
                          Join challenge
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <DataFirstFlowPanel
            title="Daily micro challenges"
            description="Short Rapsodo-friendly drills for testers who want a clear session target before creating a private board."
            steps={dailyMicroChallengeSteps}
            actionHref="/coach#more-drills"
            actionLabel="Open drills"
          />

          <CompetitionFeaturePanel data={featureData} />

          <ChallengeBoardTable activeTab={activeTab} rows={challengeBoardRows} />

          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.58fr)_minmax(320px,0.42fr)]">
            <DataPanel>
              <SectionHeader
                title="My active entries"
                description="Challenges you have joined or created."
                action={<Trophy className="size-5 text-amber-600" />}
              />
              <CardContent>
                <ChallengeGrid
                  challenges={data.mine}
                  empty="Join a public board or create a private friend challenge."
                />
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Friends competing"
                description="Boards with activity from visible players."
                action={<Users className="size-5 text-sky-600" />}
              />
              <CardContent>
                <ChallengeGrid
                  challenges={friendsCompeting}
                  empty="No friends are competing on visible boards yet."
                />
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
                <ChallengeGrid
                  challenges={data.challenges}
                  empty="No challenges are visible yet."
                />
              </CardContent>
            </DataPanel>

            <div className="grid gap-4">
              <DataPanel>
                <SectionHeader
                  title="Templates"
                  description="Rapsodo-friendly formats for private leagues and public boards."
                />
                <CardContent className="grid gap-2">
                  {data.templates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-lg border bg-[#F5F6F4] px-3 py-2 text-sm"
                    >
                      <p className="font-medium">{template.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {template.description}
                      </p>
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
                  <div
                    id="create-challenge"
                    className="mb-3 scroll-mt-28 rounded-lg border bg-[#F5F6F4] p-3 text-sm"
                  >
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
                        Free players can join public boards and social challenges. Plus unlocks
                        private friend challenges.
                      </p>
                      <Button asChild className="mt-3" variant="outline">
                        <Link href="/billing" prefetch={false}>
                          <Sparkles className="size-4" />
                          View plans
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <Sheet>
                      <SheetTrigger
                        type="button"
                        className={cn(
                          buttonVariants(),
                          "w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]",
                        )}
                      >
                        <Plus className="size-4" />
                        Create challenge
                      </SheetTrigger>
                      <SheetContent className="overflow-y-auto sm:max-w-lg">
                        <SheetHeader>
                          <SheetTitle>Create challenge</SheetTitle>
                          <SheetDescription>
                            Start with a template, then invite friends from the event page.
                          </SheetDescription>
                        </SheetHeader>
                        <form action={createChallengeAction} className="grid gap-4 px-4 pb-4">
                          <BuilderStep
                            number="1"
                            title="Format"
                            detail="Choose the measured outcome and automatic scoring rule."
                          />
                          <label className="grid gap-2 text-sm font-medium">
                            <span>Template</span>
                            <select
                              name="templateId"
                              className="h-10 rounded-lg border bg-background px-3 text-sm"
                            >
                              {data.templates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-2 text-sm font-medium">
                            <span>Title</span>
                            <Input
                              name="title"
                              placeholder="May Wedge Control Challenge"
                              className="h-10 rounded-xl bg-background"
                              required
                            />
                          </label>
                          <label className="grid gap-2 text-sm font-medium">
                            <span>Description</span>
                            <textarea
                              name="description"
                              rows={3}
                              className="rounded-lg border bg-background px-3 py-2 text-sm"
                            />
                          </label>
                          <BuilderStep
                            number="2"
                            title="Audience"
                            detail="Choose discovery without exposing exact shot rows."
                          />
                          <label className="grid gap-2 text-sm font-medium">
                            <span>Visibility</span>
                            <select
                              name="visibility"
                              defaultValue="friends"
                              className="h-10 rounded-lg border bg-background px-3 text-sm"
                            >
                              {socialVisibilityOptions.map((option) => (
                                <option key={option} value={option}>
                                  {titleCase(option)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <BuilderStep
                            number="3"
                            title="Evidence window"
                            detail="Only qualifying imports recorded during this window enter the board."
                          />
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="grid gap-2 text-sm font-medium">
                              <span>Starts</span>
                              <Input
                                name="startsAt"
                                type="date"
                                className="h-10 rounded-xl bg-background"
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium">
                              <span>Ends</span>
                              <Input
                                name="endsAt"
                                type="date"
                                className="h-10 rounded-xl bg-background"
                              />
                            </label>
                          </div>
                          <ChallengeEligibilityPreview />
                          <Button type="submit" className="rounded-lg">
                            <Plus className="size-4" />
                            Create
                          </Button>
                        </form>
                      </SheetContent>
                    </Sheet>
                  )}
                </CardContent>
              </DataPanel>
            </div>
          </section>
        </div>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function BuilderStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-xl bg-secondary/55 p-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {number}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ChallengeEligibilityPreview() {
  return (
    <aside
      className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm"
      aria-label="Challenge eligibility preview"
    >
      <p className="font-semibold">Eligibility preview</p>
      <ul className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground">
        <li>• Only imported launch-monitor evidence inside the active window counts.</li>
        <li>• The selected template decides club, metric, minimum sample and win rule.</li>
        <li>• Mulligans, manual result claims and out-of-window shots do not enter the board.</li>
      </ul>
    </aside>
  );
}

function ChallengeBoardTable({
  activeTab,
  rows,
}: {
  activeTab: ChallengeHubTab;
  rows: ChallengeBoardRow[];
}) {
  return (
    <section
      id="challenge-board-table"
      className="grid gap-3"
      data-workbench-scope="challenge-board"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Challenge board</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Review live boards, joined entries, templates and closed challenges from one exportable
            desktop table.
          </p>
        </div>
        <StatusPill tone={rows.length > 0 ? "green" : "slate"}>{rows.length} rows</StatusPill>
      </div>

      <ChallengeBoardFilterTabs activeTab={activeTab} />

      <DesktopTableWorkbenchControls
        viewKey={`challenge-board-${activeTab}`}
        scope="challenge-board"
        currentViewLabel={challengeBoardViewLabel(activeTab)}
        resultLabel={`${rows.length} rows`}
        columns={challengeBoardColumns}
        suggestedViews={challengeBoardSuggestedViews}
        exportTableId="challenge-board"
        exportFileName={`forekinghell-challenge-board-${activeTab}.csv`}
      />
      <DataTableFrame mainTable mainTableLabel="Challenge board table" stickyFirstColumn>
        <Table
          data-workbench-export-table="challenge-board"
          aria-describedby="challenge-board-summary"
        >
          <TableCaption id="challenge-board-summary" className="sr-only">
            Challenge board table showing board, status, visibility, template, event window, player
            count, leader, proof label and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="board"
                className="sticky left-0 z-20 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Board
              </TableHead>
              <TableHead data-column="status">Status</TableHead>
              <TableHead data-column="visibility">Visibility</TableHead>
              <TableHead data-column="template">Template</TableHead>
              <TableHead data-column="window">Window</TableHead>
              <TableHead data-column="players">Players</TableHead>
              <TableHead data-column="leader">Leader</TableHead>
              <TableHead data-column="proof">Proof</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="board"
                    className="sticky left-0 z-10 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <ChallengeBoardTitle row={row} />
                  </TableCell>
                  <TableCell data-column="status">
                    <Badge variant={row.kind === "challenge" ? "secondary" : "outline"}>
                      {row.kind === "challenge"
                        ? row.challenge.status.replace(/_/g, " ")
                        : "Template"}
                    </Badge>
                  </TableCell>
                  <TableCell data-column="visibility">
                    {row.kind === "challenge" ? titleCase(row.challenge.visibility) : "Reusable"}
                  </TableCell>
                  <TableCell data-column="template">
                    {row.kind === "challenge" ? row.challenge.templateName : row.template.name}
                  </TableCell>
                  <TableCell data-column="window">
                    {row.kind === "challenge" ? formatChallengeWindow(row.challenge) : "--"}
                  </TableCell>
                  <TableCell data-column="players">
                    {row.kind === "challenge" ? row.challenge.participantCount : "--"}
                  </TableCell>
                  <TableCell data-column="leader">{challengeBoardLeader(row)}</TableCell>
                  <TableCell data-column="proof">{challengeBoardProof(row)}</TableCell>
                  <TableCell data-column="action" className="text-right">
                    <ChallengeBoardAction row={row} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No challenge rows match this view.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function ChallengeBoardFilterTabs({ activeTab }: { activeTab: ChallengeHubTab }) {
  const tabs: Array<{ key: ChallengeHubTab; label: string; href: string }> = [
    { key: "live", label: "Live", href: "/challenges" },
    { key: "joined", label: "Joined", href: "/challenges?tab=joined" },
    { key: "seasons", label: "Seasons", href: "/challenges?tab=seasons" },
    { key: "templates", label: "Templates", href: "/challenges?tab=templates" },
    { key: "past", label: "Past", href: "/challenges?tab=past" },
  ];

  return (
    <nav aria-label="Challenge board views" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex min-h-10 items-center rounded-xl bg-[#0B7A3B] px-3 text-sm font-semibold text-white"
                : "inline-flex min-h-10 items-center rounded-xl border bg-white px-3 text-sm font-semibold text-foreground hover:bg-[#F5F6F4]"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ChallengeBoardTitle({ row }: { row: ChallengeBoardRow }) {
  if (row.kind === "template") {
    return (
      <div className="min-w-0">
        <p className="font-semibold">{row.template.name}</p>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {row.template.description}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <Link
        href={`/challenges/${row.challenge.id}`}
        prefetch={false}
        className="font-semibold text-emerald-700 hover:underline"
      >
        {row.challenge.title}
      </Link>
      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
        {row.challenge.description ?? row.challenge.templateName}
      </p>
    </div>
  );
}

function ChallengeBoardAction({ row }: { row: ChallengeBoardRow }) {
  if (row.kind === "template") {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="#create-challenge" prefetch={false}>
          Create
        </Link>
      </Button>
    );
  }

  if (!row.challenge.viewerJoined) {
    return (
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/challenges/${row.challenge.id}`} prefetch={false}>
            Open
          </Link>
        </Button>
        <form action={joinChallengeAction}>
          <input type="hidden" name="challengeId" value={row.challenge.id} />
          <Button type="submit" size="sm">
            Join
          </Button>
        </form>
      </div>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/challenges/${row.challenge.id}`} prefetch={false}>
        Open entry
      </Link>
    </Button>
  );
}

function ChallengeBadgeImage({
  challenge,
  className,
}: {
  challenge: Pick<ChallengeListItem, "title" | "templateName">;
  className?: string;
}) {
  const kind = getChallengeBadgeKind(challenge);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(243,246,248,0.98)_52%,rgba(232,238,242,1)_100%)]",
        className,
      )}
      aria-hidden="true"
    >
      <ChallengeBadgeArtwork kind={kind} />
    </div>
  );
}

function MobilePremiumChallengeCard({
  challenge,
  eager = false,
  featured = false,
}: {
  challenge: ChallengeListItem;
  eager?: boolean;
  featured?: boolean;
}) {
  const kind = getChallengeBadgeKind(challenge);
  const href = `/challenges/${challenge.id}`;

  return (
    <article
      className={cn(
        "relative min-h-[24rem] overflow-hidden rounded-lg border border-emerald-950/15 bg-emerald-950 shadow-[0_22px_48px_rgba(5,27,15,0.22)]",
        featured ? "min-h-[28rem]" : "",
      )}
    >
      <Image
        src={challengeImageSrc(kind)}
        alt=""
        fill
        loading={featured || eager ? "eager" : "lazy"}
        sizes="calc(100vw - 2rem)"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,10,0.08)_0%,rgba(5,16,10,0.35)_42%,rgba(5,16,10,0.88)_100%)]" />
      <div className="relative grid min-h-[inherit] content-between gap-4 p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white/92 text-emerald-950 hover:bg-white/92">
              {featured ? "Featured" : challenge.templateName}
            </Badge>
            <Badge className="bg-emerald-300/92 text-emerald-950 hover:bg-emerald-300/92">
              Proof-led
            </Badge>
          </div>
          {challenge.viewerJoined ? (
            <Badge className="bg-white/18 text-white ring-1 ring-white/40 hover:bg-white/18">
              Joined{challenge.viewerRank ? ` · #${challenge.viewerRank}` : ""}
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
              {challenge.endsAt
                ? `Ends ${formatDate(challenge.endsAt)}`
                : titleCase(challenge.visibility)}
            </p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-normal text-balance">
              {challenge.title}
            </h2>
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-white/84">
              {challenge.description ?? challenge.templateName}
            </p>
          </div>
          <div className="grid gap-2 rounded-lg bg-white/12 p-3 text-sm ring-1 ring-white/18 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <span>{challenge.participantCount} players</span>
              <span>{titleCase(challenge.visibility)}</span>
            </div>
            <p className="line-clamp-1 text-white/82">
              {challenge.leader
                ? `Leader: ${challenge.leader.displayName} · ${challenge.leader.scoreLabel}`
                : "Waiting for the first verified import."}
            </p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Button
              asChild
              className="min-h-12 rounded-lg bg-white text-emerald-950 hover:bg-white/92"
            >
              <Link href={href} prefetch={false}>
                Open board
              </Link>
            </Button>
            {!challenge.viewerJoined ? (
              <form action={joinChallengeAction}>
                <input type="hidden" name="challengeId" value={challenge.id} />
                <Button
                  type="submit"
                  className="min-h-12 rounded-lg bg-[#C7972B] text-white hover:bg-[#A77D1F]"
                >
                  Join
                </Button>
              </form>
            ) : (
              <Button
                asChild
                variant="outline"
                className="min-h-12 rounded-lg border-white/42 bg-white/12 text-white hover:bg-white/20"
              >
                <Link href="/import" prefetch={false}>
                  Submit
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function challengeImageSrc(kind: ReturnType<typeof getChallengeBadgeKind>) {
  if (kind === "long-drive") {
    return "/assets/challenge-longest-drive.webp";
  }

  if (kind === "closest-pin") {
    return "/assets/challenge-closest-pin.webp";
  }

  if (kind === "seven-iron") {
    return "/assets/challenge-seven-iron-consistency.webp";
  }

  return "/assets/challenge-wedge-window.webp";
}

function getChallengeBadgeKind(challenge: Pick<ChallengeListItem, "title" | "templateName">) {
  const text = `${challenge.title} ${challenge.templateName}`.toLowerCase();

  if (text.includes("long") || text.includes("drive")) {
    return "long-drive" as const;
  }

  if (text.includes("pin") || text.includes("closest")) {
    return "closest-pin" as const;
  }

  if (text.includes("7") || text.includes("seven") || text.includes("iron")) {
    return "seven-iron" as const;
  }

  return "wedge-window" as const;
}

function ChallengeBadgeArtwork({
  kind,
}: {
  kind: "long-drive" | "closest-pin" | "seven-iron" | "wedge-window";
}) {
  if (kind === "long-drive") {
    return <LongestDriveBadgeArtwork />;
  }

  if (kind === "closest-pin") {
    return <ClosestPinBadgeArtwork />;
  }

  if (kind === "seven-iron") {
    return <SevenIronBadgeArtwork />;
  }

  return <WedgeWindowBadgeArtwork />;
}

function LongestDriveBadgeArtwork() {
  return (
    <svg viewBox="0 0 800 800" className="h-full w-full">
      <rect width="800" height="800" rx="132" fill="#DCE7FF" />
      <path d="M92 622C214 565 330 535 440 536C550 538 639 563 708 612V742H92Z" fill="#8ECF7A" />
      <path d="M228 742C260 592 319 468 406 370C489 466 550 590 590 742Z" fill="#2D8C54" />
      <path
        d="M238 742C272 620 322 523 388 451C451 518 501 616 540 742Z"
        fill="#6BC36F"
        opacity="0.55"
      />
      <circle cx="244" cy="650" r="10" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="4" />
      <path
        d="M248 650C314 558 390 446 476 314C527 236 574 182 618 152"
        stroke="#F97316"
        strokeWidth="18"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M612 140L672 164L610 198Z" fill="#0F172A" />
      <rect x="82" y="96" width="230" height="74" rx="37" fill="#FFFFFF" opacity="0.94" />
      <text x="197" y="144" textAnchor="middle" fill="#1E3A8A" fontSize="42" fontWeight="700">
        Longest drive
      </text>
      <text x="618" y="678" textAnchor="end" fill="#1E3A8A" fontSize="116" fontWeight="800">
        300+
      </text>
      <text x="618" y="730" textAnchor="end" fill="#334155" fontSize="42" fontWeight="700">
        yards challenge
      </text>
    </svg>
  );
}

function ClosestPinBadgeArtwork() {
  return (
    <svg viewBox="0 0 800 800" className="h-full w-full">
      <rect width="800" height="800" rx="132" fill="#F8F2D7" />
      <circle cx="400" cy="430" r="214" fill="#D9F3BF" />
      <circle cx="400" cy="430" r="154" fill="#B5E28D" />
      <circle cx="400" cy="430" r="96" fill="#FDFDF7" />
      <circle cx="400" cy="430" r="38" fill="#EAB308" />
      <path d="M404 250V432" stroke="#475569" strokeWidth="10" strokeLinecap="round" />
      <path d="M404 252L498 282L404 320Z" fill="#F97316" />
      <circle cx="400" cy="430" r="14" fill="#0F172A" />
      <circle cx="276" cy="314" r="8" fill="#F59E0B" opacity="0.6" />
      <circle cx="544" cy="542" r="8" fill="#F59E0B" opacity="0.6" />
      <circle cx="520" cy="316" r="8" fill="#F59E0B" opacity="0.6" />
      <rect x="98" y="98" width="220" height="74" rx="37" fill="#FFFFFF" opacity="0.95" />
      <text x="208" y="146" textAnchor="middle" fill="#9A6700" fontSize="42" fontWeight="700">
        Closest pin
      </text>
      <text x="400" y="688" textAnchor="middle" fill="#0F172A" fontSize="120" fontWeight="800">
        3 ft
      </text>
      <text x="400" y="736" textAnchor="middle" fill="#475569" fontSize="40" fontWeight="700">
        landing-circle pressure
      </text>
    </svg>
  );
}

function SevenIronBadgeArtwork() {
  return (
    <svg viewBox="0 0 800 800" className="h-full w-full">
      <rect width="800" height="800" rx="132" fill="#FCE7F3" />
      <rect x="154" y="190" width="492" height="372" rx="54" fill="#FFFFFF" opacity="0.92" />
      <path
        d="M208 500C287 449 351 424 400 424C449 424 514 449 594 500"
        stroke="#CBD5E1"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M226 486C300 438 358 414 400 414C442 414 500 438 574 486"
        stroke="#EC4899"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="346" cy="448" r="12" fill="#EC4899" />
      <circle cx="386" cy="430" r="12" fill="#EC4899" />
      <circle cx="423" cy="444" r="12" fill="#EC4899" />
      <circle cx="459" cy="434" r="12" fill="#EC4899" />
      <circle cx="400" cy="470" r="14" fill="#0F172A" />
      <rect x="92" y="98" width="258" height="74" rx="37" fill="#FFFFFF" opacity="0.95" />
      <text x="221" y="146" textAnchor="middle" fill="#BE185D" fontSize="42" fontWeight="700">
        7i consistency
      </text>
      <text x="400" y="642" textAnchor="middle" fill="#0F172A" fontSize="120" fontWeight="800">
        12 yd
      </text>
      <text x="400" y="694" textAnchor="middle" fill="#475569" fontSize="40" fontWeight="700">
        carry window spread
      </text>
    </svg>
  );
}

function WedgeWindowBadgeArtwork() {
  return (
    <svg viewBox="0 0 800 800" className="h-full w-full">
      <rect width="800" height="800" rx="132" fill="#DCFCE7" />
      <rect x="150" y="182" width="500" height="392" rx="48" fill="#FFFFFF" opacity="0.92" />
      <path d="M220 468H580" stroke="#CBD5E1" strokeWidth="10" strokeLinecap="round" />
      <path d="M220 404H580" stroke="#CBD5E1" strokeWidth="10" strokeLinecap="round" />
      <path d="M220 340H580" stroke="#CBD5E1" strokeWidth="10" strokeLinecap="round" />
      <rect x="266" y="322" width="270" height="164" rx="28" fill="#BBF7D0" />
      <path
        d="M288 456C334 421 373 404 404 404C438 404 476 421 520 456"
        stroke="#16A34A"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="402" cy="404" r="18" fill="#15803D" />
      <rect x="92" y="98" width="246" height="74" rx="37" fill="#FFFFFF" opacity="0.95" />
      <text x="215" y="146" textAnchor="middle" fill="#166534" fontSize="42" fontWeight="700">
        Wedge window
      </text>
      <text x="400" y="648" textAnchor="middle" fill="#0F172A" fontSize="120" fontWeight="800">
        95-110
      </text>
      <text x="400" y="698" textAnchor="middle" fill="#475569" fontSize="40" fontWeight="700">
        target-yardage ladder
      </text>
    </svg>
  );
}

function MobileDailyCoachDrills({
  challenges,
  statuses,
}: {
  challenges: CoachDrillChallenge[];
  statuses: Record<string, CoachDrillAwardStatus>;
}) {
  return (
    <NativeListSection
      title="Daily XP drills"
      description="Coach-generated shot-count challenges refresh daily and award XP when today’s imports prove completion or a win."
      action={
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href="/coach#more-drills" prefetch={false}>
            <Brain className="size-4" />
            Coach
          </Link>
        </Button>
      }
    >
      {challenges.length > 0 ? (
        challenges.slice(0, 3).map((challenge) => {
          const status = statuses[challenge.id] ?? {
            completed: false,
            won: false,
            uploadedShotCount: 0,
            completionTarget: challenge.completionTarget,
            winCount: 0,
            winTarget: winTargetForChallenge(challenge),
            completedAwarded: false,
            wonAwarded: false,
          };

          return (
            <Link
              key={challenge.id}
              href="/coach#more-drills"
              prefetch={false}
              className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 text-[#050505]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B7A3B]">
                    {challenge.clubName} · {challenge.issueLabel}
                  </p>
                  <p className="mt-1 font-semibold">{challenge.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[#6B7280]">
                    {challenge.winCondition}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-xs font-semibold text-white">
                  <Zap className="size-3 text-emerald-300" />+{challenge.completeXp}/
                  {challenge.winXp}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-[#F5F6F4] px-3 py-2">
                  <p className="text-xs text-[#6B7280]">Uploaded today</p>
                  <p className="font-semibold">
                    {status.uploadedShotCount}/{status.completionTarget}
                  </p>
                </div>
                <div className="rounded-lg bg-[#F5F6F4] px-3 py-2">
                  <p className="text-xs text-[#6B7280]">Win progress</p>
                  <p className="font-semibold">
                    {status.winCount}/{status.winTarget}
                  </p>
                </div>
              </div>
            </Link>
          );
        })
      ) : (
        <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-white p-4 text-sm text-[#6B7280]">
          Import at least three clean shots with one club to generate daily coach XP drills.
        </div>
      )}
    </NativeListSection>
  );
}

function winTargetForChallenge(challenge: CoachDrillChallenge) {
  return "target" in challenge.winRule ? challenge.winRule.target : challenge.completionTarget;
}

function ChallengeGrid({
  challenges,
  empty = "No challenges are visible yet. Create the first private friend challenge.",
}: {
  challenges: ChallengeListItem[];
  empty?: string;
}) {
  if (challenges.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{empty}</p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {challenges.map((challenge) => (
        <Card key={challenge.id} className="premium-card" size="sm">
          <div
            data-media-container
            className="relative mx-3 mt-3 aspect-[16/9] overflow-hidden rounded-lg bg-[#F5F6F4]"
          >
            <ChallengeBadgeImage challenge={challenge} />
          </div>
          <CardHeader>
            <CardTitle>{challenge.title}</CardTitle>
            <CardDescription>{challenge.templateName}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {challenge.description ?? "No description."}
            </p>
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
                <p className="text-muted-foreground">
                  {challenge.leader.scoreLabel} · {challenge.leader.verificationLabel}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/challenges/${challenge.id}`} prefetch={false}>
                  Open
                </Link>
              </Button>
              {!challenge.viewerJoined ? (
                <form action={joinChallengeAction}>
                  <input type="hidden" name="challengeId" value={challenge.id} />
                  <Button type="submit" size="sm">
                    Join
                  </Button>
                </form>
              ) : (
                <Badge variant="secondary">
                  Joined{challenge.viewerRank ? ` · #${challenge.viewerRank}` : ""}
                </Badge>
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

function buildChallengeBoardRows(input: {
  activeTab: ChallengeHubTab;
  challenges: ChallengeListItem[];
  mine: ChallengeListItem[];
  templates: ChallengeTemplateItem[];
}): ChallengeBoardRow[] {
  if (input.activeTab === "templates") {
    return input.templates.map((template) => ({
      kind: "template",
      id: `template:${template.id}`,
      template,
    }));
  }

  const challenges =
    input.activeTab === "joined"
      ? input.mine
      : input.activeTab === "seasons"
        ? input.challenges.filter(isSeasonChallenge)
        : input.activeTab === "past"
          ? input.challenges.filter(isPastChallenge)
          : input.challenges.filter((challenge) => !isPastChallenge(challenge));

  return challenges.map((challenge) => ({
    kind: "challenge",
    id: `challenge:${challenge.id}`,
    challenge,
  }));
}

function isSeasonChallenge(challenge: ChallengeListItem) {
  if (!challenge.endsAt) return false;
  return challenge.endsAt.getTime() - challenge.startsAt.getTime() >= 28 * 86_400_000;
}

function isPastChallenge(challenge: ChallengeListItem) {
  return (
    challenge.status === "completed" ||
    challenge.status === "closed" ||
    challenge.status === "finished" ||
    Boolean(challenge.endsAt && challenge.endsAt.getTime() < Date.now())
  );
}

function challengeBoardViewLabel(activeTab: ChallengeHubTab) {
  if (activeTab === "joined") {
    return "Joined challenge boards";
  }

  if (activeTab === "templates") {
    return "Challenge templates";
  }

  if (activeTab === "seasons") {
    return "Seasonal league boards";
  }

  if (activeTab === "past") {
    return "Past challenge boards";
  }

  return "Live challenge boards";
}

function formatChallengeWindow(challenge: ChallengeListItem) {
  const startsAt = formatDate(challenge.startsAt);
  const endsAt = challenge.endsAt ? formatDate(challenge.endsAt) : "open";

  return `${startsAt} to ${endsAt}`;
}

function challengeBoardLeader(row: ChallengeBoardRow) {
  if (row.kind === "template") {
    return "Use imported proof";
  }

  return row.challenge.leader
    ? `${row.challenge.leader.displayName} · ${row.challenge.leader.scoreLabel}`
    : "No score yet";
}

function challengeBoardProof(row: ChallengeBoardRow) {
  if (row.kind === "template") {
    return row.template.scoringDirection === "asc" ? "Lower is better" : "Higher is better";
  }

  return row.challenge.leader?.verificationLabel ?? "Awaiting proof";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseChallengeHubTab(value?: string): ChallengeHubTab {
  if (value === "joined" || value === "seasons" || value === "templates" || value === "past") {
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
