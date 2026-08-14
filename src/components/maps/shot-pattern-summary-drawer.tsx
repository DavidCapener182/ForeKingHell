"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { LandingClassificationSummary } from "@/lib/course-feature-classification";
import type { ShotPatternTargetLine } from "@/lib/shot-pattern-target";
import type { ShotPatternResult } from "@/lib/shot-patterns";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

export function ShotPatternSummaryDrawer({
  pattern,
  landingSummary,
  targetLine,
}: {
  pattern: ShotPatternResult;
  landingSummary: LandingClassificationSummary | null;
  targetLine?: ShotPatternTargetLine | null;
}) {
  const summary = pattern.summary;
  const playNumber =
    pattern.mode === "carry"
      ? summary.carryMedianYd
      : (summary.totalMedianYd ?? summary.carryMedianYd);
  const shortLong =
    summary.distanceP10Yd !== null && summary.distanceP90Yd !== null
      ? `${formatYards(summary.distanceP10Yd)}-${formatYards(summary.distanceP90Yd)} yd`
      : "--";

  return (
    <Card size="sm" className="gap-0 py-0 shadow-sm">
      <CardContent className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Shot pattern
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">{pattern.clubLabel}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {outlierLabel(pattern.outlierMode)} · {summary.includedSampleSize}/
              {summary.sampleSize} recent shots
            </p>
          </div>
          <Badge variant="outline" className={confidenceClass(summary.confidence)}>
            {confidenceLabel(summary.confidence)}
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMetric
            label="Target"
            value={
              targetLine
                ? `${formatYards(targetLine.targetDistanceYd)} yd`
                : playNumber === null
                  ? "--"
                  : `${formatYards(playNumber)} yd`
            }
          />
          <SummaryMetric
            label="Worst miss"
            value={
              targetLine
                ? `${formatYards(targetLine.leftMissYd)}L · ${formatYards(targetLine.rightMissYd)}R`
                : `${formatYards(summary.leftMissYd)}L · ${formatYards(summary.rightMissYd)}R`
            }
          />
          <SummaryMetric label="Depth" value={shortLong} />
          <SummaryMetric
            label="Line"
            value={
              targetLine?.beyondCapability
                ? "Out of range"
                : targetLine
                  ? `${targetLine.playablePercent}% green`
                  : "Target"
            }
          />
        </div>

        {targetLine?.beyondCapability ? (
          <Alert className="mt-3 bg-muted/45">
            <AlertDescription>
              This target is longer than your recent {pattern.clubLabel} max of{" "}
              {formatYards(targetLine.capabilityDistanceYd)} yd, so the line is not scored.
            </AlertDescription>
          </Alert>
        ) : summary.warning ? (
          <Alert className="mt-3 border-[var(--status-warning-border)] bg-[var(--status-warning-surface)]">
            <AlertDescription className="text-[var(--status-warning-foreground)]">
              Not enough {pattern.clubLabel} shots yet. {summary.warning}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mt-3 border-[var(--status-information-border)] bg-[var(--status-information-surface)]">
            <AlertDescription className="text-[var(--status-information-foreground)]">
              Check the normal miss pattern before committing. Trouble inside that window makes this
              club a riskier choice.
            </AlertDescription>
          </Alert>
        )}

        {landingSummary && landingSummary.knownSampleSize > 0 ? (
          <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-5">
            <SummaryMetric label="Fairway" value={`${landingSummary.percentages.fairway}%`} />
            <SummaryMetric label="Rough" value={`${landingSummary.percentages.rough}%`} />
            <SummaryMetric label="Bunker" value={`${landingSummary.percentages.bunker}%`} />
            <SummaryMetric label="Water" value={`${landingSummary.percentages.water}%`} />
            <SummaryMetric
              label="Expected"
              value={
                landingSummary.expectedPenalty === null ? "--" : `${landingSummary.expectedPenalty}`
              }
            />
          </div>
        ) : (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Fairway, rough, bunker and expected-value rows appear when landing-zone polygons are
            mapped for this course.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-normal text-foreground">{value}</p>
    </div>
  );
}

function outlierLabel(mode: ShotPatternResult["outlierMode"]) {
  if (mode === "best80") return "Best 80%";
  if (mode === "best90") return "Best 90%";
  return "All shots";
}

function confidenceLabel(confidence: ShotPatternResult["summary"]["confidence"]) {
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  if (confidence === "low") return "Low confidence";
  return "Needs data";
}

function confidenceClass(confidence: ShotPatternResult["summary"]["confidence"]) {
  if (confidence === "high") {
    return "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]";
  }
  if (confidence === "medium") {
    return "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
  }
  if (confidence === "low") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]";
  }
  return "border-border bg-muted text-muted-foreground";
}

function formatYards(value: number | null) {
  return value === null ? "--" : numberFormatter.format(Math.abs(value));
}
