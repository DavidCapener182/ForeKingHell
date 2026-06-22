import { Link2, Save } from "lucide-react";

import { createGolfTrainingSessionAction } from "@/app/stats/training-over-time/actions";
import { RpeSelector } from "@/components/training/RpeSelector";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataPanel, EmptyState, SectionHeader, StatusPill } from "@/components/premium";
import type { TrainingSourceSuggestion } from "@/lib/training/trainingData";
import { calculateSessionLoad } from "@/lib/training/trainingLoad";

type TrainingSourceSuggestionsProps = {
  suggestions: TrainingSourceSuggestion[];
  rangeKey: string;
};

const integerFormatter = new Intl.NumberFormat("en-GB");

export function TrainingSourceSuggestions({
  suggestions,
  rangeKey,
}: TrainingSourceSuggestionsProps) {
  return (
    <DataPanel>
      <SectionHeader
        title="Suggested from your golf data"
        description="Link existing rounds, imports, practice sessions or speed work without overwriting the source record."
        action={<StatusPill tone="green">{suggestions.length} ready</StatusPill>}
      />
      <CardContent>
        {suggestions.length === 0 ? (
          <EmptyState
            icon={<Link2 className="size-5" aria-hidden="true" />}
            title="No unlogged source sessions found"
            description="Recent source activity will appear here when it can be turned into a golf load entry."
          />
        ) : (
          <div className="grid gap-3">
            {suggestions.map((suggestion) => (
              <form
                key={suggestion.key}
                action={createGolfTrainingSessionAction}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white/80 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,440px)_auto] xl:items-center"
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
                  idPrefix={`suggested-rpe-${safeId(suggestion.key)}`}
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
