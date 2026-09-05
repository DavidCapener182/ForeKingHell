import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Target } from "lucide-react";

import { MobileSessionPattern } from "@/app/sessions/mobile-session-story";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import {
  MobileDisclosure,
  MobileGroupedList,
  MobileListRow,
  MobileStatus,
} from "@/components/app/mobile-primitives";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  const needsConfirmation = result.triage.confirmationCount > 0;
  const needsBaseline = !result.needsWork || result.needsWork.verdict === "new";

  return (
    <PageShell>
      <MobileAppShell className="gap-6" data-companion-import-result>
        <MobileLargeTitle
          title={result.isRound ? "Round saved" : "Session saved"}
          detail={`${result.shotCount} shots saved · ${result.clubCount} clubs`}
        />
        <section className="grid gap-3" data-session-verdict aria-label="Import result">
          <MobileStatus
            tone={needsConfirmation ? "attention" : "positive"}
            label={
              needsConfirmation
                ? `${result.triage.confirmationCount} shots to confirm`
                : `${result.triage.stockQualityCount} shots ready for trusted analysis`
            }
          />
          <p className="mobile-type-title2">
            {result.isRound ? "Your round is ready to review." : result.sessionVerdict}
          </p>
          {needsConfirmation ? (
            <p className="mobile-type-callout text-muted-foreground">
              Check the flagged shots before using this session to guide your next practice.
            </p>
          ) : null}
          <Button asChild className="min-h-12 w-full">
            <Link href={needsConfirmation ? result.suggestionReviewHref : result.reviewHref}>
              {needsConfirmation
                ? "Confirm flagged shots"
                : result.isRound
                  ? "Review this round"
                  : "Review this session"}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Link
            className="mobile-type-callout flex min-h-11 items-center justify-center text-primary"
            href={needsConfirmation ? result.reviewHref : "/sessions"}
          >
            {needsConfirmation ? "Open session" : "All sessions"}
          </Link>
        </section>

        {result.fieldIssueCount > 0 ? (
          <MobileStatus
            tone="attention"
            label={`${result.fieldIssueCount} impossible ${result.fieldIssueCount === 1 ? "reading was" : "readings were"} set aside. The other shot measurements are retained.`}
          />
        ) : null}

        {!result.isRound ? (
          <MobileSection title="What changed">
            <MobileGroupedList>
              <MobileListRow
                icon={CheckCircle2}
                label={
                  result.improved
                    ? `What improved · ${result.improved.clubLabel}`
                    : "Baseline building"
                }
                detail={
                  result.improved?.summary ??
                  "Another comparable session is needed before claiming an improvement."
                }
              />
              <MobileListRow
                icon={Target}
                label={
                  needsBaseline ? "Next measurement" : `Next focus · ${result.needsWork?.clubLabel}`
                }
                detail={
                  needsBaseline
                    ? "Repeat a measured block to build a reliable comparison."
                    : result.needsWork?.summary
                }
              />
              {!result.isRound ? (
                <MobileListRow
                  label="Build next plan"
                  href={`/practice?intent=latest_weakness&source=import&session=${encodeURIComponent(result.session.id)}`}
                />
              ) : null}
            </MobileGroupedList>
          </MobileSection>
        ) : null}

        {result.practiceReview ? (
          <MobileSection title="Your practice plan">
            <div className="grid gap-3" data-plan-versus-actual>
              <p className="mobile-type-headline">{result.practiceReview.verdict}</p>
              <Progress
                value={result.practiceReview.score}
                aria-label={`Practice plan score: ${result.practiceReview.score} out of 100`}
              />
              <p className="mobile-type-footnote text-muted-foreground">
                Plan versus actual · {result.practiceReview.score}/100
              </p>
              <p className="mobile-type-callout">{result.practiceReview.nextAction}</p>
            </div>
          </MobileSection>
        ) : null}

        {!result.isRound && result.patternPoints.length > 0 ? (
          <MobileSessionPattern
            points={result.patternPoints}
            preferredClub={result.preferredClub}
          />
        ) : null}

        <div data-import-audit>
          <MobileDisclosure
            label="Import evidence"
            items={[
              {
                value: "details",
                title: "Import details",
                description: `${result.rawRowCount} source rows · measurements and data checks`,
                content: (
                  <div className="grid gap-4">
                    <p className="mobile-type-footnote text-muted-foreground">
                      {result.triagePath}. Raw shots are retained; exclusions affect trusted
                      analysis.
                    </p>
                    <dl className="grid gap-4">
                      {[
                        [
                          "Source file",
                          result.session.fileName ?? `${result.session.source} session`,
                        ],
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
                        <div key={label}>
                          <dt className="mobile-type-footnote text-muted-foreground">{label}</dt>
                          <dd className="mobile-type-callout break-words">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <MobileGroupedList label="Session averages across recorded clubs">
                      <MobileListRow
                        label="Average carry"
                        value={formatYards(result.verdict.today.carryAverageYd)}
                      />
                      <MobileListRow
                        label="Average offline"
                        value={formatYards(result.verdict.today.offlineAverageYd)}
                      />
                      <MobileListRow
                        label="Playable rate"
                        value={formatPercent(result.verdict.today.playableRate)}
                      />
                      <MobileListRow
                        label="Carry consistency"
                        value={formatYards(result.verdict.today.carryRobustStdDevYd)}
                      />
                    </MobileGroupedList>
                    <p className="mobile-type-footnote text-muted-foreground">
                      These session averages combine the recorded clubs. Review the session for
                      individual club results.
                    </p>
                    {result.isRound ? (
                      <MobileGroupedList label="Measured club comparisons">
                        <MobileListRow
                          label={
                            result.improved
                              ? `Improved · ${result.improved.clubLabel}`
                              : "Baseline building"
                          }
                          detail={
                            result.improved?.summary ??
                            "No supported improvement in the measured comparison."
                          }
                        />
                        <MobileListRow
                          label={result.needsWork?.clubLabel ?? "Next measurement"}
                          detail={
                            result.needsWork?.summary ??
                            "Repeat a measured block to build a comparison."
                          }
                        />
                      </MobileGroupedList>
                    ) : null}
                    <Button asChild variant="outline" className="min-h-11">
                      <Link href={`/shots?sessionId=${encodeURIComponent(result.session.id)}`}>
                        Review imported shots
                      </Link>
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </div>
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
