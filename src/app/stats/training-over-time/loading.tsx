import { GolfRouteLoading } from "@/components/golf-loading";

export default function TrainingOverTimeLoading() {
  return (
    <GolfRouteLoading
      title="Loading training load"
      subtitle="Preparing weekly load, club mix, fatigue risk, and session-quality trends."
      variant="trainingLoad"
    />
  );
}
