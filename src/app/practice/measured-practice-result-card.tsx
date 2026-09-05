"use client";
import type { PracticePlan, SavedPracticePlan } from "@/lib/practice-planner";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { IOSGroupedList, IOSListRow, IOSInlineStatus } from "@/components/app/ios-mobile";
import { cn } from "@/lib/utils";
import {
  practiceDecisionResultLabel,
  practiceDecisionResultTone,
  practiceScoredBlockIds,
  summarizePracticeOutcome,
} from "@/lib/practice-planner-view";
type MeasuredResult = SavedPracticePlan["result"];
export function MeasuredPracticeResultCard({
  result,
  blocks,
}: {
  result: NonNullable<MeasuredResult>;
  blocks: PracticePlan["blocks"];
}) {
  const comparison = result.comparison;
  const importedSession = comparison?.importedSession;
  const actualShots = comparison?.planVsActual.actualShots ?? 0;
  const plannedShots = comparison?.planVsActual.plannedBalls ?? null;
  const sessionCount = importedSession?.sessionCount ?? (actualShots > 0 ? 1 : 0);
  const rawShotCount = importedSession?.rawShotCount ?? actualShots;
  const excludedShotCount = importedSession?.excludedShotCount ?? 0;
  const scoredBlockIds = practiceScoredBlockIds(blocks);
  const outcome = summarizePracticeOutcome(comparison, result.practiceScore, scoredBlockIds);
  const OutcomeIcon = outcome.status === "passed" ? CheckCircle2 : AlertCircle;

  return (
    <Card
      size="sm"
      data-plan-versus-actual
      data-practice-result={outcome.status}
      aria-live="polite"
      className={cn(
        "border-2",
        outcome.status === "passed" && "border-[var(--status-success-border)]",
        outcome.status === "not_passed" && "border-[var(--status-warning-border)]",
      )}
    >
      <CardHeader>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Practice result
          </p>
          <CardTitle className="mt-1 flex items-center gap-2 text-2xl" role="status">
            <OutcomeIcon className="size-5 shrink-0" aria-hidden />
            {outcome.label}
          </CardTitle>
          <p className="mt-1 text-sm font-medium leading-5">{outcome.detail}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{result.verdict}</p>
        </div>
        <CardAction>
          <Badge variant="secondary">{result.practiceScore}/100</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Progress
          value={result.practiceScore}
          aria-label={`Practice result: ${outcome.label}. Score ${result.practiceScore} out of 100`}
        />
        <IOSGroupedList label="Measured practice result" className="bg-card">
          <IOSListRow
            label="Measured shots"
            value={plannedShots === null ? actualShots : `${actualShots}/${plannedShots}`}
            detail="Every eligible launch-monitor shot from the practice day"
          />
          {sessionCount > 0 ? (
            <IOSListRow
              label="Today's uploads"
              value={sessionCount}
              detail={`${rawShotCount} raw shots${
                excludedShotCount > 0 ? ` · ${excludedShotCount} excluded` : ""
              }`}
            />
          ) : null}
          {comparison?.decisions
            .filter((decision) => scoredBlockIds.has(decision.blockId))
            .map((decision) => (
              <IOSListRow
                key={decision.blockId}
                label={decision.title}
                value={`${decision.actualBalls}/${decision.plannedBalls ?? "timed"}`}
                detail={decision.actual}
                status={
                  <IOSInlineStatus
                    label={practiceDecisionResultLabel(decision)}
                    tone={practiceDecisionResultTone(decision)}
                  />
                }
              />
            ))}
          <IOSListRow label="Next action" detail={result.nextAction} />
        </IOSGroupedList>
      </CardContent>
    </Card>
  );
}
