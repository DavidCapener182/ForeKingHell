"use client";
import { useState } from "react";
import { MobileLargeTitle, MobileMetric, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow, MobileStatus } from "@/components/app/mobile-primitives";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { ProgressTrainingLoadChart } from "@/components/progress/progress-training-load-chart";
import { selectTrainingRangeData } from "@/lib/training/rangeSelection";
import { TRAINING_RANGE_OPTIONS, type TrainingRangeKey } from "@/lib/training/ranges";
import type { TrainingOverTimeData } from "@/lib/training/trainingData";

export function MobileTrainingLoad({
  data,
  initialRange,
}: {
  data: TrainingOverTimeData;
  initialRange: TrainingRangeKey;
}) {
  const [range, setRange] = useState(initialRange);
  const view = selectTrainingRangeData(data, range);
  return (
    <div className="grid gap-6" data-mobile-training-load>
      <MobileLargeTitle title="Training" detail={data.status.advice} />
      <MobileSegmentedControl
        ariaLabel="Training period"
        value={range}
        options={TRAINING_RANGE_OPTIONS.map((item) => ({ value: item.key, label: item.label }))}
        onValueChange={(value) => setRange(value as TrainingRangeKey)}
      />
      {data.hasTrainingData ? (
        <>
          <div className="mobile-metric-strip">
            <MobileMetric value={Math.round(view.summary.fitness.value)} label="fitness" />
            <MobileMetric value={Math.round(view.summary.fatigue.value)} label="recent load" />
            <MobileMetric value={Math.round(view.summary.form.value)} label="form" />
          </div>
          <ProgressTrainingLoadChart data={view.series} sessionMarkers={view.sessionMarkers} />
          <MobileStatus label={`${data.confidence.label} confidence`} />
          <p className="text-sm text-muted-foreground">{data.confidence.detail}</p>
        </>
      ) : (
        <p>No training recorded yet. Practice and rounds will build this history.</p>
      )}
      <MobileSection title="What the numbers mean">
        <MobileGroupedList>
          <MobileListRow
            label="Fitness"
            detail="Your longer-term golf workload. Build it through consistent practice."
          />
          <MobileListRow
            label="Recent load"
            detail="The short-term work from practice and rounds. Use it alongside how you feel."
          />
          <MobileListRow
            label="Form"
            detail="The performance signal from your recorded sessions; not a medical readiness score."
          />
        </MobileGroupedList>
      </MobileSection>
      <MobileSection title="Recent training">
        <MobileGroupedList>
          {view.sessions.slice(0, 12).map((session) => (
            <MobileListRow
              key={session.id}
              label={session.title}
              value={`${Math.round(session.sessionLoad)} load`}
              detail={session.sessionDate}
              href={session.sourceId ? `/sessions/${session.sourceId}` : undefined}
            />
          ))}
          <MobileListRow label="Plan your next practice" href="/practice" />
        </MobileGroupedList>
      </MobileSection>
    </div>
  );
}
