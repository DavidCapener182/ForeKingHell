import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown, Database, Target } from "lucide-react";

import { MobileShotPatternCharts } from "@/components/app/mobile-shot-pattern-charts";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { ResultHero } from "@/components/app/result-hero";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
            title={`${result.shotCount} shots imported`}
            summary={`${result.triagePath}.${
              result.fieldIssueCount > 0
                ? ` ${result.fieldIssueCount} impossible ${result.fieldIssueCount === 1 ? "field was" : "fields were"} quarantined without discarding the rest of the shot.`
                : ""
            }`}
            confidence={{
              label:
                result.triage.confirmationCount > 0
                  ? `${result.triage.confirmationCount} to confirm`
                  : "No mishits suggested",
              tone: result.triage.confirmationCount > 0 ? "outline" : "secondary",
            }}
            action={
              <ButtonGroup className="w-full">
                <Button asChild className="min-h-12 flex-1 text-base">
                  <Link
                    href={
                      result.triage.confirmationCount > 0
                        ? result.suggestionReviewHref
                        : result.reviewHref
                    }
                  >
                    {result.triage.confirmationCount > 0
                      ? "Confirm flagged shots"
                      : result.isRound
                        ? "Review this round"
                        : "Review this session"}
                    <ArrowRight className="ml-2 size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-12">
                  <Link
                    href={result.triage.confirmationCount > 0 ? result.reviewHref : "/sessions"}
                  >
                    {result.triage.confirmationCount > 0 ? "Open session" : "All sessions"}
                  </Link>
                </Button>
              </ButtonGroup>
            }
          />
        </div>

        <ConnectedMetricBar
          label="Import summary"
          className="grid-cols-2 [&>div:nth-child(2)]:border-l [&>div:nth-child(2)]:border-t-0"
          metrics={[
            { label: "Stock-quality", value: result.triage.stockQualityCount },
            { label: "Likely mishits", value: result.triage.likelyMishitCount },
            { label: "Needs review", value: result.triage.needsReviewCount },
            { label: "Partial shots", value: result.triage.partialShotCount },
          ]}
        />

        {result.practiceReview ? (
          <Card size="sm" data-plan-versus-actual>
            <CardHeader>
              <div>
                <CardTitle>Plan versus actual</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.practiceReview.verdict}
                </p>
              </div>
              <CardAction>
                <Badge variant="secondary">{result.practiceReview.score}/100</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Progress
                value={result.practiceReview.score}
                aria-label={`Practice plan score: ${result.practiceReview.score} out of 100`}
              />
              <p className="text-sm leading-5">{result.practiceReview.nextAction}</p>
            </CardContent>
          </Card>
        ) : null}

        {!result.isRound ? (
          <Card className="gap-3 py-3">
            <CardHeader className="px-3">
              <CardTitle>Your shot pattern</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selected-club confidence uses this club only.
              </p>
            </CardHeader>
            <CardContent className="px-3">
              <MobileShotPatternCharts
                points={result.patternPoints}
                preferredClub={result.preferredClub}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card size="sm">
          <CardHeader>
            <CardTitle>The golf answer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Item variant="muted" size="sm">
              <ItemMedia>
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  What improved · {result.improved?.clubLabel ?? "Baseline built"}
                </ItemTitle>
                <ItemDescription className="whitespace-normal">
                  {result.improved?.summary ??
                    "There is no prior like-for-like baseline strong enough for an improvement claim."}
                </ItemDescription>
              </ItemContent>
            </Item>
            <Item variant="muted" size="sm">
              <ItemMedia>
                <Target className="size-4 text-primary" aria-hidden />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  What still needs work · {result.needsWork?.clubLabel ?? "Retest"}
                </ItemTitle>
                <ItemDescription className="whitespace-normal">
                  {result.needsWork?.summary ??
                    "Repeat a measured block before changing the recommendation."}
                </ItemDescription>
              </ItemContent>
            </Item>
          </CardContent>
        </Card>

        <ConnectedMetricBar
          label="Four important numbers"
          className="grid-cols-2 [&>div:nth-child(2)]:border-l [&>div:nth-child(2)]:border-t-0"
          metrics={[
            { label: "Average carry", value: formatYards(result.verdict.today.carryAverageYd) },
            { label: "Average offline", value: formatYards(result.verdict.today.offlineAverageYd) },
            { label: "Playable rate", value: formatPercent(result.verdict.today.playableRate) },
            {
              label: "Carry consistency",
              value: formatYards(result.verdict.today.carryRobustStdDevYd),
            },
          ]}
        />

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

        <Collapsible className="group" data-import-audit>
          <Card size="sm">
            <CardHeader>
              <div>
                <CardTitle>Import details</CardTitle>
                <CardDescription>
                  {result.rawRowCount} raw rows · source, mapping and data health
                </CardDescription>
              </div>
              <CardAction>
                <CollapsibleTrigger
                  type="button"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Audit
                  <ChevronDown
                    className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                    aria-hidden
                  />
                </CollapsibleTrigger>
              </CardAction>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="grid gap-3">
                <Table aria-label="Import audit details">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Audit field</TableHead>
                      <TableHead className="text-right">Imported value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ["Source file", result.session.fileName ?? "R-Cloud session"],
                      ["Raw rows", String(result.rawRowCount)],
                      ["Unknown raw rows", String(result.rawUnknownRowCount)],
                      ["Stock-quality shots", String(result.triage.stockQualityCount)],
                      ["Likely mishits", String(result.triage.likelyMishitCount)],
                      ["Needs review", String(result.triage.needsReviewCount)],
                      ["Partial shots", String(result.triage.partialShotCount)],
                      ["Confirmed exclusions", String(result.triage.confirmedExcludedCount)],
                      ["Other non-stock", String(result.triage.otherNonStockCount)],
                      ["Quarantined fields", String(result.fieldIssueCount)],
                      ["Whole-shot unusable", String(result.triage.launchMonitorErrorCount)],
                      ["Club mapping", result.clubs.join(", ") || "No club labels"],
                      [
                        "Duplicate state",
                        result.sourceStatus === "duplicate" ? "Duplicate" : "Saved once",
                      ],
                      ["Parser", result.parseVersion],
                    ].map(([label, value]) => (
                      <TableRow key={label}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell className="max-w-52 whitespace-normal text-right">
                          {value}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button asChild variant="outline" className="min-h-11 justify-start">
                  <Link href={`/shots?sessionId=${encodeURIComponent(result.session.id)}`}>
                    <Database className="size-4 text-primary" aria-hidden />
                    Open Full Site shot audit
                  </Link>
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
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
