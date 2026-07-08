import { GolfRouteLoading } from "@/components/golf-loading";

export default function CompareLoading() {
  return (
    <GolfRouteLoading
      title="Preparing comparison"
      subtitle="Loading baseline choices, comparison periods, club filters, and the evidence needed to explain what changed."
      variant="compare"
    />
  );
}
