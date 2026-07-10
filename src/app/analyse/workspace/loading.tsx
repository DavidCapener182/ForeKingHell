import { RouteLoadingState } from "@/components/route-state";

export default function AnalysisWorkspaceLoading() {
  return (
    <RouteLoadingState label="Checking data quality, notes, equipment periods and snapshots" />
  );
}
