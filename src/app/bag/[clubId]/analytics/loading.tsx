import { GolfRouteLoading } from "@/components/golf-loading";

export default function ClubAnalyticsLoading() {
  return (
    <GolfRouteLoading
      title="Loading club analytics"
      subtitle="Preparing face, path, launch, speed, dispersion, strike consistency, and shot evidence."
      variant="clubAnalytics"
    />
  );
}
