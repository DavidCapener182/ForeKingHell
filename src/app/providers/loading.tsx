import { GolfRouteLoading } from "@/components/golf-loading";

export default function ProvidersLoading() {
  return (
    <GolfRouteLoading
      title="Loading provider console"
      subtitle="Checking connection status, sync health, setup actions, and provider warnings."
      variant="providers"
    />
  );
}
