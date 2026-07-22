import { GolfRouteLoading } from "@/components/golf-loading";

export default function ShotsLoading() {
  return (
    <GolfRouteLoading
      title="Loading shot explorer"
      subtitle="Preparing filters, saved views, master-detail rows, and the latest shot evidence."
      variant="shots"
    />
  );
}
