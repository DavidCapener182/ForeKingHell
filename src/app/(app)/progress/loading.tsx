import { GolfRouteLoading } from "@/components/golf-loading";

export default function ProgressLoading() {
  return (
    <GolfRouteLoading
      title="Building progression roadmap"
      subtitle="Comparing recent sessions, weak spots, and the practice priority for this week."
      variant="progress"
    />
  );
}
