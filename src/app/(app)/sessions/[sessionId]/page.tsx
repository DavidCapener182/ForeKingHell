import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { MobileShotPatternCharts } from "@/components/app/mobile-shot-pattern-charts";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { ResultHero } from "@/components/app/result-hero";
import { IOSDisclosureGroup, IOSGroupedList, IOSListRow } from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { requireCurrentUserId } from "@/lib/current-user";
import { getPracticePlanForSourceSessions } from "@/lib/practice-planner";
import { buildShotPatternPoints, shotPatternConfidence } from "@/lib/shot-pattern-chart-data";
import { getTodayPracticeData } from "@/lib/today-session-data";

export const dynamic = "force-dynamic";

export default async function PracticeSessionReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const userId = await requireCurrentUserId();
  const data = await getTodayPracticeData({ sessionId });

  if (!data.sessions.some((session) => session.id === sessionId)) notFound();

  const plan = await getPracticePlanForSourceSessions(userId, [sessionId]);
  const comparisons = [...data.clubComparisons].sort((left, right) => left.score - right.score);
  const remaining = comparisons[0] ?? null;
  const improved =
    comparisons
      .filter((comparison) => comparison.verdict === "better")
      .sort((left, right) => right.score - left.score)[0] ?? null;
  const shots = data.shots.filter((shot) => shot.sessionId === sessionId);
  const patternPoints = buildShotPatternPoints(
    data.rawShots.filter((shot) => shot.sessionId === sessionId),
  );
  const preferredClub =
    plan?.comparisonSummary && plan.blocks[0]?.clubs[0]
      ? plan.blocks[0].clubs[0]
      : (remaining?.clubType ?? patternPoints[0]?.clubType ?? null);
  const focusConfidence = shotPatternConfidence(
    patternPoints.filter(
      (point) => point.trusted && (!preferredClub || point.clubType === preferredClub),
    ),
  );

  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-practice-session-review>
        <MobileTopBar title="Practice review" />

        <ResultHero
          eyebrow="Session verdict"
          title={data.overall.title}
          summary={data.overall.summary}
          confidence={{
            label: `${focusConfidence.label} confidence`,
            tone: focusConfidence.label === "Low" ? "outline" : "secondary",
          }}
        />

        <Card className="gap-3 py-3">
          <CardHeader className="px-3">
            <CardTitle>Shot pattern</CardTitle>
            <CardDescription>
              Dispersion first, with measured flight when apex data exists.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <MobileShotPatternCharts points={patternPoints} preferredClub={preferredClub} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>What changed</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Item variant="muted" size="sm">
              <ItemContent>
                <ItemTitle>What improved · {improved?.clubLabel ?? "Baseline built"}</ItemTitle>
                <ItemDescription className="whitespace-normal">
                  {improved?.summary ??
                    "There is no prior like-for-like baseline strong enough for an improvement claim."}
                </ItemDescription>
              </ItemContent>
            </Item>
            <Item variant="muted" size="sm">
              <ItemContent>
                <ItemTitle>What needs work · {remaining?.clubLabel ?? "Retest"}</ItemTitle>
                <ItemDescription className="whitespace-normal">
                  {remaining?.summary ?? "Repeat the same measured block before changing focus."}
                </ItemDescription>
              </ItemContent>
            </Item>
          </CardContent>
        </Card>

        <ConnectedMetricBar
          label="Four important numbers"
          className="grid-cols-2 [&>div:nth-child(2)]:border-l [&>div:nth-child(2)]:border-t-0"
          metrics={[
            { label: "Measured shots", value: String(shots.length) },
            { label: "Average carry", value: formatYards(data.overall.today.carryAverageYd) },
            { label: "Average offline", value: formatYards(data.overall.today.offlineAverageYd) },
            { label: "Playable rate", value: formatPercent(data.overall.today.playableRate) },
          ]}
        />

        <IOSDisclosureGroup
          label="Club summary"
          items={[
            {
              value: "clubs",
              title: "Club-by-club summary",
              summary: `${comparisons.length} clubs`,
              content: (
                <IOSGroupedList label="Club summaries" className="bg-card">
                  {comparisons.map((comparison) => (
                    <IOSListRow
                      key={comparison.clubType}
                      label={comparison.clubLabel}
                      value={comparison.verdict}
                      detail={`${comparison.today.shotCount} shots · ${formatPercent(comparison.today.playableRate)} playable`}
                    />
                  ))}
                </IOSGroupedList>
              ),
            },
            ...(plan
              ? [
                  {
                    value: "plan",
                    title: "Plan versus actual",
                    summary: plan.score === null ? "Measured" : `${plan.score}/100`,
                    description: plan.verdict,
                    content: (
                      <Card size="sm" data-plan-versus-actual>
                        <CardHeader>
                          <div>
                            <CardTitle>Measured plan result</CardTitle>
                            <CardDescription>{plan.verdict}</CardDescription>
                          </div>
                          <CardAction>
                            <Badge variant="secondary">
                              {plan.score === null ? "Measured" : `${plan.score}/100`}
                            </Badge>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                          <Progress
                            value={plan.score ?? 0}
                            aria-label={
                              plan.score === null
                                ? "Practice plan was measured without a numeric score"
                                : `Practice plan score: ${plan.score} out of 100`
                            }
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <PlanResultMetric label="Blocks" value={plan.totalBlocks} />
                            <PlanResultMetric label="Targets passed" value={plan.passedBlocks} />
                            <PlanResultMetric label="Mixed" value={plan.mixedBlocks} />
                            <PlanResultMetric
                              label="Needs evidence"
                              value={plan.incompleteBlocks}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ),
                  },
                ]
              : []),
          ]}
        />

        <ButtonGroup className="w-full">
          <Button asChild className="min-h-12 flex-1 rounded-xl text-base">
            <Link href="/practice?intent=latest_weakness">
              Build next plan
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
        </ButtonGroup>
      </MobileAppShell>
    </PageShell>
  );
}

function PlanResultMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/35 p-3">
      <p className="break-words text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatYards(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}
