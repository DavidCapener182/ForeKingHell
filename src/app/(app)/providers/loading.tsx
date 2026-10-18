import { GolfRouteLoading } from "@/components/golf-loading";

export default function ProvidersLoading() {
  return (
    <GolfRouteLoading
      title="Loading provider connections"
      subtitle="Loading saved connection settings and recorded import activity."
      variant="providers"
    />
  );
}
