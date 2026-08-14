"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";
import type { TrainingSessionMarker } from "@/lib/training/trainingData";

const TrainingOverTimeChart = dynamic(
  () =>
    import("@/components/training/TrainingOverTimeChart").then(
      (module) => module.TrainingOverTimeChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-72 content-center gap-3" role="status">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-60 w-full rounded-2xl" />
        <span className="sr-only">Loading embedded Training Load chart…</span>
      </div>
    ),
  },
);

export function ProgressTrainingLoadChart({
  data,
  sessionMarkers,
}: {
  data: FitnessFreshnessPoint[];
  sessionMarkers: TrainingSessionMarker[];
}) {
  return <TrainingOverTimeChart data={data} sessionMarkers={sessionMarkers} />;
}
