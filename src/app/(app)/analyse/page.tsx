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
import { RecommendedAction } from "@/components/app/evidence-status";
import { AnalyseProvenancePanel } from "@/app/analyse/analyse-provenance-panel";
import { AppCommandContentTrigger } from "@/components/app/app-command-trigger";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        description="See the strength of your evidence, the clearest signal, and what to open next."
        actions={
          <Button asChild className="premium-action hidden min-h-11 rounded-xl lg:inline-flex">
            <Link href={nextAction.href}>
              {nextAction.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <MobileAnalyseOverview data={data} nextAction={nextAction} />

      <div className="hidden lg:block">
        <Tabs defaultValue="overview" className="grid min-w-0 gap-5" data-analyse-workspace-tabs>
          <TabsList variant="line" aria-label="Analyse workspace">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="shots">Shots</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="data-quality">Data Quality</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid min-w-0 gap-5">
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
              <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {confidenceExplanation(data.confidence.label)}
                </p>
                <AnalyseProvenancePanel
                  trustedShots={data.trustedShots}
                  sessions={data.sessionCount}
                  activeClubs={data.clubCount}
                  excludedShots={data.excludedShots}
                  dateRange={data.dateRange}
                  explanation={confidenceExplanation(data.confidence.label)}
                />
              </CardContent>
            </Card>

            <ConnectedMetricBar
              label="Analyse evidence coverage"
              metrics={[
                {
                  label: "Trusted shots",
                  value: data.trustedShots.toLocaleString("en-GB"),
                  detail: data.dateRange,
                },
                {
                  label: "Sessions",
                  value: data.sessionCount.toLocaleString("en-GB"),
                  detail: "Measured session history",
                },
                {
                  label: "Active clubs",
                  value: data.clubCount.toLocaleString("en-GB"),
                  detail: "Coverage in the active bag",
                },
              ]}
            />

            <Alert className="border-amber-200 bg-amber-50/60 px-4 py-3 text-amber-950">
              <ShieldCheck className="size-5" aria-hidden />
              <AlertTitle>Data health</AlertTitle>
              <AlertDescription className="text-amber-900">
                {data.excludedShots > 0
                  ? `${data.excludedShots} shot${data.excludedShots === 1 ? " is" : "s are"} excluded from trusted record evidence by quality, category or source rules.`
                  : data.totalShots > 0
                    ? "No current shots are excluded by the trusted-record rules."
                    : "No launch-monitor evidence has been imported yet."}
              </AlertDescription>
            </Alert>

            <RecommendedAction
              title={nextAction.label}
              detail={nextAction.detail}
              href={nextAction.href}
              actionLabel={nextAction.label}
            />
          </TabsContent>

          <TabsContent value="compare">
            <AnalyseDestinationList
              title="Compare performance"
              items={[
                {
                  icon: BarChart3,
                  title: "Compare sessions and periods",
                  detail: "Use matched evidence and sample confidence before accepting a change.",
                  href: "/analyse/compare",
                },
                {
                  icon: TrendingUp,
                  title: "Review long-term progress",
                  detail: "Separate performance, consistency and volume from one another.",
                  href: "/progress",
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="shots">
            <AnalyseDestinationList
              title="Inspect measured shots"
              items={[
                {
                  icon: Target,
                  title: "Open Shot Explorer",
                  detail: "Filter dispersion, direction and shot outcomes at row level.",
                  href: "/shots",
                },
                {
                  icon: ShieldCheck,
                  title: "Review club confidence",
                  detail: `${confidenceDisplayLabel(data.confidence.label)} across ${data.clubCount} active clubs.`,
                  href: "/bag",
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="conditions">
            <AnalyseDestinationList
              title="Compare conditions"
              items={[
                {
                  icon: CloudSun,
                  title: "Open condition analysis",
                  detail:
                    "Keep venue, weather, surface and ball samples separate before accepting a carry difference.",
                  href: "/analyse/conditions",
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="data-quality" className="grid gap-5">
            <AppCommandContentTrigger label="Search data-quality actions" className="max-w-md" />
            <AnalyseDestinationList
              title="Manage analysis evidence"
              items={[
                {
                  icon: Database,
                  title: "Open analysis workspace",
                  detail: "Fix data issues, add context and preserve point-in-time snapshots.",
                  href: "/analyse/workspace",
                },
                {
                  icon: Target,
                  title: "Test session impact",
                  detail: "See whether one shot or trust filter is changing the story.",
                  href: "/analyse/session-impact",
                },
                {
                  icon: Brain,
                  title: "Build the next practice action",
                  detail: "Turn the measured weakness into a success threshold.",
                  href: "/coach",
                },
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

function MobileAnalyseOverview({
  data,
  nextAction,
}: {
  data: Awaited<ReturnType<typeof getAnalyseOverview>>;
  nextAction: { href: string; label: string; detail: string };
}) {
  const questions = [
    {
      icon: TrendingUp,
      label: "What is improving?",
      detail: "Performance, consistency and volume trends",
      value: "Progress",
      href: "/progress",
    },
    {
      icon: BarChart3,
      label: "What is getting worse?",
      detail: "Compare matched sessions before accepting a decline",
      value: "Compare",
      href: "/analyse/compare",
    },
    {
      icon: Target,
      label: "Which pattern costs the most?",
      detail: "Inspect dispersion, direction and shot outcomes",
      value: "Shots",
      href: "/shots",
    },
    {
      icon: ShieldCheck,
      label: "How confident is the system?",
      detail: `${data.sessionCount} session${data.sessionCount === 1 ? "" : "s"} · ${data.trustedShots} trusted shots`,
      value: confidenceDisplayLabel(data.confidence.label),
      href: "/bag",
    },
    {
      icon: Brain,
      label: "What should I practise next?",
      detail: "Turn the measured weakness into a success threshold",
      value: "Coach",
      href: "/coach",
    },
    {
      icon: CloudSun,
      label: "Do conditions change the result?",
      detail: "Keep venue, weather, surface and ball samples separate",
      value: "Conditions",
      href: "/analyse/conditions",
    },
  ];

  return (
    <div className="grid min-w-0 gap-4 lg:hidden">
      <section className="ios-grouped-list min-w-0 overflow-hidden px-4 py-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-primary">Primary insight</p>
            <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight">
              {confidenceHeadline(data.confidence.label)}
            </h2>
          </div>
          <IOSInlineStatus
            label={confidenceDisplayLabel(data.confidence.label)}
            tone={data.confidence.label === "early" ? "attention" : "positive"}
            className="shrink-0"
          />
        </div>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{nextAction.detail}</p>
        <Button asChild className="mt-4 min-h-11 w-full rounded-xl">
          <Link href={nextAction.href}>
            {nextAction.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </section>

      <section className="grid gap-2" aria-labelledby="mobile-analysis-evidence">
        <IOSSectionHeader
          title={<span id="mobile-analysis-evidence">Evidence coverage</span>}
          description="The numbers supporting the current analysis."
        />
        <IOSGroupedList>
          <IOSMetricRow
            label="Trusted shots"
            value={data.trustedShots.toLocaleString("en-GB")}
            detail={data.dateRange}
          />
          <IOSMetricRow
            label="Sessions"
            value={data.sessionCount.toLocaleString("en-GB")}
            detail="Measured session history"
          />
          <IOSMetricRow
            label="Active clubs"
            value={data.clubCount.toLocaleString("en-GB")}
            detail="Clubs with evidence in the active bag"
          />
          <IOSListRow
            icon={ShieldCheck}
            label="Data health"
            detail={
              data.totalShots > 0
                ? "Review quality, category and source rules"
                : "Import measured data to begin analysis"
            }
            status={
              <IOSInlineStatus
                label={
                  data.excludedShots > 0
                    ? `${data.excludedShots} excluded · review`
                    : "Evidence checked"
                }
                tone={data.excludedShots > 0 ? "attention" : "positive"}
              />
            }
            href="/analyse/workspace"
          />
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-labelledby="mobile-analysis-questions">
        <IOSSectionHeader
          title={<span id="mobile-analysis-questions">Choose a question</span>}
          description="Open only the evidence needed for the decision."
        />
        <IOSGroupedList>
          {questions.map((question) => (
            <IOSListRow key={question.href} {...question} />
          ))}
          <IOSListRow
            icon={ClipboardCheck}
            label="Where is the next action?"
            detail={nextAction.detail}
            value="Practice"
            href="/practice"
          />
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-labelledby="mobile-analysis-tools">
        <IOSSectionHeader title={<span id="mobile-analysis-tools">Evidence tools</span>} />
        <IOSGroupedList>
          <IOSListRow
            icon={Database}
            label="Analysis workspace"
            detail="Fix data issues, add context and preserve snapshots"
            href="/analyse/workspace"
          />
          <IOSListRow
            icon={Target}
            label="Session impact"
            detail="Test how filters or one shot change the result"
            href="/analyse/session-impact"
          />
        </IOSGroupedList>
      </section>
    </div>
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

function AnalyseDestinationList({
  title,
  items,
}: {
  title: string;
  items: Array<{ icon: typeof Database; title: string; detail: string; href: string }>;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border bg-card"
      aria-labelledby={`analyse-${title}`}
    >
      <div className="border-b px-4 py-3">
        <h2 id={`analyse-${title}`} className="font-semibold">
          {title}
        </h2>
      </div>
      <nav aria-label={title}>
        {items.map(({ icon: Icon, title: itemTitle, detail, href }) => (
          <Link
            key={href}
            href={href}
            className="focus-aaa flex min-h-16 items-center gap-3 border-b px-4 py-3 outline-none last:border-b-0 hover:bg-muted/40"
          >
            <Icon className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{itemTitle}</span>
              <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{detail}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </nav>
    </section>
  );
}
