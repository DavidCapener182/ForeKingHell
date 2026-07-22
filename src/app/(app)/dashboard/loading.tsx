import { GolfRouteLoading } from "@/components/golf-loading";

export default function DashboardLoading() {
  return (
    <GolfRouteLoading
      title="Building command centre"
      subtitle="Loading the latest practice signal, bag confidence, plays-like calls, and next action."
      variant="dashboard"
    />
  );
}
