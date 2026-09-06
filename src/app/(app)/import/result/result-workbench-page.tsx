import Link from "next/link";
import type { ReactNode } from "react";
import { ImportResultRecovery, ImportPracticeReview } from "@/app/import/import-result-sections";
import { UntitledPageHeader } from "@/components/untitled-ui/headers";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { Crosshair, Database, ShieldCheck, Target } from "lucide-react";

import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { PageShell, StatusPill } from "@/components/premium";
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

export default async function ImportResultWorkbenchPage({ searchParams }: ImportResultPageProps) {
  const params = await searchParams;
  const sessionId = params?.sessionId;

  if (
    !sessionId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)
  )
    return <ImportResultRecovery />;

  const [result, featureData] = await Promise.all([
    getImportResultData(sessionId),
    getFeatureIdeasData(),
  ]);
  if (!result) return <ImportResultRecovery />;

  return (
    <PageShell>
      <div className="grid min-w-0 gap-5">
        <UntitledPageHeader
          title="Import saved"
          description={`${result.shotCount} shots · ${result.clubCount} clubs · ${result.source}. ${result.fileName ?? "Session"} · ${dateFormatter.format(result.date)}`}
          actions={
            <Button asChild className="min-h-11">
              <Link href={companionReviewRoute(result)}>Open session</Link>
            </Button>
          }
        />
        {result.triage.confirmationCount > 0 || result.fieldIssueCount > 0 ? (
          <Alert>
            <AlertTitle>Review saved evidence</AlertTitle>
            <AlertDescription>
              <p>
                {result.triagePath}. {result.fieldIssueCount} quarantined fields; other measurements
                are retained.
              </p>
              <Button asChild variant="outline" className="mt-3 min-h-11">
                <Link href={result.suggestionReviewHref}>Confirm flagged shots</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {result.practiceReview ? (
          <ImportPracticeReview review={result.practiceReview} sessionId={result.id} />
        ) : (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            No matched practice review was found for this session. This receipt does not complete a
            plan.
          </p>
        )}
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

        <section className="rounded-xl border border-border bg-card p-4" data-import-trust-checks>
          <h2 className="text-lg font-semibold">Saved import evidence</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Counts below describe this saved session. Raw source rows include headers and non-shot
            records.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Saved shots", result.shotCount],
              ["Source rows", result.rawRowCount],
              ["Unknown source rows", result.rawUnknownRowCount],
              ["Stock-quality shots", result.triage.stockQualityCount],
              ["Confirmed exclusions", result.triage.confirmedExcludedCount],
              ["Whole-shot unusable", result.triage.launchMonitorErrorCount],
              ["Needs confirmation", result.triage.confirmationCount],
              ["Quarantined fields", result.fieldIssueCount],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <Button asChild variant="outline" className="mt-4 min-h-11">
            <Link href={`/shots?sessionId=${encodeURIComponent(result.id)}`}>
              Inspect saved and excluded rows
            </Link>
          </Button>
        </section>

        {featureData.practicePlan[0] ? (
          <PracticePrescriptionCard plan={featureData.practicePlan[0]} sessionId={result.id} />
        ) : null}

        <section className="grid divide-y divide-border rounded-xl border border-border">
          <ResultAction
            href={`/bag?sourceSessionId=${encodeURIComponent(result.id)}&source=import`}
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
      </div>
    </PageShell>
  );
}

function PracticePrescriptionCard({
  plan,
  sessionId,
}: {
  plan: FeatureIdeasData["practicePlan"][number];
  sessionId: string;
}) {
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
          <p className="mt-2 text-lg font-semibold tracking-normal text-foreground">{plan.title}</p>
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
          <Link
            href={`/practice?source=import&sourceSessionId=${encodeURIComponent(sessionId)}&intent=latest_weakness`}
            prefetch={false}
          >
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
      source: sessions.source,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) return null;

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
