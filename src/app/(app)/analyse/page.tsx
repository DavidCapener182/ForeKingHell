import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
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
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
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
          <Button asChild className="premium-action min-h-11 rounded-xl">
            <Link href={nextAction.href}>
              {nextAction.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <div>
        {data.totalShots === 0 ? (
          <AppEmptyState
            icon={<Database className="size-6" aria-hidden />}
            title="Import measured evidence to start analysis"
            description="Analysis, comparisons and coaching recommendations stay unavailable until a trusted launch-monitor session is present."
            primaryAction={
              <Button asChild>
                <Link href="/import">Import a session</Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="outline">
                <Link href="/providers">Connect a provider</Link>
              </Button>
            }
          />
        ) : (
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

              <Alert className="border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] px-4 py-3 text-[var(--status-warning-foreground)]">
                <ShieldCheck className="size-5" aria-hidden />
                <AlertTitle>Data health</AlertTitle>
                <AlertDescription>
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
                  {
                    icon: Target,
                    title: "Build a practice plan",
                    detail: "Turn the comparison evidence into one measured practice action.",
                    href: "/practice",
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
        )}
      </div>
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
    <Badge variant={confidence === "early" ? "outline" : "secondary"}>
      {confidenceDisplayLabel(confidence)}
    </Badge>
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
    <section className="grid gap-3" aria-labelledby={`analyse-${title}`}>
      <div>
        <h2 id={`analyse-${title}`} className="font-semibold">
          {title}
        </h2>
      </div>
      <nav aria-label={title} className="grid gap-2">
        {items.map(({ icon: Icon, title: itemTitle, detail, href }) => (
          <Link key={href} href={href} className="focus-aaa block rounded-xl outline-none">
            <Item className="min-h-16 hover:bg-muted/40">
              <ItemMedia>
                <Icon className="size-5 text-primary" aria-hidden />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{itemTitle}</ItemTitle>
                <ItemDescription className="whitespace-normal">{detail}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              </ItemActions>
            </Item>
          </Link>
        ))}
      </nav>
    </section>
  );
}
