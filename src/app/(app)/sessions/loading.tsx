import { GolfRouteLoading } from "@/components/golf-loading";

export default function SessionsLoading() {
  return (
    <GolfRouteLoading
      title="Loading sessions"
      subtitle="Preparing recent sessions, their key result and current status."
      variant="sessions"
    />
  );
}
