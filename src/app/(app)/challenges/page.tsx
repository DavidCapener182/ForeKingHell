import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Award,
  ChevronRight,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Upload,
  Users,
} from "lucide-react";

import { createChallengeAction, joinChallengeAction } from "@/app/challenges/actions";
import { AppEmptyState } from "@/components/app/app-empty-state";
import {
  MobileAppShell,
  MobileRouteTabs,
  MobileTabBar,
  MobileTopBar,
} from "@/components/mobile-sports";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { getBillingPageData } from "@/lib/billing";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import { socialVisibilityOptions } from "@/lib/social";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ChallengeTab = "active" | "available" | "completed";
type ChallengeTemplate = Awaited<ReturnType<typeof getChallengesPageData>>["templates"][number];

type ChallengesPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function ChallengesPage({ searchParams }: ChallengesPageProps) {
  const params = await searchParams;
  const [data, billing, surface] = await Promise.all([
    getChallengesPageData(),
    getBillingPageData(),
    getRequestAppSurface(),
  ]);
  const activeTab = parseChallengeTab(params?.tab);
  const now = new Date();
  const activeChallenges = data.challenges.filter(
    (challenge) => challenge.viewerJoined && !isChallengeFinished(challenge, now),
  );
  const availableChallenges = data.challenges.filter(
    (challenge) => !challenge.viewerJoined && !isChallengeFinished(challenge, now),
  );
  const completedChallenges = data.challenges.filter(
    (challenge) => challenge.viewerJoined && isChallengeFinished(challenge, now),
  );
  const freePlan = billing.activePlanKey === "free";
  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkbenchLayout = workbench?.DesktopWorkbenchLayout;

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>
          <MobileTopBar
            title="Challenges"
            actions={
              <CreateChallengeSheet templates={data.templates} freePlan={freePlan} compact />
            }
          />
          <MobileRouteTabs group="social" activeKey="challenges" />
          <MobileTabBar
            activeKey={activeTab}
            className="-mt-4"
            tabs={challengeTabs.map((tab) => ({
              key: tab.key,
              label: tab.label,
              href: tab.href,
            }))}
          />

          <div className="grid gap-4" data-challenge-progression-hub>
            {activeTab === "active" ? (
              <MobileActiveView challenges={activeChallenges} />
            ) : activeTab === "available" ? (
              <AvailableChallengeGrid challenges={availableChallenges} mobile />
            ) : (
              <CompletedChallengeGrid challenges={completedChallenges} mobile />
            )}
          </div>
        </MobileAppShell>
      ) : null}

      {surface === "workbench" && DesktopWorkbenchLayout ? (
        <DesktopWorkbenchLayout scope="challenges">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/dashboard" prefetch={false}>
                <ArrowLeft className="size-4" />
                Dashboard
              </Link>
            </Button>
            <CreateChallengeSheet templates={data.templates} freePlan={freePlan} />
          </div>

          <PageHeader
            eyebrow={<StatusPill tone="green">Progression</StatusPill>}
            title="Challenges"
            description="Turn measured practice into a target, a next attempt and something worth completing."
            visual={
              <PageArtwork variant="challenges" alt="" className="h-full min-h-36" priority />
            }
            metrics={[
              {
                label: "Active",
                value: String(activeChallenges.length),
                detail: "In progress now",
              },
              {
                label: "Available",
                value: String(availableChallenges.length),
                detail: "Ready to join",
              },
              {
                label: "Completed",
                value: String(completedChallenges.length),
                detail: "Results earned",
              },
            ]}
          />

          <ChallengeTabs activeTab={activeTab} />

          <main className="grid min-w-0 gap-5" data-challenge-progression-hub>
            {activeTab === "active" ? (
              <ActiveChallengeGrid challenges={activeChallenges} />
            ) : activeTab === "available" ? (
              <AvailableChallengeGrid challenges={availableChallenges} />
            ) : (
              <CompletedChallengeGrid challenges={completedChallenges} />
            )}
          </main>
        </DesktopWorkbenchLayout>
      ) : null}
    </PageShell>
  );
}

const challengeTabs: Array<{ key: ChallengeTab; label: string; href: string }> = [
  { key: "active", label: "Active", href: "/challenges" },
  { key: "available", label: "Available", href: "/challenges?tab=available" },
  { key: "completed", label: "Completed", href: "/challenges?tab=completed" },
];

function ChallengeTabs({ activeTab }: { activeTab: ChallengeTab }) {
  return (
    <nav aria-label="Challenge status" data-challenge-section-tabs>
      <ButtonGroup className="w-full justify-start border-b border-border/70 pb-3">
        {challengeTabs.map((tab) => (
          <Button
            key={tab.key}
            asChild
            variant={activeTab === tab.key ? "default" : "ghost"}
            className="min-h-11 rounded-full px-5"
          >
            <Link
              href={tab.href}
              prefetch={false}
              aria-current={activeTab === tab.key ? "page" : undefined}
            >
              {tab.label}
            </Link>
          </Button>
        ))}
      </ButtonGroup>
    </nav>
  );
}

function MobileActiveView({ challenges }: { challenges: ChallengeListItem[] }) {
  if (challenges.length === 0) {
    return <ChallengeEmptyState tab="active" />;
  }

  const [current, ...remaining] = challenges;

  return (
    <>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Current challenge
        </p>
        <ActiveChallengeCard challenge={current} featured />
      </div>
      {remaining.length > 0 ? (
        <section className="grid gap-3" aria-labelledby="other-active-challenges">
          <div>
            <h2 id="other-active-challenges" className="text-lg font-semibold">
              Also in progress
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep the next attempt visible, without competing with your current focus.
            </p>
          </div>
          {remaining.map((challenge) => (
            <ActiveChallengeCard key={challenge.id} challenge={challenge} compact />
          ))}
        </section>
      ) : null}
    </>
  );
}

function ActiveChallengeGrid({ challenges }: { challenges: ChallengeListItem[] }) {
  if (challenges.length === 0) {
    return <ChallengeEmptyState tab="active" />;
  }

  return (
    <section className="grid gap-4" aria-labelledby="active-challenges-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Your focus
          </p>
          <h2 id="active-challenges-title" className="mt-1 text-2xl font-semibold">
            Active challenges
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Progress first. Then one useful next attempt.
          </p>
        </div>
        <Badge variant="secondary">{challenges.length} in progress</Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {challenges.map((challenge, index) => (
          <ActiveChallengeCard key={challenge.id} challenge={challenge} featured={index === 0} />
        ))}
      </div>
    </section>
  );
}

function ActiveChallengeCard({
  challenge,
  featured = false,
  compact = false,
}: {
  challenge: ChallengeListItem;
  featured?: boolean;
  compact?: boolean;
}) {
  const progress = challengeProgress(challenge);
  const nextAction = nextChallengeAction(challenge);
  const target = challengeTargetLabel(challenge);

  return (
    <Card
      className={cn(
        "overflow-hidden border-primary/20 py-0 shadow-[0_18px_50px_rgba(6,47,30,0.08)]",
        featured && "ring-1 ring-primary/20",
      )}
      data-active-challenge-card
    >
      <CardContent className={cn("grid gap-5 p-5", compact && "gap-4 p-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="green">Active</StatusPill>
              {challenge.viewerRank ? (
                <Badge variant="outline">Rank #{challenge.viewerRank}</Badge>
              ) : null}
            </div>
            <h2
              className={cn("mt-3 font-semibold tracking-tight", compact ? "text-xl" : "text-2xl")}
            >
              {challenge.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{challenge.templateName}</p>
          </div>
          <RulesSheet challenge={challenge} />
        </div>

        <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(15,118,78,0.12),rgba(199,151,43,0.08))] p-4 ring-1 ring-primary/15">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Progress
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{progress}%</p>
            </div>
            <p className="max-w-52 text-right text-sm font-medium">
              {challenge.viewerEvidenceCount} of {challenge.evidenceTargetCount} qualifying shots
            </p>
          </div>
          <Progress
            value={progress}
            aria-label={`${challenge.title} progress`}
            className="mt-3 h-4 bg-background/80 [&>div]:bg-[linear-gradient(90deg,#0f7a4e,#d0a43a)]"
          />
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
          <ChallengeMetric
            label="Current value"
            value={challenge.viewerScoreLabel ?? "No score yet"}
          />
          <ChallengeMetric label="Target" value={target} />
          <ChallengeMetric label="Time remaining" value={timeRemaining(challenge.endsAt)} />
          <ChallengeMetric
            label="Best attempt"
            value={challenge.viewerScoreLabel ?? "Awaiting proof"}
          />
        </dl>

        <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Target className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Next useful action
              </p>
              <p className="mt-1 font-semibold">{nextAction.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{nextAction.detail}</p>
            </div>
          </div>
          <Button asChild className="min-h-11 rounded-xl">
            <Link href={nextAction.href} prefetch={false}>
              {nextAction.href === "/import" ? (
                <Upload className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              {nextAction.action}
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            {challenge.viewerVerificationLabel ?? challenge.evidenceRequirement}
          </span>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/challenges/${challenge.id}`} prefetch={false}>
              Attempts timeline
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChallengeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-card p-3">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  );
}

function AvailableChallengeGrid({
  challenges,
  mobile = false,
}: {
  challenges: ChallengeListItem[];
  mobile?: boolean;
}) {
  if (challenges.length === 0) {
    return <ChallengeEmptyState tab="available" />;
  }

  return (
    <section className="grid gap-4" aria-labelledby="available-challenges-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Pick the next test
        </p>
        <h2 id="available-challenges-title" className="mt-1 text-2xl font-semibold">
          Available challenges
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare the objective and evidence first. Open the rules only when you need them.
        </p>
      </div>
      <div className={cn("grid gap-3", !mobile && "md:grid-cols-2 xl:grid-cols-3")}>
        {challenges.map((challenge) => (
          <AvailableChallengeTile key={challenge.id} challenge={challenge} />
        ))}
      </div>
    </section>
  );
}

function AvailableChallengeTile({ challenge }: { challenge: ChallengeListItem }) {
  return (
    <Card className="gap-0 overflow-hidden py-0" data-available-challenge-tile>
      <div className="relative h-24 overflow-hidden bg-emerald-950">
        <Image
          src={challengeImageSrc(challenge)}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 to-emerald-950/20" />
        <div className="absolute inset-0 flex items-end justify-between gap-3 p-4 text-white">
          <Badge className="bg-white/92 text-emerald-950 hover:bg-white/92">
            {challenge.difficulty}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            <Timer className="size-3.5" aria-hidden />
            {timeRemaining(challenge.endsAt)}
          </span>
        </div>
      </div>
      <CardContent className="grid gap-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Objective
          </p>
          <h3 className="mt-1 text-lg font-semibold">{challenge.title}</h3>
        </div>
        <dl className="grid gap-2 text-sm">
          <CompactFact
            icon={<ShieldCheck />}
            label="Evidence"
            value={challenge.evidenceRequirement}
          />
          <CompactFact icon={<Award />} label="Achievement" value="Verified leaderboard result" />
          <CompactFact
            icon={<Users />}
            label="Field"
            value={`${challenge.participantCount} player${challenge.participantCount === 1 ? "" : "s"}`}
          />
        </dl>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <form action={joinChallengeAction}>
            <input type="hidden" name="challengeId" value={challenge.id} />
            <Button type="submit" className="min-h-11 w-full rounded-xl">
              <Plus className="size-4" />
              Join
            </Button>
          </form>
          <RulesSheet challenge={challenge} />
        </div>
      </CardContent>
    </Card>
  );
}

function CompactFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1.25rem_5.25rem_minmax(0,1fr)] items-start gap-2">
      <span className="mt-0.5 text-primary [&>svg]:size-4">{icon}</span>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function CompletedChallengeGrid({
  challenges,
  mobile = false,
}: {
  challenges: ChallengeListItem[];
  mobile?: boolean;
}) {
  if (challenges.length === 0) {
    return <ChallengeEmptyState tab="completed" />;
  }

  return (
    <section className="grid gap-4" aria-labelledby="completed-challenges-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a6a12]">
          Achievement cabinet
        </p>
        <h2 id="completed-challenges-title" className="mt-1 text-2xl font-semibold">
          Completed challenges
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A record of the targets you took on and the measured results you earned.
        </p>
      </div>
      <div className={cn("grid gap-4", !mobile && "md:grid-cols-2 xl:grid-cols-3")}>
        {challenges.map((challenge) => (
          <CompletedChallengeCard key={challenge.id} challenge={challenge} />
        ))}
      </div>
    </section>
  );
}

function CompletedChallengeCard({ challenge }: { challenge: ChallengeListItem }) {
  return (
    <Link
      href={`/challenges/${challenge.id}`}
      prefetch={false}
      className="group relative overflow-hidden rounded-2xl border border-[#d5b566]/45 bg-[linear-gradient(145deg,#fffdf6,#f5ead0)] p-5 text-[#2d2414] shadow-[0_18px_50px_rgba(96,66,20,0.12)] transition-transform hover:-translate-y-0.5 dark:border-[#d5b566]/35 dark:bg-[linear-gradient(145deg,#302817,#1d1a14)] dark:text-[#fff7df]"
      data-completed-challenge-card
    >
      <div className="absolute -right-10 -top-10 size-36 rounded-full border-[18px] border-[#c7972b]/12" />
      <div className="relative flex items-start justify-between gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-[#c7972b] text-white shadow-lg ring-4 ring-white/70 dark:ring-black/20">
          {challenge.viewerRank === 1 ? (
            <Trophy className="size-7" />
          ) : (
            <Award className="size-7" />
          )}
        </span>
        <Badge className="bg-[#2d2414] text-[#fff7df] hover:bg-[#2d2414]">
          {challenge.viewerRank ? `Finished #${challenge.viewerRank}` : "Completed"}
        </Badge>
      </div>
      <p className="relative mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d681e] dark:text-[#e3c36e]">
        Challenge achievement
      </p>
      <h3 className="relative mt-2 text-2xl font-semibold tracking-tight">{challenge.title}</h3>
      <div className="relative mt-5 flex items-end justify-between gap-4 border-t border-[#b89752]/30 pt-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] opacity-65">Best result</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {challenge.viewerScoreLabel ?? "Verified entry"}
          </p>
        </div>
        <span className="grid size-9 place-items-center rounded-full bg-[#2d2414] text-[#fff7df] transition-transform group-hover:translate-x-0.5">
          <ChevronRight className="size-5" />
        </span>
      </div>
    </Link>
  );
}

function RulesSheet({ challenge }: { challenge: ChallengeListItem }) {
  return (
    <Sheet>
      <SheetTrigger
        type="button"
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "min-h-11 shrink-0 rounded-xl",
        })}
      >
        <ShieldCheck className="size-4" />
        Rules
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {challenge.templateName}
          </p>
          <SheetTitle>{challenge.title}</SheetTitle>
          <SheetDescription>{challenge.rulesSummary}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          <div className="grid grid-cols-2 gap-2">
            <SheetFact label="Difficulty" value={challenge.difficulty} />
            <SheetFact label="Evidence" value={challenge.evidenceRequirement} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Rules</p>
            <ol className="grid gap-2">
              {challenge.rulesBullets.map((rule, index) => (
                <li
                  key={rule}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-xl border p-3 text-sm leading-5"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl bg-muted/60 p-4 text-sm">
            <p className="font-semibold">Evidence standard</p>
            <p className="mt-1 leading-5 text-muted-foreground">
              Imported launch-monitor rows update progress and the leaderboard automatically.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SheetFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function CreateChallengeSheet({
  templates,
  freePlan,
  compact = false,
}: {
  templates: ChallengeTemplate[];
  freePlan: boolean;
  compact?: boolean;
}) {
  return (
    <Sheet>
      <SheetTrigger
        type="button"
        className={buttonVariants({
          variant: compact ? "ghost" : "outline",
          size: compact ? "icon-sm" : "default",
          className: compact ? "rounded-full" : "rounded-xl",
        })}
        aria-label="Create challenge"
      >
        <Plus className="size-4" />
        {!compact ? "Create challenge" : null}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create a challenge</SheetTitle>
          <SheetDescription>
            Choose the objective, field and evidence window. Imported shots do the scoring.
          </SheetDescription>
        </SheetHeader>
        {freePlan ? (
          <div className="grid gap-4 px-4 pb-6">
            <div className="rounded-xl border bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
              Free players can join public challenges. Plus unlocks private friend challenges.
            </div>
            <Button asChild className="rounded-xl">
              <Link href="/billing" prefetch={false}>
                View plans
              </Link>
            </Button>
          </div>
        ) : (
          <form action={createChallengeAction} className="grid gap-4 px-4 pb-6">
            <label className="grid gap-1.5 text-sm font-semibold">
              Objective
              <Select name="templateId" defaultValue={templates[0]?.id}>
                <SelectTrigger className="min-h-11 w-full" aria-label="Challenge objective">
                  <SelectValue placeholder="Choose an objective" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Challenge name
              <Input name="title" placeholder="August wedge ladder" className="min-h-11" required />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Short note <span className="font-normal text-muted-foreground">Optional</span>
              <Textarea
                name="description"
                rows={3}
                placeholder="What makes this target worth chasing?"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Who can join
              <Select name="visibility" defaultValue="friends">
                <SelectTrigger className="min-h-11 w-full" aria-label="Challenge visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {socialVisibilityOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {titleCase(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">
                Starts
                <Input name="startsAt" type="date" className="min-h-11" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Ends
                <Input name="endsAt" type="date" className="min-h-11" />
              </label>
            </div>
            <div className="flex gap-3 rounded-xl bg-primary/5 p-4 text-sm">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <p>Only qualifying imported evidence inside the chosen window will count.</p>
            </div>
            <Button type="submit" className="min-h-11 rounded-xl">
              <Sparkles className="size-4" />
              Create challenge
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChallengeEmptyState({ tab }: { tab: ChallengeTab }) {
  const content = {
    active: {
      title: "No active challenge yet",
      description: "Choose one measured target and make your next practice session count.",
      href: "/challenges?tab=available",
      action: "Browse available",
    },
    available: {
      title: "No open challenges right now",
      description: "New public and friend challenges will appear here when they are ready to join.",
      href: "/practice",
      action: "Open practice",
    },
    completed: {
      title: "Your achievement cabinet is waiting",
      description: "Finish an active challenge and the measured result will be kept here.",
      href: "/challenges",
      action: "View active",
    },
  }[tab];

  return (
    <AppEmptyState
      title={content.title}
      description={content.description}
      primaryAction={
        <Button asChild className="rounded-xl">
          <Link href={content.href} prefetch={false}>
            {content.action}
          </Link>
        </Button>
      }
    />
  );
}

function challengeProgress(challenge: ChallengeListItem) {
  if (challenge.evidenceTargetCount <= 0) return challenge.viewerScoreLabel ? 100 : 0;
  return Math.min(
    100,
    Math.round((challenge.viewerEvidenceCount / challenge.evidenceTargetCount) * 100),
  );
}

function challengeTargetLabel(challenge: ChallengeListItem) {
  if (!challenge.leader) return "Set the mark";
  if (challenge.viewerRank === 1) return "Hold #1";
  return challenge.leader.scoreLabel;
}

function nextChallengeAction(challenge: ChallengeListItem) {
  const shotsRemaining = Math.max(0, challenge.evidenceTargetCount - challenge.viewerEvidenceCount);

  if (shotsRemaining > 0) {
    return {
      label: `Import ${shotsRemaining} more qualifying ${shotsRemaining === 1 ? "shot" : "shots"}`,
      detail: challenge.evidenceRequirement,
      href: "/import",
      action: "Import evidence",
    };
  }

  if (challenge.viewerRank === 1) {
    return {
      label: "Defend the lead with another verified set",
      detail: "Your current result leads. Bank a stronger attempt before time runs out.",
      href: "/import",
      action: "Add attempt",
    };
  }

  if (challenge.leader) {
    return {
      label: `Beat ${challenge.leader.scoreLabel}`,
      detail: `${challenge.leader.displayName} currently sets the target.`,
      href: "/import",
      action: "Add attempt",
    };
  }

  return {
    label: "Set the first verified result",
    detail: "A qualifying imported set will establish the target.",
    href: "/import",
    action: "Add attempt",
  };
}

function isChallengeFinished(challenge: ChallengeListItem, now = new Date()) {
  return (
    challenge.status === "completed" ||
    challenge.status === "closed" ||
    challenge.status === "expired" ||
    Boolean(challenge.endsAt && challenge.endsAt < now)
  );
}

function timeRemaining(endsAt: Date | null) {
  if (!endsAt) return "Open ended";
  const milliseconds = endsAt.getTime() - Date.now();
  if (milliseconds <= 0) return "Finished";
  const hours = Math.ceil(milliseconds / 3_600_000);
  if (hours < 48) return `${hours}h`;
  return `${Math.ceil(hours / 24)} days`;
}

function challengeImageSrc(challenge: Pick<ChallengeListItem, "title" | "templateName">) {
  const text = `${challenge.title} ${challenge.templateName}`.toLowerCase();
  if (text.includes("long") || text.includes("drive"))
    return "/assets/challenge-longest-drive.webp";
  if (text.includes("pin") || text.includes("closest")) return "/assets/challenge-closest-pin.webp";
  if (text.includes("7") || text.includes("seven") || text.includes("iron"))
    return "/assets/challenge-seven-iron-consistency.webp";
  return "/assets/challenge-wedge-window.webp";
}

function titleCase(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseChallengeTab(value?: string): ChallengeTab {
  if (value === "available" || value === "live" || value === "templates") return "available";
  if (value === "completed" || value === "past") return "completed";
  return "active";
}
