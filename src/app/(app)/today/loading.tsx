import { GolfRouteLoading } from "@/components/golf-loading";

export default function TodayLoading() {
  return (
    <GolfRouteLoading
      title="Loading latest practice"
      subtitle="Preparing session summary, shot-quality changes, club shifts, and next action."
      variant="today"
    />
  );
}
