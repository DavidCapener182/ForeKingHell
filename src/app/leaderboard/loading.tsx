import { GolfRouteLoading } from "@/components/golf-loading";

export default function LeaderboardLoading() {
  return (
    <GolfRouteLoading
      title="Loading leaderboards"
      subtitle="Preparing rankings, filters, podiums, friend comparisons, and proof context."
      variant="leaderboard"
    />
  );
}
