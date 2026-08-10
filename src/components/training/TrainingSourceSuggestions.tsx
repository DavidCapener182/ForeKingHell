import { CheckCircle2, Save } from "lucide-react";

import { createGolfTrainingSessionAction } from "@/app/stats/training-over-time/actions";
import { RpeSelector } from "@/components/training/RpeSelector";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataPanel, SectionHeader, StatusPill } from "@/components/premium";
import type { TrainingSourceSuggestion } from "@/lib/training/trainingData";
import { calculateSessionLoad } from "@/lib/training/trainingLoad";

type TrainingSourceSuggestionsProps = {
  suggestions: TrainingSourceSuggestion[];
  rangeKey: string;
  idPrefix?: string;
};

const integerFormatter = new Intl.NumberFormat("en-GB");

export function TrainingSourceSuggestions({
  suggestions,
  rangeKey,
  idPrefix = "suggested-rpe",
}: TrainingSourceSuggestionsProps) {
  return (
    <DataPanel>
      <SectionHeader
        title="Suggestions"
        description="Link existing rounds, imports, practice sessions or speed work without overwriting the source record."
        action={
          <StatusPill tone={suggestions.length > 0 ? "green" : "slate"}>
            {suggestions.length > 0 ? `${suggestions.length} ready` : "No sessions waiting"}
          </StatusPill>
        }
      />
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-semibold text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100">
            <CheckCircle2
              className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300"
              aria-hidden="true"
            />
            No sessions waiting
          </div>
        ) : (
          <div className="grid gap-3">
            {suggestions.map((suggestion) => (
              <form
                key={suggestion.key}
                action={createGolfTrainingSessionAction}
                className="grid gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground xl:grid-cols-[minmax(0,1fr)_minmax(280px,440px)_auto] xl:items-center"
              >
                <HiddenSuggestionFields suggestion={suggestion} rangeKey={rangeKey} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{suggestion.title}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {suggestion.volumeLabel} · {suggestion.detail}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Approx load at RPE {suggestion.suggestedRpe}:{" "}
                    {integerFormatter.format(estimatedLoad(suggestion))}
                  </p>
                </div>
                <RpeSelector
                  compact
                  defaultValue={suggestion.suggestedRpe}
                  idPrefix={`${idPrefix}-${safeId(suggestion.key)}`}
                />
                <Button type="submit" className="premium-action w-full xl:w-auto">
                  <Save className="size-4" />
                  Save load
                </Button>
              </form>
            ))}
          </div>
        )}
      </CardContent>
    </DataPanel>
  );
}

function HiddenSuggestionFields({
  suggestion,
  rangeKey,
}: {
  suggestion: TrainingSourceSuggestion;
  rangeKey: string;
}) {
  return (
    <>
      <input type="hidden" name="range" value={rangeKey} />
      <input type="hidden" name="sourceType" value={suggestion.sourceType} />
      <input type="hidden" name="sourceId" value={suggestion.sourceId} />
      <input type="hidden" name="title" value={suggestion.title} />
      <input type="hidden" name="sessionDate" value={suggestion.sessionDate} />
      <HiddenNumber name="durationMinutes" value={suggestion.durationMinutes} />
      <HiddenNumber name="holesPlayed" value={suggestion.holesPlayed} />
      <HiddenNumber name="totalSwings" value={suggestion.totalSwings} />
      <HiddenNumber name="fullSwings" value={suggestion.fullSwings} />
      <HiddenNumber name="shortGameSwings" value={suggestion.shortGameSwings} />
      <HiddenNumber name="puttingSwings" value={suggestion.puttingSwings} />
      <HiddenBoolean name="walked" value={suggestion.walked} />
      <HiddenBoolean name="usedCart" value={suggestion.usedCart} />
      <HiddenBoolean name="competition" value={suggestion.competition} />
      <HiddenNumber name="mentalPressure" value={suggestion.mentalPressure} />
      <HiddenNumber name="physicalDemand" value={suggestion.physicalDemand} />
    </>
  );
}

function HiddenNumber({ name, value }: { name: string; value: number | null }) {
  return value === null ? null : <input type="hidden" name={name} value={value} />;
}

function HiddenBoolean({ name, value }: { name: string; value: boolean | null }) {
  return value === null ? null : <input type="hidden" name={name} value={String(value)} />;
}

function estimatedLoad(suggestion: TrainingSourceSuggestion) {
  return calculateSessionLoad({
    durationMinutes: suggestion.durationMinutes,
    holesPlayed: suggestion.holesPlayed,
    totalSwings: suggestion.totalSwings,
    fullSwings: suggestion.fullSwings,
    shortGameSwings: suggestion.shortGameSwings,
    puttingSwings: suggestion.puttingSwings,
    walked: suggestion.walked,
    competition: suggestion.competition,
    rpe: suggestion.suggestedRpe,
    mentalPressure: suggestion.mentalPressure,
  });
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
