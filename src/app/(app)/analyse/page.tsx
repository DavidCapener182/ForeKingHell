import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  ClipboardCheck,
  CloudSun,
  Database,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { and, count, desc, eq, sql } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MetricEvidenceDrawer,
  RecommendedAction,
  type ProductConfidence,
} from "@/components/app/evidence-status";
import { AnalysisPageTemplate } from "@/components/app/analysis-page-template";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  analysisConfidence,
  confidenceDisplayLabel,
  type AnalysisConfidenceLabel,
} from "@/lib/analysis-confidence";
import { excludedRecordQualityTags, excludedRecordShotCategories } from "@/lib/shot-records";
import { formatSessionDateRange, validSessionDate } from "@/lib/session-date-range";

export const dynamic = "force-dynamic";

export default async function AnalysePage() {
  const data = await getAnalyseOverview();
  const nextAction =
    data.totalShots === 0
      ? {
          href: "/import",
          label: "Import a session",
          detail: "Analysis begins with measured data.",
        }
      : {
          href: data.latestSessionId ? `/today?session=${data.latestSessionId}` : "/today",
          label: "Review latest session",
          detail: "Start with the newest evidence before opening long-term trends.",
        };

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Evidence hub</StatusPill>}
        title="Analyse"
        description="See what the data can support, where the strongest signal lives, and which evidence page to open next."
        actions={
          <Button asChild className="premium-action min-h-11 rounded-xl">
            <Link href={nextAction.href}>
              {nextAction.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <AnalysisPageTemplate
        answer={
          <Card className="premium-card overflow-hidden">
            <CardHeader className="border-b border-border/70 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Primary insight</p>
                  <CardTitle className="mt-1 text-2xl tracking-tight">
                    {confidenceHeadline(data.confidence.label)}
                  </CardTitle>
                </div>
                <ConfidenceBadge confidence={data.confidence.label} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <MetricEvidenceDrawer
                label="Trusted shots"
                value={data.trustedShots.toLocaleString("en-GB")}
                confidence={confidenceToProduct(data.confidence.label)}
                evidence={{
                  measuredShots: data.trustedShots,
                  sessions: data.sessionCount,
                  dateRange: data.dateRange,
                  excludedShots: data.excludedShots,
                  source: "Measured launch-monitor imports",
                  explanation: confidenceExplanation(data.confidence.label),
                }}
              />
              <MetricEvidenceDrawer
                label="Sessions"
                value={data.sessionCount.toLocaleString("en-GB")}
                confidence={confidenceToProduct(data.confidence.label)}
                evidence={{
                  measuredShots: data.trustedShots,
                  sessions: data.sessionCount,
                  dateRange: data.dateRange,
                  source: "Session history",
                  explanation: confidenceExplanation(data.confidence.label),
                }}
              />
              <MetricEvidenceDrawer
                label="Active clubs"
                value={data.clubCount.toLocaleString("en-GB")}
                confidence={data.clubCount > 0 ? "Moderate confidence" : "Insufficient evidence"}
                evidence={{
                  measuredShots: data.trustedShots,
                  sessions: data.sessionCount,
                  dateRange: data.dateRange,
                  source: "Active bag and measured shots",
                  explanation:
                    data.clubCount > 0
                      ? "Club coverage is available, but confidence still varies by club and sample size."
                      : "Add clubs or import a measured session before relying on bag coverage.",
                }}
              />
            </CardContent>
          </Card>
        }
        dataWarning={
          <aside className="ios-grouped-list rounded-2xl border border-border bg-secondary/55 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              <h2 className="font-semibold">Data health</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {data.excludedShots > 0
                ? `${data.excludedShots} shot${data.excludedShots === 1 ? " is" : "s are"} excluded from trusted record evidence by quality, category or source rules.`
                : data.totalShots > 0
                  ? "No current shots are excluded by the trusted-record rules."
                  : "No launch-monitor evidence has been imported yet."}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Confidence drivers:{" "}
              {data.confidence.components
                .map((item) => `${item.label} ${item.assessment}`)
                .join(" · ")}
            </p>
            <Button asChild variant="outline" className="mt-4 min-h-11 w-full rounded-xl">
              <Link href="/analyse/workspace">
                Open Data Quality Inbox
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </aside>
        }
        recommendation={
          <RecommendedAction
            title={nextAction.label}
            detail={nextAction.detail}
            href={nextAction.href}
            actionLabel={nextAction.label}
          />
        }
      >
        <section aria-labelledby="analysis-questions" className="grid gap-3">
          <div>
            <h2 id="analysis-questions" className="text-2xl font-semibold tracking-tight">
              Answer the useful questions
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Each route opens the detailed evidence; this page does not duplicate every chart.
            </p>
          </div>
          <div className="ios-grouped-list grid overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-2 xl:grid-cols-3">
            <AnalysisRoute
              icon={TrendingUp}
              question="What is improving?"
              answer="Compare performance, consistency and volume without treating more shots as improvement."
              href="/progress"
              label="Open Progress"
            />
            <AnalysisRoute
              icon={BarChart3}
              question="What is getting worse?"
              answer="Use club-level trend evidence and sample confidence before accepting a decline."
              href="/analyse/compare"
              label="Compare sessions"
            />
            <AnalysisRoute
              icon={Target}
              question="Which pattern costs the most?"
              answer="Inspect dispersion, direction and shot outcomes at row level."
              href="/shots"
              label="Explore shots"
            />
            <AnalysisRoute
              icon={ShieldCheck}
              question="How confident is the system?"
              answer={`${confidenceDisplayLabel(data.confidence.label)} from ${data.sessionCount} session${data.sessionCount === 1 ? "" : "s"} and ${data.trustedShots} trusted shots.`}
              href="/bag"
              label="Review club confidence"
            />
            <AnalysisRoute
              icon={Brain}
              question="What should I practise next?"
              answer="Recommendations must cite your measured weakness and define a success threshold."
              href="/coach"
              label="Open Coach"
            />
            <AnalysisRoute
              icon={ClipboardCheck}
              question="Where is the next action?"
              answer={nextAction.detail}
              href="/practice"
              label="Build practice plan"
            />
            <AnalysisRoute
              icon={CloudSun}
              question="Do conditions change the result?"
              answer="Keep course, range, weather, surface and ball samples separate before accepting a carry difference."
              href="/analyse/conditions"
              label="Compare conditions"
            />
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-semibold">Manage the evidence behind the analysis</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Fix data-quality issues, add contextual notes, compare equipment periods and preserve
              point-in-time snapshots.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-11 shrink-0 rounded-xl">
            <Link href="/analyse/workspace">
              Open analysis workspace
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-semibold">Test whether one shot is changing the story</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Compare the raw session with trusted, misread and percentile filters without changing
              the source data.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-11 shrink-0 rounded-xl">
            <Link href="/analyse/session-impact">
              Open session impact
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </section>
      </AnalysisPageTemplate>
    </PageShell>
  );
}

async function getAnalyseOverview() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const excludedQualityValues = sql.join(
    excludedRecordQualityTags.map((tag) => sql`${tag}`),
    sql`, `,
  );
  const excludedCategoryValues = sql.join(
    excludedRecordShotCategories.map((category) => sql`${category}`),
    sql`, `,
  );
  const [shotCounts, sessionCounts, clubCounts, latestSessions] = await Promise.all([
    db
      .select({
        total: count(shots.id),
        trusted: sql<number>`count(*) filter (where
          lower(coalesce(${shots.qualityTag}, '')) not in (${excludedQualityValues})
          and lower(coalesce(${shots.shotCategory}, '')) not in (${excludedCategoryValues})
          and lower(${sessions.source}) not in ('manual', 'manual_edit')
        )::int`,
        complete: sql<number>`count(*) filter (where ${shots.carryYd} is not null and ${shots.sideCarryYd} is not null)::int`,
        carryCv: sql<number | null>`(
          stddev_samp(${shots.carryYd}) / nullif(abs(avg(${shots.carryYd})), 0)
        )::float`,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(and(eq(shots.userId, userId), eq(sessions.userId, userId))),
    db
      .select({
        total: count(sessions.id),
        earliest: sql<Date | null>`min(${sessions.date})`,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId)),
    db
      .select({ total: count(clubs.id) })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true))),
    db
      .select({ id: sessions.id, date: sessions.date })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.date))
      .limit(1),
  ]);

  const totalShots = Number(shotCounts[0]?.total ?? 0);
  const trustedShots = Number(shotCounts[0]?.trusted ?? 0);
  const sessionCount = Number(sessionCounts[0]?.total ?? 0);
  const latestSessionDate = validSessionDate(latestSessions[0]?.date);

  return {
    totalShots,
    trustedShots,
    excludedShots: Math.max(0, totalShots - trustedShots),
    sessionCount,
    clubCount: Number(clubCounts[0]?.total ?? 0),
    latestSessionId: latestSessions[0]?.id ?? null,
    dateRange: formatSessionDateRange(sessionCounts[0]?.earliest ?? null, latestSessionDate),
    confidence: analysisConfidence({
      sampleSize: trustedShots,
      sessionCount,
      recencyDays: latestSessionDate
        ? Math.max(0, (Date.now() - latestSessionDate.getTime()) / 86_400_000)
        : null,
      outlierRate: totalShots ? Math.max(0, totalShots - trustedShots) / totalShots : 1,
      metricCompleteness: totalShots ? Number(shotCounts[0]?.complete ?? 0) / totalShots : 0,
      coefficientOfVariation:
        shotCounts[0]?.carryCv === null || shotCounts[0]?.carryCv === undefined
          ? null
          : Math.abs(Number(shotCounts[0].carryCv)),
      crossSessionConsistency: null,
    }),
  };
}

function confidenceToProduct(confidence: AnalysisConfidenceLabel): ProductConfidence {
  return confidence === "strong"
    ? "High confidence"
    : confidence === "reliable"
      ? "Moderate confidence"
      : confidence === "developing"
        ? "Low confidence"
        : "Insufficient evidence";
}

function confidenceExplanation(confidence: AnalysisConfidenceLabel) {
  return confidence === "strong"
    ? "The sample is recent, complete and broad enough to support repeatable comparisons."
    : confidence === "reliable"
      ? "The sample can support decisions, but club and context coverage should still be checked."
      : confidence === "developing"
        ? "A pattern is visible, but another measured session would reduce the risk of reacting to noise."
        : "There is not enough recent, trusted evidence to make a reliable change claim yet.";
}

function confidenceHeadline(confidence: AnalysisConfidenceLabel) {
  return confidence === "early"
    ? "Build the evidence before making a swing-change claim"
    : confidence === "developing"
      ? "Patterns are emerging; verify them across another session"
      : confidence === "reliable"
        ? "There is enough evidence for club-level trend decisions"
        : "Your history can support strong, repeatable comparisons";
}

function ConfidenceBadge({ confidence }: { confidence: AnalysisConfidenceLabel }) {
  return (
    <StatusPill
      tone={confidence === "early" ? "amber" : confidence === "developing" ? "sky" : "green"}
    >
      {confidenceDisplayLabel(confidence)}
    </StatusPill>
  );
}

function AnalysisRoute({
  icon: Icon,
  question,
  answer,
  href,
  label,
}: {
  icon: typeof Database;
  question: string;
  answer: string;
  href: string;
  label: string;
}) {
  return (
    <article className="ios-grouped-row flex min-h-0 flex-col border-b border-r border-border p-4 sm:min-h-52 sm:p-5">
      <Icon className="size-5 text-primary" aria-hidden />
      <h3 className="mt-3 text-lg font-semibold">{question}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{answer}</p>
      <Link
        href={href}
        className="focus-aaa mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-primary outline-none"
      >
        {label}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </article>
  );
}
