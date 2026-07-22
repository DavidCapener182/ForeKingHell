import { GolfRouteLoading } from "@/components/golf-loading";

export default function RoundReviewLoading() {
  return (
    <GolfRouteLoading
      title="Loading round review"
      subtitle="Preparing scorecard proof, hole breakdown, shot corrections, lost-shot context, and recap evidence."
      variant="roundDetail"
    />
  );
}
