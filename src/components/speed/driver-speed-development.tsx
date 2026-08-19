import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Gauge,
  Target,
} from "lucide-react";

import {
  CompactReadoutGrid,
  DataPanel,
  SectionHeader,
  StatusPill,
  type Tone,
} from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SPEED_LADDER_LEVELS } from "@/lib/speed-development";
import type { SpeedDevelopmentSummary } from "@/lib/speed-development";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

const recommendedDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

const TRANSFER_STAGES = [
  {
    key: "ceiling",
    label: "Speed ceiling",
    question: "How fast can you move the club?",
  },
  {
    key: "transfer",
    label: "Ball transfer",
    question: "Can you bring that speed to a ball?",
  },
  {
    key: "playing",
    label: "Playing speed",
    question: "Can you keep it in a playable swing?",
  },
  {
    key: "course",
    label: "Course speed",
    question: "Does the speed survive on the course?",
  },
] as const;

type TransferStageKey = (typeof TRANSFER_STAGES)[number]["key"];
type ReadinessReason = SpeedDevelopmentSummary["readiness"]["reasons"][number];
type DevelopmentStatus = SpeedDevelopmentSummary["metrics"][number]["status"];

export function DriverSpeedDevelopment({ data }: { data: SpeedDevelopmentSummary }) {
  const summary = data;
  const projectProgress = isFiniteNumber(summary.project.currentBestCarryYd)
    ? summary.project.progressPercent
    : null;
  const recommendedDate = formatRecommendedDate(summary.readiness.nextRecommendedDateIso);
  const planDescription = [
    formatDuration(summary.plan.durationMinutes),
    `${planModeLabel(summary.plan.mode)} prescription`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-label="Driver speed development programme"
      className="grid min-w-0 gap-4"
      data-driver-speed-development
    >
      <DataPanel id="driver-speed-development" className="w-full">
        <SectionHeader
          title={<h2>{displayValue(summary.project.label, "Driver carry project")}</h2>}
          description="Build the ingredients behind the carry outcome, then protect the speed when a ball and target are added."
          action={<StatusPill tone={summary.readiness.tone}>{summary.readiness.label}</StatusPill>}
        />
        <CardContent
          className="grid min-w-0 gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]"
          data-speed-project-readiness
        >
          <section
            aria-labelledby="driver-carry-project-title"
            className="grid min-w-0 content-start gap-4"
          >
            <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-surface)] p-4 text-[var(--status-success-foreground)]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                <Target className="size-4" aria-hidden="true" />
                <h3 id="driver-carry-project-title">Carry outcome</h3>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {formatNumber(summary.project.targetCarryYd, "yd")}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {displayValue(summary.project.coachMessage, "Coaching read not available yet.")}
              </p>
              {hasValue(summary.project.limitingFactor) ? (
                <p className="mt-2 text-xs leading-5 opacity-85">
                  Biggest opportunity: {displayValue(summary.project.limitingFactor)}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <MetricTile
                label="Current best carry"
                value={formatNumber(summary.project.currentBestCarryYd, "yd")}
                detail={formatCarryEvidence(
                  summary.project.carrySource,
                  summary.project.carrySampleSize,
                )}
              />
              <MetricTile
                label="Carry target"
                value={formatNumber(summary.project.targetCarryYd, "yd")}
              />
              <MetricTile label="Remaining gap" value={formatNumber(summary.project.gapYd, "yd")} />
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Project progress</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatNumber(projectProgress, "%", 0)}
                </p>
              </div>
              {isFiniteNumber(projectProgress) ? (
                <Progress
                  className="mt-3"
                  value={clampPercent(projectProgress)}
                  aria-label={`${displayValue(summary.project.label, "Carry project")} progress`}
                />
              ) : (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Progress is not measured yet.
                </p>
              )}
            </div>
          </section>

          <section
            aria-labelledby="speed-readiness-title"
            className="grid content-start gap-4 rounded-xl border border-border/70 bg-card p-4"
            data-speed-readiness
          >
            <div
              className="flex items-start justify-between gap-3"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Gauge className="size-4 text-primary" aria-hidden="true" />
                  <h3 id="speed-readiness-title" className="text-sm font-semibold text-foreground">
                    Speed readiness
                  </h3>
                </div>
                <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums text-foreground">
                  {formatNumber(summary.readiness.score, "", 0)}
                </p>
              </div>
              <StatusPill tone={summary.readiness.tone}>{summary.readiness.label}</StatusPill>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              {displayValue(summary.readiness.recommendation, "No session recommendation yet.")}
            </p>

            {summary.readiness.reasons.length > 0 ? (
              <ul className="grid gap-2" aria-label="Speed readiness evidence">
                {summary.readiness.reasons.map((reason) => (
                  <li
                    key={`${reason.label}-${reason.state}`}
                    className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 text-sm leading-5"
                  >
                    <ReadinessReasonIcon reason={reason} />
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{reason.label}</span>
                      <span className="block text-xs text-muted-foreground">{reason.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                Readiness evidence is not measured yet.
              </p>
            )}

            {recommendedDate ? (
              <p className="text-xs text-muted-foreground">Next recommended: {recommendedDate}</p>
            ) : null}

            <Button asChild size="lg" className="w-full">
              <Link href="/practice?session=speed&intent=speed&time=20">
                Open recommended session
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </section>

          {summary.project.ingredients.length > 0 ? (
            <section className="grid min-w-0 gap-2 xl:col-span-2" aria-label="Carry ingredients">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Carry ingredients</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Current evidence against the next requirement for this carry project.
                </p>
              </div>
              <CompactReadoutGrid
                columnsClassName="sm:grid-cols-2 xl:grid-cols-5"
                items={summary.project.ingredients.map((ingredient) => ({
                  label: ingredient.label,
                  value: displayValue(ingredient.current),
                  detail: `${developmentStatusLabel(ingredient.status)} · Next ${displayValue(ingredient.target)}`,
                  tone: developmentStatusTone(ingredient.status),
                  title: `${ingredient.label}: ${displayValue(ingredient.current)}. Next ${displayValue(ingredient.target)}.`,
                }))}
              />
            </section>
          ) : null}

          {summary.metrics.length > 0 ? (
            <section
              className="grid min-w-0 gap-2 border-t border-border/70 pt-4 xl:col-span-2"
              aria-label="Driver development targets"
              data-speed-development-targets
            >
              <div>
                <h3 className="text-sm font-semibold text-foreground">Development targets</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Current, next and long-term markers from measured Driver evidence.
                </p>
              </div>
              <CompactReadoutGrid
                columnsClassName="sm:grid-cols-2 xl:grid-cols-5"
                items={summary.metrics.map((metric) => ({
                  label: metric.label,
                  value: displayValue(metric.current),
                  detail: `Next ${displayValue(metric.nextTarget)} · Long-term ${displayValue(metric.longTerm)}`,
                  tone: developmentStatusTone(metric.status),
                  title: `${metric.detail} Next ${displayValue(metric.nextTarget)}. Long-term ${displayValue(metric.longTerm)}.`,
                }))}
              />
            </section>
          ) : null}
        </CardContent>
      </DataPanel>

      <DataPanel className="w-full">
        <SectionHeader
          title={<h2>Where speed is lost</h2>}
          description="Four separate questions: ceiling, ball transfer, playable Driver and speed that reaches the course."
        />
        <CardContent className="p-4 sm:p-5" data-speed-transfer-funnel>
          <ol
            className="grid min-w-0 gap-8 lg:grid-cols-4"
            aria-label="Driver speed transfer chain"
          >
            {TRANSFER_STAGES.map((stage, index) => {
              const evidence = findTransferStage(summary, stage.key);
              const stageLabel = displayValue(evidence?.label, stage.label);

              return (
                <li key={stage.key} className="relative min-w-0">
                  <article className="grid h-full min-w-0 content-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Stage {index + 1}
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-foreground">
                          {stageLabel}
                        </h3>
                      </div>
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {index + 1}
                      </span>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {displayValue(evidence?.question, stage.question)}
                    </p>
                    <p
                      className="text-3xl font-semibold tracking-tight tabular-nums text-foreground"
                      data-operational-value
                    >
                      {formatNumber(evidence?.valueMph, "mph")}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {formatStageEvidence(evidence?.source, evidence?.sampleSize)}
                    </p>
                    <p className="border-t border-border/70 pt-3 text-xs font-medium text-foreground">
                      {formatTransferLoss(evidence?.lossFromPreviousMph, index)}
                    </p>
                  </article>
                  {index < TRANSFER_STAGES.length - 1 ? (
                    <ArrowDown
                      className="absolute -bottom-6 left-1/2 size-4 -translate-x-1/2 text-muted-foreground lg:-right-6 lg:bottom-auto lg:left-auto lg:top-1/2 lg:-translate-y-1/2 lg:rotate-[-90deg]"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </DataPanel>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <DataPanel stretch className="w-full">
          <SectionHeader
            title={<h2>Speed without chaos</h2>}
            description={displayValue(
              summary.chaos.comparisonLabel,
              "Comparable speed and Driver evidence is not available yet.",
            )}
            action={<StatusPill tone={summary.chaos.tone}>{summary.chaos.label}</StatusPill>}
          />
          <CardContent className="grid gap-4 p-4 sm:p-5" data-speed-chaos>
            <div className="grid grid-cols-2 gap-2">
              <MetricTile
                label="Speed gain"
                value={formatSignedNumber(summary.chaos.speedGainMph, "mph")}
              />
              <MetricTile
                label="Ball-speed gain"
                value={formatSignedNumber(summary.chaos.ballSpeedGainMph, "mph")}
              />
              <MetricTile
                label="Offline change"
                value={formatSignedNumber(summary.chaos.offlineChangeYd, "yd")}
                detail="Positive means farther offline"
              />
              <MetricTile
                label="Playable-rate change"
                value={formatSignedNumber(summary.chaos.playableRateChangePct, "pts")}
              />
            </div>
            <NextAction value={summary.chaos.nextAction} />
          </CardContent>
        </DataPanel>

        <DataPanel stretch className="w-full">
          <SectionHeader
            title={<h2>{displayValue(summary.plan.title, "Today’s speed session")}</h2>}
            description={planDescription || "Session prescription pending"}
            action={
              <StatusPill tone={planModeTone(summary.plan.mode)}>
                {planModeLabel(summary.plan.mode)}
              </StatusPill>
            }
          />
          <CardContent className="p-4 sm:p-5" data-speed-session-plan>
            {summary.plan.blocks.length > 0 ? (
              <ol className="grid gap-3" aria-label="Today’s prescribed speed session blocks">
                {summary.plan.blocks.map((block, index) => (
                  <li
                    key={block.key}
                    className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-xl border border-border/70 bg-muted/30 p-3"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{block.label}</h3>
                        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                          {hasValue(block.reps) ? (
                            <span className="rounded-md bg-card px-2 py-1 ring-1 ring-border/70">
                              Reps: {displayValue(block.reps)}
                            </span>
                          ) : null}
                          {hasValue(block.balls) ? (
                            <span className="rounded-md bg-card px-2 py-1 ring-1 ring-border/70">
                              Balls: {displayValue(block.balls)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {hasValue(block.target) ? (
                        <p className="mt-2 text-sm font-medium text-foreground">
                          Target: {displayValue(block.target)}
                        </p>
                      ) : null}
                      {hasValue(block.instruction) ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {displayValue(block.instruction)}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                No session has been prescribed from the available evidence yet.
              </p>
            )}
          </CardContent>
        </DataPanel>
      </div>

      <DataPanel className="w-full">
        <SectionHeader
          title={<h2>Speed ladder</h2>}
          description="Unlock each level when all three latest qualifying session averages meet it. A single fast swing does not move the ladder."
          action={
            <StatusPill tone="sky">
              Next {formatNumber(summary.ladder.nextLevelMph, "mph")}
            </StatusPill>
          }
        />
        <CardContent className="grid gap-4 p-4 sm:p-5" data-speed-ladder>
          <div className="grid gap-2 sm:grid-cols-3">
            <MetricTile
              label="Three-session average"
              value={formatNumber(summary.ladder.rollingThreeAvgMph, "mph")}
            />
            <MetricTile label="Best speed" value={formatNumber(summary.ladder.bestMph, "mph")} />
            <MetricTile
              label="Current level"
              value={formatNumber(summary.ladder.currentLevelMph, "mph")}
            />
          </div>

          <ol className="grid min-w-0 gap-2 sm:grid-cols-5" aria-label="Driver speed ladder levels">
            {SPEED_LADDER_LEVELS.map((speedMph) => {
              const level = summary.ladder.levels.find(
                (candidate) => candidate.speedMph === speedMph,
              );
              const state = level?.state ?? "locked";

              return (
                <li
                  key={speedMph}
                  className="grid min-w-0 content-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Level</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                        {speedMph} mph
                      </p>
                    </div>
                    <StatusPill tone={ladderStateTone(state)}>{ladderStateLabel(state)}</StatusPill>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {formatQualifyingSessions(level?.qualifyingSessions)}
                  </p>
                  {isFiniteNumber(level?.progressPercent) ? (
                    <Progress
                      value={clampPercent(level.progressPercent)}
                      aria-label={`${speedMph} mph level qualification progress`}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Progress not measured</p>
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </DataPanel>

      {summary.verdict ? (
        <DataPanel className="w-full">
          <SectionHeader
            title={<h2>Latest speed-session result</h2>}
            description={summary.verdict.label}
            action={<StatusPill tone={summary.verdict.tone}>{summary.verdict.grade}</StatusPill>}
          />
          <CardContent className="grid gap-4 p-4 sm:p-5" data-speed-verdict>
            <CompactReadoutGrid
              columnsClassName="sm:grid-cols-2 xl:grid-cols-5"
              items={[
                {
                  label: "Peak speed",
                  value: formatNumber(summary.verdict.peakSpeedMph, "mph"),
                  detail: formatSignedNumber(summary.verdict.peakDeltaMph, "mph"),
                  tone: summary.verdict.tone,
                },
                {
                  label: "Playing speed",
                  value: formatNumber(summary.verdict.playingSpeedMph, "mph"),
                  detail: "Playable Driver swings",
                  tone: summary.verdict.tone,
                },
                {
                  label: "Ball speed",
                  value: formatNumber(summary.verdict.ballSpeedMph, "mph"),
                  detail: "Transfer to the ball",
                  tone: summary.verdict.tone,
                },
                {
                  label: "Transfer efficiency",
                  value: formatNumber(summary.verdict.transferEfficiencyPct, "%", 0),
                  detail: "Playing speed against peak",
                  tone: summary.verdict.tone,
                },
                {
                  label: "Dispersion change",
                  value: formatSignedNumber(summary.verdict.dispersionChangeYd, "yd"),
                  detail: "Positive means wider",
                  tone: summary.verdict.tone,
                },
              ]}
            />
            <NextAction value={summary.verdict.nextAction} />
            <div>
              <Button asChild variant="outline">
                <Link href={`/speed/sessions/${summary.verdict.sessionId}`} prefetch={false}>
                  View swing-by-swing evidence
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </DataPanel>
      ) : null}
    </section>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-2 truncate text-xl font-semibold tracking-tight tabular-nums text-foreground"
        data-operational-value
        title={value}
      >
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function NextAction({ value }: { value: unknown }) {
  if (!hasValue(value)) {
    return null;
  }

  return (
    <section
      aria-label="Recommended next action"
      className="rounded-xl border border-[var(--status-information-border)] bg-[var(--status-information-surface)] p-4 text-[var(--status-information-foreground)]"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em]">Next action</p>
      <p className="mt-2 text-sm font-medium leading-6 text-foreground">{displayValue(value)}</p>
    </section>
  );
}

function ReadinessReasonIcon({ reason }: { reason: ReadinessReason }) {
  switch (reason.state) {
    case "positive":
      return <CheckCircle2 className="mt-0.5 size-4 text-primary" aria-hidden="true" />;
    case "caution":
      return (
        <AlertTriangle
          className="mt-0.5 size-4 text-[var(--status-warning-foreground)]"
          aria-hidden="true"
        />
      );
    case "missing":
      return <CircleDashed className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />;
  }
}

function findTransferStage(summary: SpeedDevelopmentSummary, key: TransferStageKey) {
  return summary.funnel.find((stage) => stage.key === key);
}

function formatStageEvidence(source: unknown, sampleSize: unknown) {
  const sourceLabel = displayValue(source, "Source not available");

  if (!isFiniteNumber(sampleSize)) {
    return `${sourceLabel} · Sample not measured`;
  }

  if (sampleSize === 0) {
    return `${sourceLabel} · No measured samples`;
  }

  return `${sourceLabel} · ${integerFormatter.format(sampleSize)} measured`;
}

function formatTransferLoss(value: unknown, index: number) {
  if (index === 0) {
    return "Ceiling reference";
  }

  if (!isFiniteNumber(value)) {
    return "Loss from previous stage not measured";
  }

  if (value === 0) {
    return "No measured loss from previous stage";
  }

  if (value < 0) {
    return `${numberFormatter.format(Math.abs(value))} mph gained from previous stage`;
  }

  return `${numberFormatter.format(value)} mph lost from previous stage`;
}

function formatQualifyingSessions(value: unknown) {
  if (!isFiniteNumber(value)) {
    return "Qualifying sessions not measured";
  }

  return `${integerFormatter.format(value)} of 3 qualifying sessions`;
}

function formatCarryEvidence(source: unknown, sampleSize: unknown) {
  const sourceLabel = displayValue(source, "Carry source not available");

  if (!isFiniteNumber(sampleSize) || sampleSize === 0) {
    return sourceLabel;
  }

  return `${sourceLabel} · ${integerFormatter.format(sampleSize)} clean measured`;
}

function formatRecommendedDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return recommendedDateFormatter.format(date);
}

function formatDuration(value: unknown) {
  if (!isFiniteNumber(value)) {
    return null;
  }

  return `${integerFormatter.format(value)} min`;
}

function formatNumber(value: unknown, unit = "", precision = 1) {
  if (!isFiniteNumber(value)) {
    return "Not measured";
  }

  const formatted =
    precision === 0 ? integerFormatter.format(value) : numberFormatter.format(value);
  return appendUnit(formatted, unit);
}

function formatSignedNumber(value: unknown, unit: string) {
  if (!isFiniteNumber(value)) {
    return "Not measured";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${appendUnit(numberFormatter.format(value), unit)}`;
}

function appendUnit(value: string, unit: string) {
  if (!unit) {
    return value;
  }

  return unit === "%" ? `${value}%` : `${value} ${unit}`;
}

function displayValue(value: unknown, fallback = "Not measured") {
  if (typeof value === "string") {
    return value.trim().length > 0 ? value : fallback;
  }

  if (isFiniteNumber(value)) {
    return numberFormatter.format(value);
  }

  return fallback;
}

function hasValue(value: unknown) {
  return (
    (typeof value === "string" && value.trim().length > 0) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function developmentStatusTone(status: DevelopmentStatus): Tone {
  switch (status) {
    case "on_track":
      return "green";
    case "needs_work":
      return "amber";
    case "unmeasured":
      return "slate";
  }
}

function developmentStatusLabel(status: DevelopmentStatus) {
  switch (status) {
    case "on_track":
      return "On track";
    case "needs_work":
      return "Needs work";
    case "unmeasured":
      return "Unmeasured";
  }
}

function planModeLabel(mode: SpeedDevelopmentSummary["plan"]["mode"]) {
  switch (mode) {
    case "speed":
      return "Speed";
    case "transfer":
      return "Transfer";
    case "technical":
      return "Technical Driver";
  }
}

function planModeTone(mode: SpeedDevelopmentSummary["plan"]["mode"]): Tone {
  switch (mode) {
    case "speed":
      return "green";
    case "transfer":
      return "sky";
    case "technical":
      return "amber";
  }
}

function ladderStateLabel(state: SpeedDevelopmentSummary["ladder"]["levels"][number]["state"]) {
  switch (state) {
    case "unlocked":
      return "Unlocked";
    case "current":
      return "Current";
    case "locked":
      return "Locked";
  }
}

function ladderStateTone(
  state: SpeedDevelopmentSummary["ladder"]["levels"][number]["state"],
): Tone {
  switch (state) {
    case "unlocked":
      return "green";
    case "current":
      return "sky";
    case "locked":
      return "slate";
  }
}
