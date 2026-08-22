import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { CheckCircle2, Crosshair, Database, ShieldCheck, Target, Upload } from "lucide-react";

import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { ResultHero } from "@/components/app/result-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import {
  DesktopWorkflowLayout,
  type DesktopWorkflowHelpItem,
  type DesktopWorkflowStep,
} from "@/components/app/desktop-workbench";
import { PageShell, StatusPill, type Tone } from "@/components/premium";
import { importFiles, importRows, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData, type FeatureIdeasData } from "@/lib/feature-ideas";
import {
  formatImportTriagePath,
  importFieldIssueCount,
  importSuggestionReviewHref,
  summarizePersistedImportShots,
} from "@/lib/import-result-triage";
import { getPracticePlanReviewForSourceSession } from "@/lib/practice-planner";
import { companionReviewRoute } from "@/lib/session-review-route";

export const dynamic = "force-dynamic";

type ImportResultPageProps = {
  searchParams?: Promise<{
    sessionId?: string;
  }>;
};

const integerFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type ImportResultData = Awaited<ReturnType<typeof getImportResultData>>;

export default async function ImportResultWorkbenchPage({ searchParams }: ImportResultPageProps) {
  const params = await searchParams;
  const sessionId = params?.sessionId;

  if (!sessionId) {
    notFound();
  }

  const [result, featureData] = await Promise.all([
    getImportResultData(sessionId),
    getFeatureIdeasData(),
  ]);
  const workflowSteps = importResultWorkflowSteps(result);
  const helpItems = importResultHelpItems(result, featureData);

  return (
    <PageShell>
      <DesktopWorkflowLayout
        steps={workflowSteps}
        helpTitle="Import audit"
        helpDescription="Receipt checks for the saved session"
        helpItems={helpItems}
      >
        <ResultHero
          eyebrow="Import saved"
          title="Import triage ready"
          summary={`${result.triagePath}.${
            result.fieldIssueCount > 0
              ? ` ${integerFormatter.format(result.fieldIssueCount)} impossible ${result.fieldIssueCount === 1 ? "field was" : "fields were"} quarantined without discarding the rest of the shot.`
              : ""
          } ${result.fileName ?? "CSV import"} saved on ${dateFormatter.format(result.date)} with raw rows preserved for audit.`}
          confidence={{
            label:
              result.triage.confirmationCount > 0
                ? `${integerFormatter.format(result.triage.confirmationCount)} to confirm`
                : "No mishits suggested",
            tone: result.triage.confirmationCount > 0 ? "outline" : "secondary",
          }}
          metrics={[
            {
              label: "Stock-quality",
              value: integerFormatter.format(result.triage.stockQualityCount),
            },
            {
              label: "Likely mishits",
              value: integerFormatter.format(result.triage.likelyMishitCount),
            },
            {
              label: "Partial shots",
              value: integerFormatter.format(result.triage.partialShotCount),
            },
            {
              label: "Needs review",
              value: integerFormatter.format(result.triage.needsReviewCount),
            },
          ]}
          action={
            <div className="flex flex-wrap gap-2">
              {result.triage.confirmationCount > 0 ? (
                <Button asChild className="premium-action rounded-lg">
                  <Link href={result.suggestionReviewHref} prefetch={false}>
                    <CheckCircle2 className="size-4" />
                    Confirm flagged shots
                  </Link>
                </Button>
              ) : (
                <Button asChild className="premium-action rounded-lg">
                  <Link href={companionReviewRoute(result)} prefetch={false}>
                    <CheckCircle2 className="size-4" />
                    Open session
                  </Link>
                </Button>
              )}
              {result.triage.confirmationCount > 0 ? (
                <Button asChild variant="outline" className="rounded-lg">
                  <Link href={companionReviewRoute(result)} prefetch={false}>
                    Open session
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="rounded-lg">
                <Link href="/import" prefetch={false}>
                  <Upload className="size-4" />
                  Import another
                </Link>
              </Button>
            </div>
          }
        />

        {result.practiceReview ? <PracticePlanReviewCard review={result.practiceReview} /> : null}

        <ConnectedMetricBar
          label="Import quality readback"
          metrics={[
            {
              label: "Imported",
              value: integerFormatter.format(result.shotCount),
              detail: "Normalised shot rows",
            },
            {
              label: "Stock-quality",
              value: integerFormatter.format(result.triage.stockQualityCount),
              detail: "Eligible full shots",
            },
            {
              label: "Needs confirmation",
              value: integerFormatter.format(result.triage.confirmationCount),
              detail: "Likely mishits and low-tail reviews",
            },
            {
              label: "Partial",
              value: integerFormatter.format(result.triage.partialShotCount),
              detail: "Useful short-game shots",
            },
          ]}
        />

        <Card data-import-trust-checks>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Data trust checks</CardTitle>
                <CardDescription>{featureData.dataHealth.detail}</CardDescription>
              </div>
              <StatusPill tone={featureData.dataHealth.tone}>
                {featureData.dataHealth.metric}
              </StatusPill>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {featureData.dataHealth.checks.slice(0, 4).map((check) => (
              <Link key={check.title} href={check.href ?? "/settings"} prefetch={false}>
                <Item variant="outline" className="h-full hover:bg-muted/55">
                  <ItemContent>
                    <ItemTitle>{check.title}</ItemTitle>
                    <ItemDescription className="whitespace-normal">{check.detail}</ItemDescription>
                  </ItemContent>
                  <StatusPill tone="slate">{check.metric}</StatusPill>
                </Item>
              </Link>
            ))}
          </CardContent>
        </Card>

        {featureData.practicePlan[0] ? (
          <PracticePrescriptionCard plan={featureData.practicePlan[0]} />
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <ResultAction
            href="/bag"
            icon={<Target className="size-4" />}
            title="Review bag confidence"
            detail="See carry numbers, trust percentages and gaps after the import."
          />
          <ResultAction
            href={`/shots?sessionId=${encodeURIComponent(result.id)}`}
            icon={<Database className="size-4" />}
            title="Audit shot rows"
            detail="Inspect normalized shots and preserved raw import rows."
          />
          <ResultAction
            href="/settings?section=offline#offline-storage"
            icon={<ShieldCheck className="size-4" />}
            title="Offline storage controls"
            detail="Review queued imports and clear temporary device storage."
          />
        </section>
      </DesktopWorkflowLayout>
    </PageShell>
  );
}

function importResultWorkflowSteps(result: ImportResultData): DesktopWorkflowStep[] {
  const needsConfirmation = result.triage.confirmationCount > 0;

  return [
    {
      title: "CSV saved",
      detail: `${integerFormatter.format(result.rawRowCount)} raw rows preserved for audit · ${integerFormatter.format(result.rawUnknownRowCount)} unknown.`,
      status: "complete",
      value: "Stored",
    },
    {
      title: "Quality check",
      detail: needsConfirmation
        ? `${integerFormatter.format(result.triage.likelyMishitCount)} likely ${result.triage.likelyMishitCount === 1 ? "mishit" : "mishits"} and ${integerFormatter.format(result.triage.needsReviewCount)} low-tail ${result.triage.needsReviewCount === 1 ? "shot need" : "shots need"} your confirmation; ${integerFormatter.format(result.triage.partialShotCount)} partial ${result.triage.partialShotCount === 1 ? "shot stays" : "shots stay"} separate from stock data.`
        : `${integerFormatter.format(result.triage.stockQualityCount)} stock-quality shots identified; no likely mishits need confirmation.`,
      status: "current",
      value: needsConfirmation ? "Review" : "Clear",
    },
    {
      title: "Session review",
      detail: "Open the imported session to inspect shot rows and scoring context.",
      status: "upcoming",
    },
    {
      title: "Practice decision",
      detail: "Use the updated bag map or practice prescription for the next measurable job.",
      status: "upcoming",
    },
  ];
}

function importResultHelpItems(
  result: ImportResultData,
  featureData: FeatureIdeasData,
): DesktopWorkflowHelpItem[] {
  return [
    {
      title: "Data confidence",
      detail: `${featureData.dataHealth.score}/100 · ${featureData.dataHealth.status}.`,
    },
    {
      title: "Raw audit",
      detail: `${integerFormatter.format(result.rawRowCount)} rows preserved · ${integerFormatter.format(result.rawUnknownRowCount)} unknown row ${result.rawUnknownRowCount === 1 ? "type" : "types"}.`,
    },
    {
      title: "Next evidence",
      detail:
        result.clubCount > 0
          ? `${integerFormatter.format(result.clubCount)} clubs updated in the bag map.`
          : "No clubs were updated; review the raw import mapping.",
    },
  ];
}

function PracticePlanReviewCard({
  review,
}: {
  review: NonNullable<Awaited<ReturnType<typeof getImportResultData>>["practiceReview"]>;
}) {
  return (
    <Card data-import-practice-review>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Planned practice review</CardTitle>
            <CardDescription>
              This import matched a saved Practice Planner session and was judged from shot data.
            </CardDescription>
          </div>
          <StatusPill tone={practiceScoreTone(review.score)}>{review.score}/100</StatusPill>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border bg-muted/45 p-4">
          <p className="text-sm font-semibold text-primary">Matched plan</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
            {review.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.verdict}</p>
          <p className="mt-3 text-sm font-medium text-foreground">{review.nextAction}</p>
          <Button asChild className="mt-4 premium-action rounded-lg">
            <Link href="/practice" prefetch={false}>
              <Target className="size-4" />
              Open planner
            </Link>
          </Button>
        </div>
        <div className="grid gap-2">
          {review.comparison?.decisions.slice(0, 4).map((decision) => (
            <div key={decision.blockId} className="rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{decision.title}</p>
                <StatusPill tone={practiceDecisionTone(decision.decision)}>
                  {decision.decision.replace("_", " ")}
                </StatusPill>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Target: {decision.target}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">Actual: {decision.actual}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function practiceScoreTone(score: number): Tone {
  if (score >= 80) {
    return "green";
  }

  if (score >= 60) {
    return "amber";
  }

  return "slate";
}

function practiceDecisionTone(
  decision: "maintain" | "repeat_once" | "keep_priority" | "move_down",
): Tone {
  if (decision === "maintain" || decision === "move_down") {
    return "green";
  }

  if (decision === "repeat_once") {
    return "amber";
  }

  return "slate";
}

function PracticePrescriptionCard({ plan }: { plan: FeatureIdeasData["practicePlan"][number] }) {
  return (
    <Card data-import-practice-prescription>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Next practice</CardTitle>
            <CardDescription>One measurable job to run after this import.</CardDescription>
          </div>
          <StatusPill tone={plan.status === "complete" ? "green" : "amber"}>
            {plan.targetShots} balls
          </StatusPill>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-lg border bg-muted/45 p-4">
          <p className="text-sm font-semibold text-primary">Prescription</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
            {plan.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.detail}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Item variant="outline">
              <ItemContent>
                <ItemTitle>{plan.targetShots} target balls</ItemTitle>
                <ItemDescription>Count every shot</ItemDescription>
              </ItemContent>
            </Item>
            <Item variant="outline">
              <ItemContent>
                <ItemTitle>Stock window</ItemTitle>
                <ItemDescription>Retest next session</ItemDescription>
              </ItemContent>
            </Item>
            <Item variant="outline">
              <ItemContent>
                <ItemTitle>{plan.focusArea.replace(/-/g, " ")}</ItemTitle>
                <ItemDescription>Keep it measurable</ItemDescription>
              </ItemContent>
            </Item>
          </div>
        </div>
        <Button asChild className="w-fit rounded-lg">
          <Link href={plan.clubId ? `/bag/${plan.clubId}/analytics` : "/coach"} prefetch={false}>
            <Crosshair className="size-4" />
            Open practice
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function getImportResultData(sessionId: string) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [session] = await db
    .select({
      id: sessions.id,
      type: sessions.type,
      date: sessions.date,
      fileName: sessions.fileName,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) {
    notFound();
  }

  const [sessionShotRows, rowStats, importReceiptRows, practiceReview] = await Promise.all([
    db
      .select({
        clubId: shots.clubId,
        reviewStatus: shots.reviewStatus,
        qualityTag: shots.qualityTag,
        shotCategory: shots.shotCategory,
      })
      .from(shots)
      .where(and(eq(shots.sessionId, session.id), eq(shots.userId, userId))),
    db
      .select({
        rawRowCount: count(importRows.id),
        rawUnknownRowCount: sql<number>`count(*) filter (where ${importRows.rowType} = 'unknown')::int`,
      })
      .from(importRows)
      .where(and(eq(importRows.sessionId, session.id), eq(importRows.userId, userId))),
    db
      .select({ metadataJson: importFiles.metadataJson })
      .from(importFiles)
      .where(
        and(
          eq(importFiles.sessionId, session.id),
          eq(importFiles.userId, userId),
          eq(importFiles.status, "saved"),
        ),
      )
      .orderBy(desc(importFiles.createdAt))
      .limit(1),
    getPracticePlanReviewForSourceSession(userId, session.id),
  ]);
  const triage = summarizePersistedImportShots(sessionShotRows);

  return {
    ...session,
    shotCount: triage.totalShotCount,
    clubCount: new Set(sessionShotRows.map((shot) => shot.clubId)).size,
    rawRowCount: Number(rowStats[0]?.rawRowCount ?? 0),
    rawUnknownRowCount: Number(rowStats[0]?.rawUnknownRowCount ?? 0),
    triage,
    triagePath: formatImportTriagePath(triage),
    fieldIssueCount: importFieldIssueCount(importReceiptRows[0]?.metadataJson),
    suggestionReviewHref: importSuggestionReviewHref(session.id),
    practiceReview,
  };
}

function ResultAction({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link href={href} prefetch={false}>
      <Item variant="outline" className="h-full hover:bg-muted/55">
        <ItemMedia className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
          {icon}
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription className="whitespace-normal">{detail}</ItemDescription>
        </ItemContent>
      </Item>
    </Link>
  );
}
