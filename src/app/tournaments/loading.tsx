import { GolfRouteLoading } from "@/components/golf-loading";

export default function TournamentsLoading() {
  return (
    <GolfRouteLoading
      title="Loading tournament centre"
      subtitle="Preparing live events, upcoming entries, standings, proof status, and submissions."
      variant="tournaments"
    />
  );
}
