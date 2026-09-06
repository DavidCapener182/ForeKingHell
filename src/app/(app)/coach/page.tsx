import { DriverDevelopmentPanel } from "@/components/analysis/driver-development-panel";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  ChevronRight,
  CircleDotDashed,
  Crosshair,
  Database,
  FileText,
  Gauge,
  MoreHorizontal,
  ShieldCheck,
  Target,
  Upload,
  UsersRound,
} from "lucide-react";

import { CoachDrillAutoSync } from "@/app/coach/coach-drill-auto-sync";
import { LazyCoachDataChatPanel } from "@/app/coach/lazy-coach-data-chat-panel";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell, StatusPill } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAiFeatureEntitlement } from "@/lib/ai/usage";
import { planAllowsAiFeature } from "@/lib/ai/features";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import {
  buildCoachDrillChallenges,
  buildCoachSummary,
  type CoachClubCard,
  type CoachSummary,
} from "@/lib/coach";
import { getCoachDrillAwardStatuses } from "@/lib/coach-drill-awards";
import {
  getCoachEvidenceBrowserData,
  type CoachEvidenceBrowserData,
} from "@/lib/coach-evidence-browser";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProgressData } from "@/lib/progress-data";
import type { ProgressSignal } from "@/lib/progress-summary";

export const dynamic = "force-dynamic";

type CoachSearchParams = Promise<{ tab?: string | string[] }>;
type CoachTab = "diagnosis" | "evidence" | "ask";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function CoachPage({ searchParams }: { searchParams: CoachSearchParams }) {
  const params = await searchParams;
  const [userId, surface] = await Promise.all([requireCurrentUserId(), getRequestAppSurface()]);
  const [data, evidence, dataChatEntitlement] = await Promise.all([
    getProgressData(userId),
    getCoachEvidenceBrowserData(userId),
    getAiFeatureEntitlement(userId, "data_chat"),
  ]);
  const coach = buildCoachSummary(data.clubs);
  const topClub =
    coach.clubCards.find((card) => card.sampleSize >= 3) ?? coach.clubCards[0] ?? null;
  const secondaryClub =
    coach.clubCards.find((card) => card.clubId !== topClub?.clubId && card.sampleSize >= 3) ??
    coach.clubCards.find((card) => card.clubId !== topClub?.clubId) ??
    null;
  const topClubData = data.clubs.find((club) => club.clubId === topClub?.clubId) ?? null;
  const drillChallenges = buildCoachDrillChallenges(coach);
  const drillStatuses = await getCoachDrillAwardStatuses(drillChallenges);
  const shouldSyncDrillAwards = Object.values(drillStatuses).some(
    (status) =>
      (status.completed && !status.completedAwarded) || (status.won && !status.wonAwarded),
  );
  const activeTab = parseCoachTab(params.tab);
  const canUseDataChat = planAllowsAiFeature(dataChatEntitlement.planKey, "data_chat");

  return (
    <PageShell>
      <CoachDrillAutoSync enabled={shouldSyncDrillAwards} />
      {surface === "companion" ? (
        <MobileCoachSummary coach={coach} topClub={topClub} />
      ) : (
        <DesktopCoachWorkspace
          coach={coach}
          topClub={topClub}
          secondaryClub={secondaryClub}
          topClubAnalytics={
            topClubData
              ? {
                  carrySpreadYd: topClubData.analytics.distance.carrySpreadYd,
                  carryConsistencyScore: topClubData.analytics.consistency.carryConsistencyScore,
                }
              : null
          }
          evidence={evidence}
          activeTab={activeTab}
          canUseDataChat={canUseDataChat}
          monthlyRemaining={dataChatEntitlement.monthlyRemaining}
        />
      )}
      <DriverDevelopmentPanel compact />
    </PageShell>
  );
}

async function DesktopCoachWorkspace({
  coach,
  topClub,
  secondaryClub,
  topClubAnalytics,
  evidence,
  activeTab,
  canUseDataChat,
  monthlyRemaining,
}: {
  coach: CoachSummary;
  topClub: CoachClubCard | null;
  secondaryClub: CoachClubCard | null;
  topClubAnalytics: { carrySpreadYd: number | null; carryConsistencyScore: number } | null;
  evidence: CoachEvidenceBrowserData;
  activeTab: CoachTab;
  canUseDataChat: boolean;
  monthlyRemaining: number;
}) {
  const [{ DesktopWorkbenchLayout }, { AiDesktopWorkbench }] = await Promise.all([
    import("@/components/app/desktop-workbench"),
    import("@/components/app/ai-desktop-workbench"),
  ]);

  return (
    <>
      <header className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="size-4" />
              Coach tools
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/coach/workspace" prefetch={false}>
                <UsersRound className="size-4" />
                Players
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/coach/reports" prefetch={false}>
                <FileText className="size-4" />
                Reports
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/speed" prefetch={false}>
                <Gauge className="size-4" />
                Driver Speed Development
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <DesktopWorkbenchLayout scope="coach">
        <AiDesktopWorkbench
          defaultTab={activeTab}
          diagnosis={
            topClub ? (
              <CoachDiagnosis
                coach={coach}
                topClub={topClub}
                secondaryClub={secondaryClub}
                topClubAnalytics={topClubAnalytics}
                latestRound={evidence.latestRound}
              />
            ) : (
              <CoachEmptyState />
            )
          }
          evidence={<CoachEvidenceBrowser coach={coach} evidence={evidence} />}
          ask={<CoachAsk canUseDataChat={canUseDataChat} monthlyRemaining={monthlyRemaining} />}
          context={<DiagnosisRail coach={coach} topClub={topClub} />}
          evidenceContext={<EvidenceRail coach={coach} evidence={evidence} />}
          askStandalone
        />
      </DesktopWorkbenchLayout>
    </>
  );
}

function CoachDiagnosis({
  coach,
  topClub,
  secondaryClub,
  topClubAnalytics,
  latestRound,
}: {
  coach: CoachSummary;
  topClub: CoachClubCard;
  secondaryClub: CoachClubCard | null;
  topClubAnalytics: { carrySpreadYd: number | null; carryConsistencyScore: number } | null;
  latestRound: CoachEvidenceBrowserData["latestRound"];
}) {
  const improving = improvingSignal(coach);

  return (
    <div className="grid gap-5" data-coach-diagnosis-workspace>
      <section
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
        data-primary-diagnosis
      >
        <div className="border-b bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_10%,var(--card)),var(--card)_58%)] p-6 xl:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Primary diagnosis
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {coachEvidenceConfidence(topClub)} · {topClub.sampleSize} clean shots
            </span>
          </div>
          <h1 className="mt-6 text-lg font-medium tracking-normal text-muted-foreground">
            Your biggest scoring opportunity is…
          </h1>
          <p className="mt-2 max-w-5xl text-4xl font-semibold tracking-[-0.035em] text-balance text-foreground xl:text-6xl">
            {topClub.clubName} {topClub.issueLabel.toLowerCase()}
          </p>
        </div>

        <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <DiagnosisRead label="What I see" icon={<CircleDotDashed className="size-4" />}>
            {topClub.reason}
          </DiagnosisRead>
          <DiagnosisRead label="Why it matters" icon={<Target className="size-4" />}>
            {whyItMatters(topClub)}
          </DiagnosisRead>
          <DiagnosisRead label="Confidence" icon={<Gauge className="size-4" />}>
            <span className="flex items-center gap-3">
              <strong className="text-2xl text-foreground">{topClub.trustIndex}%</strong>
              <span>{confidenceDetail(topClub)}</span>
            </span>
          </DiagnosisRead>
          <DiagnosisRead label="Next action" icon={<Crosshair className="size-4" />}>
            <span className="grid gap-3">
              <span>{topClub.drill}</span>
              <Button asChild className="w-fit" size="sm">
                <Link href={practiceHref("latest_weakness")} prefetch={false}>
                  Build this practice plan
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </span>
          </DiagnosisRead>
        </div>
      </section>

      <section aria-labelledby="supporting-evidence-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Supporting evidence
            </p>
            <h2 id="supporting-evidence-heading" className="mt-1 text-xl font-semibold">
              Three signals behind the read
            </h2>
          </div>
          <Link
            href="/coach?tab=evidence"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Browse evidence
          </Link>
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          <DispersionVisual card={topClub} />
          <CarryConsistencyVisual
            stockCarryYd={topClub.stockCarryYd}
            carrySpreadYd={topClubAnalytics?.carrySpreadYd ?? null}
            score={topClubAnalytics?.carryConsistencyScore ?? topClub.trustIndex}
          />
          <RoundResultVisual latestRound={latestRound} />
        </div>
      </section>

      <section
        className="overflow-hidden rounded-xl border bg-card"
        aria-label="Coaching priorities"
      >
        <div className="border-b px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Coaching priorities
          </p>
          <h2 className="mt-1 text-xl font-semibold">What to work on next</h2>
        </div>
        <CoachingPriority
          index={1}
          title={`${topClub.clubName} · ${topClub.issueLabel}`}
          detail={topClub.drill}
          href={practiceHref("latest_weakness")}
        />
        <CoachingPriority
          index={2}
          title={
            secondaryClub
              ? `${secondaryClub.clubName} · ${secondaryClub.issueLabel}`
              : "Build the next reliable signal"
          }
          detail={
            secondaryClub?.reason ?? "Add another comparable session before widening the plan."
          }
          href={practiceHref("confidence")}
        />
        <CoachingPriority
          index={3}
          title={improving.title}
          detail={improving.detail}
          href={practiceHref("scoring")}
        />
      </section>
    </div>
  );
}

function DiagnosisRead({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="p-5 xl:p-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-base leading-7 text-foreground/85">{children}</div>
    </div>
  );
}

function DispersionVisual({ card }: { card: CoachClubCard }) {
  const playableRate = card.playableRate ?? 0;
  const shift = card.usualMiss === "Left" ? -18 : card.usualMiss === "Right" ? 18 : 0;
  const spread = Math.max(10, Math.min(31, 34 - playableRate * 0.24));
  const points = [
    [50 + shift, 43],
    [50 + shift * 0.6 - spread * 0.55, 57],
    [50 + shift * 0.8 + spread * 0.45, 61],
    [50 + shift * 0.35 - spread * 0.25, 34],
    [50 + shift + spread * 0.55, 48],
    [50 + shift * 0.4, 70],
    [50 + shift * 0.7 - spread * 0.7, 74],
  ];

  return (
    <EvidenceVisual label="Dispersion" value={card.usualMiss ?? "Needs data"}>
      <svg viewBox="0 0 100 86" className="h-36 w-full" role="img" aria-label="Shot dispersion">
        <ellipse cx="50" cy="52" rx="23" ry="31" fill="none" stroke="currentColor" opacity="0.12" />
        <ellipse cx="50" cy="52" rx="11" ry="16" fill="none" stroke="currentColor" opacity="0.2" />
        <path d="M50 15v74M12 52h76" stroke="currentColor" opacity="0.1" />
        <circle cx="50" cy="52" r="2.8" className="fill-primary" />
        {points.map(([x, y], index) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r="2.7"
            className="fill-foreground"
            opacity={0.62 + index * 0.04}
          />
        ))}
      </svg>
      <p className="text-xs leading-5 text-muted-foreground">
        {card.playableRate === null
          ? "No scored window yet"
          : `${card.playableRate}% playable in the current sample`}
      </p>
    </EvidenceVisual>
  );
}

function CarryConsistencyVisual({
  stockCarryYd,
  carrySpreadYd,
  score,
}: {
  stockCarryYd: number | null;
  carrySpreadYd: number | null;
  score: number;
}) {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const windowWidth = Math.max(16, 72 - normalizedScore * 0.48);

  return (
    <EvidenceVisual
      label="Carry consistency"
      value={stockCarryYd === null ? "Needs data" : `${stockCarryYd} yd stock`}
    >
      <div className="flex h-36 flex-col justify-center">
        <div className="relative h-3 rounded-full bg-muted">
          <div
            className="absolute top-0 h-3 rounded-full bg-primary/25 ring-1 ring-primary/45"
            style={{ left: `${50 - windowWidth / 2}%`, width: `${windowWidth}%` }}
          />
          <div className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-card" />
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Variable</span>
          <strong className="text-sm text-foreground">{Math.round(normalizedScore)} / 100</strong>
          <span>Repeatable</span>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {carrySpreadYd === null
          ? "Add comparable carry records"
          : `${Math.round(carrySpreadYd)} yd measured carry spread`}
      </p>
    </EvidenceVisual>
  );
}

function RoundResultVisual({
  latestRound,
}: {
  latestRound: CoachEvidenceBrowserData["latestRound"];
}) {
  const scoreToPar =
    latestRound && latestRound.totalScore !== null && latestRound.totalPar !== null
      ? latestRound.totalScore - latestRound.totalPar
      : null;

  return (
    <EvidenceVisual
      label="Round result"
      value={
        latestRound && latestRound.totalScore !== null
          ? `${latestRound.totalScore} ${formatScoreToPar(scoreToPar)}`
          : "No scored round"
      }
    >
      <div className="flex h-36 items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center rounded-full border-[10px] border-primary/15 text-center">
          <span>
            <strong className="block text-3xl tracking-tight">
              {latestRound?.totalScore ?? "–"}
            </strong>
            <span className="text-xs text-muted-foreground">
              {latestRound?.totalPar ? `par ${latestRound.totalPar}` : "score"}
            </span>
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {latestRound?.label ?? "Round evidence waiting"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {latestRound
              ? `${latestRound.holes} holes · ${dateFormatter.format(latestRound.date)}`
              : "Add a completed scorecard to connect practice with scoring."}
          </p>
        </div>
      </div>
      <Link
        href="/rounds"
        prefetch={false}
        className="text-xs font-semibold text-primary hover:underline"
      >
        Open round evidence
      </Link>
    </EvidenceVisual>
  );
}

function EvidenceVisual({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 py-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <Badge variant="outline">{value}</Badge>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function CoachingPriority({
  index,
  title,
  detail,
  href,
}: {
  index: number;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 border-b px-5 py-4 last:border-b-0 hover:bg-muted/35"
    >
      <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground">
        {index}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function CoachEvidenceBrowser({
  coach,
  evidence,
}: {
  coach: CoachSummary;
  evidence: CoachEvidenceBrowserData;
}) {
  const latestRound = evidence.latestRound;

  return (
    <section className="grid gap-5" data-coach-evidence-browser>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Evidence browser
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em]">Trace the coaching read</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">
          Move from the diagnosis to the measured sessions, clubs, rounds and source records behind
          it.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <EvidenceBrowserRow
          icon={<CalendarDays className="size-5" />}
          label="Sessions"
          value={`${evidence.sessionCount} recorded`}
          detail={
            evidence.latestSessionAt
              ? `Latest ${dateFormatter.format(evidence.latestSessionAt)}`
              : "No session evidence yet"
          }
          href="/sessions"
        />
        <EvidenceBrowserRow
          icon={<Crosshair className="size-5" />}
          label="Clubs"
          value={`${coach.summary.totals.clubs} tracked`}
          detail={`${coach.summary.totals.trackedCleanShots.toLocaleString("en-GB")} clean shots in the coach model`}
          href="/bag"
        />
        <EvidenceBrowserRow
          icon={<Target className="size-5" />}
          label="Rounds"
          value={`${evidence.roundCount} recorded`}
          detail={
            latestRound
              ? `${latestRound.label} · ${latestRound.totalScore ?? "scorecard incomplete"}`
              : "No round result available"
          }
          href="/rounds"
        />
        <EvidenceBrowserRow
          icon={<Gauge className="size-5" />}
          label="Confidence"
          value={`${coach.summary.totals.averageTrust}% bag trust`}
          detail="Sample size, consistency and playable outcomes determine confidence"
          href="/coach/diagnosis"
        />
        <EvidenceBrowserRow
          icon={<Database className="size-5" />}
          label="Source records"
          value={`${evidence.sourceRecordCount.toLocaleString("en-GB")} shots`}
          detail={sourceSummary(evidence.sources)}
          href="/shots"
        />
      </div>
    </section>
  );
}

function EvidenceBrowserRow({
  icon,
  label,
  value,
  detail,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group grid gap-3 border-b p-5 last:border-b-0 hover:bg-muted/35 sm:grid-cols-[2.5rem_minmax(10rem,0.7fr)_minmax(12rem,1fr)_auto] sm:items-center"
    >
      <span className="grid size-10 place-items-center rounded-lg bg-muted text-foreground">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-1 block text-xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
      </span>
      <span className="text-sm leading-6 text-muted-foreground">{detail}</span>
      <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function CoachAsk({
  canUseDataChat,
  monthlyRemaining,
}: {
  canUseDataChat: boolean;
  monthlyRemaining: number;
}) {
  return (
    <section data-coach-ask-workspace aria-labelledby="coach-data-chat-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <StatusPill tone={canUseDataChat ? "green" : "amber"}>Data Chat</StatusPill>
          <h1
            id="coach-data-chat-heading"
            className="mt-4 text-3xl font-semibold tracking-[-0.025em]"
          >
            Ask your data
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue the coaching conversation without leaving this workspace.
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {monthlyRemaining.toLocaleString("en-GB")} credits remaining
        </span>
      </div>
      {canUseDataChat ? (
        <LazyCoachDataChatPanel monthlyRemaining={monthlyRemaining} />
      ) : (
        <Alert className="border-[var(--status-warning-border)] bg-[var(--status-warning-surface)]">
          <ShieldCheck className="size-4" />
          <AlertTitle>Data Chat is included with Pro AI access</AlertTitle>
          <AlertDescription className="mt-2">
            The deterministic diagnosis remains available. Upgrade to ask cited questions directly
            inside Coach.
          </AlertDescription>
          <Button asChild className="mt-4" size="sm">
            <Link href="/billing">View plans</Link>
          </Button>
        </Alert>
      )}
    </section>
  );
}

function DiagnosisRail({ coach, topClub }: { coach: CoachSummary; topClub: CoachClubCard | null }) {
  return (
    <RailPanel eyebrow="Coach's read" title={topClub ? topClub.clubName : "Baseline needed"}>
      <RailMetric label="Main signal" value={topClub?.issueLabel ?? "Not enough data"} />
      <RailMetric label="Confidence" value={topClub ? `${topClub.trustIndex}%` : "Low"} />
      <RailMetric label="Bag trust" value={`${coach.summary.totals.averageTrust}%`} />
      <div className="border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Coaching principle
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground/80">
          Change one priority at a time, then retest it with comparable measured shots.
        </p>
      </div>
    </RailPanel>
  );
}

function EvidenceRail({
  coach,
  evidence,
}: {
  coach: CoachSummary;
  evidence: CoachEvidenceBrowserData;
}) {
  return (
    <RailPanel eyebrow="Coverage" title="Evidence quality">
      <RailMetric label="Sessions" value={evidence.sessionCount.toLocaleString("en-GB")} />
      <RailMetric label="Clubs" value={coach.summary.totals.clubs.toLocaleString("en-GB")} />
      <RailMetric label="Rounds" value={evidence.roundCount.toLocaleString("en-GB")} />
      <RailMetric label="Source shots" value={evidence.sourceRecordCount.toLocaleString("en-GB")} />
      <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
        Confidence is reported separately from the diagnosis. Missing evidence remains missing
        rather than being estimated.
      </p>
    </RailPanel>
  );
}

function RailPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4" data-coach-context-rail>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function RailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <strong className="text-sm text-foreground">{value}</strong>
    </div>
  );
}

function MobileCoachSummary({
  coach,
  topClub,
}: {
  coach: CoachSummary;
  topClub: CoachClubCard | null;
}) {
  return (
    <MobileAppShell>
      <MobileTopBar title="Coach" />
      {topClub ? (
        <main className="grid gap-5 px-4 pb-8 pt-3" data-mobile-coach-summary>
          <section className="rounded-[1.4rem] border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Main diagnosis
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {topClub.trustIndex}% confidence
              </span>
            </div>
            <p className="mt-6 text-sm font-medium text-muted-foreground">
              Your biggest scoring opportunity is…
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-balance">
              {topClub.clubName} {topClub.issueLabel.toLowerCase()}
            </h1>
            <div className="mt-6 border-t pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Why
              </p>
              <p className="mt-2 text-base leading-7 text-foreground/85">{topClub.reason}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {whyItMatters(topClub)}
              </p>
            </div>
            <Button asChild className="mt-6 min-h-12 w-full rounded-xl">
              <Link href={practiceHref("latest_weakness")} prefetch={false}>
                <Crosshair className="size-4" />
                Build practice plan
              </Link>
            </Button>
          </section>
        </main>
      ) : (
        <main className="px-4 pb-8 pt-3">
          <AppEmptyState
            icon={<Brain className="size-5" />}
            title="Your coach needs a measured baseline"
            description={coach.subhead}
            primaryAction={
              <Button asChild>
                <Link href="/import" prefetch={false}>
                  <Upload className="size-4" />
                  Import data
                </Link>
              </Button>
            }
          />
        </main>
      )}
    </MobileAppShell>
  );
}

function CoachEmptyState() {
  return (
    <AppEmptyState
      icon={<Brain className="size-5" />}
      title="Diagnosis is waiting for measured data"
      description="Import a comparable launch-monitor session to establish one reliable coaching priority."
      primaryAction={
        <Button asChild>
          <Link href="/import" prefetch={false}>
            <Upload className="size-4" />
            Import data
          </Link>
        </Button>
      }
    />
  );
}

function parseCoachTab(value: string | string[] | undefined): CoachTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "evidence" || tab === "ask" ? tab : "diagnosis";
}

function practiceHref(intent: "latest_weakness" | "confidence" | "scoring") {
  return `/practice?time=30&intent=${intent}&energy=normal&session=range&balls=50`;
}

function whyItMatters(card: CoachClubCard) {
  if (card.issue === "direction")
    return "Wide start lines turn ordinary swings into recovery shots and make targets feel smaller.";
  if (card.issue === "distance")
    return "An unreliable carry window makes club selection harder and brings more hazards into play.";
  if (card.issue === "strike")
    return "Unstable contact changes both distance and shape, so the miss is difficult to plan around.";
  if (card.issue === "launch")
    return "An inconsistent flight window changes stopping power and makes the same yardage play differently.";
  if (card.issue === "delivery")
    return "A wider delivery window creates two-way misses and removes a dependable stock shape.";
  return "The sample is too light for a responsible technical change. Build evidence before changing the swing.";
}

function confidenceDetail(card: CoachClubCard) {
  if (card.trustIndex >= 70 && card.sampleSize >= 12)
    return "Strong enough to guide the next focused block.";
  if (card.trustIndex >= 50 && card.sampleSize >= 5)
    return "Useful direction, with another comparable session needed to confirm it.";
  return "Treat this as an early signal and retest before making a major change.";
}

function coachEvidenceConfidence(card: CoachClubCard) {
  if (card.trustIndex >= 70 && card.sampleSize >= 12) return "High confidence";
  if (card.trustIndex >= 50 && card.sampleSize >= 5) return "Developing confidence";
  return "Early signal";
}

function improvingSignal(coach: CoachSummary) {
  const improving = coach.trainingImpact.find((impact) => impact.status === "better");
  if (improving) return { title: `${improving.clubName} is moving`, detail: improving.detail };

  const signal: ProgressSignal | undefined = coach.signals[0];
  if (signal) return { title: signal.label, detail: signal.detail };

  return {
    title: "The baseline is becoming clearer",
    detail:
      "No confirmed improvement yet. Keep the next session comparable so progress can be measured honestly.",
  };
}

function sourceSummary(sources: CoachEvidenceBrowserData["sources"]) {
  if (sources.length === 0) return "No imported source records";
  return sources
    .slice(0, 3)
    .map((source) => `${source.source} · ${source.sessionCount}`)
    .join("  /  ");
}

function formatScoreToPar(scoreToPar: number | null) {
  if (scoreToPar === null) return "";
  if (scoreToPar === 0) return "(E)";
  return `(${scoreToPar > 0 ? "+" : ""}${scoreToPar})`;
}
