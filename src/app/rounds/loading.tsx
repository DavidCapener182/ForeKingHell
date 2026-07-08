import { GolfRouteLoading } from "@/components/golf-loading";

export default function RoundsLoading() {
  return (
    <GolfRouteLoading
      title="Loading round history"
      subtitle="Preparing scorecards, handicap context, proof status, and round review details."
      variant="rounds"
    />
  );
}
