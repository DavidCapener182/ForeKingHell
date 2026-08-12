import { GolfRouteLoading } from "@/components/golf-loading";

export default function PlayLoading() {
  return (
    <GolfRouteLoading
      title="Preparing to play"
      subtitle="Loading your active round, selected course, tee and strategy readiness."
      variant="rounds"
    />
  );
}
