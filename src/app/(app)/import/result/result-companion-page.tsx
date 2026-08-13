import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Database, Target } from "lucide-react";

import { MobileShotPatternCharts } from "@/components/app/mobile-shot-pattern-charts";
import { ResultHero } from "@/components/app/result-hero";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getCompanionImportResult } from "@/lib/companion-import-result";

export default async function ImportResultCompanionPage({
  searchParams,
}: {
  searchParams?: Promise<{ sessionId?: string }>;
}) {
  const sessionId = (await searchParams)?.sessionId;
  if (!sessionId) notFound();
  const result = await getCompanionImportResult(sessionId);
  if (!result) notFound();

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-companion-import-result>
        <MobileTopBar title="Import complete" />

        <div data-session-verdict>
          <ResultHero
            eyebrow="Import complete"
            title={result.verdict.title}
            summary={
              <div className="grid gap-3">
                <p>{result.verdict.summary}</p>
                {result.practiceReview ? (
                  <div className="rounded-xl bg-primary/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      Plan versus actual
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {result.practiceReview.score}/100 · {result.practiceReview.verdict}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {result.practiceReview.nextAction}
                    </p>
                  </div>
                ) : null}
              </div>
            }
            confidence={{
              label: `${result.confidence.label} confidence`,
              tone: result.confidence.label === "Low" ? "destructive" : "secondary",
            }}
            metrics={[
              { label: "Measured shots", value: result.shotCount },
              { label: "Clubs", value: result.clubCount },
              ...(result.practiceReview
                ? [{ label: "Practice score", value: `${result.practiceReview.score}/100` }]
                : []),
            ]}
            action={
              <Button asChild className="min-h-12 rounded-xl text-base">
                <Link href={result.reviewHref}>
                  {result.isRound ? "Review this round" : "Review this session"}
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </Link>
              </Button>
            }
          />
        </div>

        {!result.isRound ? (
          <section className="grid gap-2.5">
            <IOSSectionHeader
              title="Your shot pattern"
              description="Selected-club confidence uses this club only."
            />
            <MobileShotPatternCharts
              points={result.patternPoints}
              preferredClub={result.preferredClub}
            />
          </section>
        ) : null}

        <section className="grid gap-2.5">
          <IOSSectionHeader title="The golf answer" />
          <IOSGroupedList label="Import performance answer">
            <IOSListRow
              icon={CheckCircle2}
              label="What improved"
              value={result.improved?.clubLabel ?? "Baseline built"}
              detail={
                result.improved?.summary ??
                "There is no prior like-for-like baseline strong enough for an improvement claim."
              }
            />
            <IOSListRow
              icon={Target}
              label="What still needs work"
              value={result.needsWork?.clubLabel ?? "Retest"}
              detail={
                result.needsWork?.summary ??
                "Repeat a measured block before changing the recommendation."
              }
            />
          </IOSGroupedList>
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader title="Four important numbers" />
          <IOSGroupedList label="Important import metrics">
            <IOSMetricRow
              label="Average carry"
              value={formatYards(result.verdict.today.carryAverageYd)}
            />
            <IOSMetricRow
              label="Average offline"
              value={formatYards(result.verdict.today.offlineAverageYd)}
            />
            <IOSMetricRow
              label="Playable rate"
              value={formatPercent(result.verdict.today.playableRate)}
            />
            <IOSMetricRow
              label="Carry consistency"
              value={formatYards(result.verdict.today.carryRobustStdDevYd)}
            />
          </IOSGroupedList>
        </section>

        {!result.isRound ? (
          <Button asChild className="min-h-12 rounded-xl text-base">
            <Link
              href={`/practice?intent=latest_weakness&source=import&session=${encodeURIComponent(result.session.id)}`}
            >
              Build next plan
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
        ) : null}

        <IOSDisclosureGroup
          label="Import details"
          items={[
            {
              value: "audit",
              title: "Import details",
              summary: `${result.rawRowCount} raw rows`,
              description: "Source, mapping, duplicates and data health",
              content: (
                <IOSGroupedList label="Import audit details" className="bg-card">
                  <IOSListRow
                    label="Source file"
                    detail={result.session.fileName ?? "R-Cloud session"}
                  />
                  <IOSMetricRow label="Raw rows" value={String(result.rawRowCount)} />
                  <IOSMetricRow
                    label="Questionable rows"
                    value={String(result.questionableRowCount)}
                  />
                  <IOSListRow
                    label="Club mapping"
                    detail={result.clubs.join(", ") || "No club labels"}
                  />
                  <IOSMetricRow
                    label="Duplicate state"
                    value={result.sourceStatus === "duplicate" ? "Duplicate" : "Saved once"}
                  />
                  <IOSMetricRow label="Parser" value={result.parseVersion} />
                  <IOSListRow
                    icon={Database}
                    label="Open Full Site shot audit"
                    detail="Detailed row correction remains in the full workbench."
                    href="/shots"
                  />
                </IOSGroupedList>
              ),
            },
          ]}
        />
      </MobileAppShell>
    </PageShell>
  );
}

function formatYards(value: number | null) {
  return value === null ? "Unavailable" : `${Math.round(value)} yd`;
}

function formatPercent(value: number | null) {
  return value === null ? "Unavailable" : `${Math.round(value)}%`;
}
