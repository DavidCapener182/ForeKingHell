import { GolfRouteLoading } from "@/components/golf-loading";

export default function HandicapLoading() {
  return (
    <GolfRouteLoading
      title="Loading handicap board"
      subtitle="Checking real and simulator rounds, sample confidence, included scores, and trend context."
      variant="handicap"
    />
  );
}
