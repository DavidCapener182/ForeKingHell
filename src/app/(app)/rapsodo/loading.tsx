import { GolfRouteLoading } from "@/components/golf-loading";

export default function RapsodoLoading() {
  return (
    <GolfRouteLoading
      title="Loading Rapsodo sync"
      subtitle="Preparing remote sessions, mapping issues, preview rows, and import history."
      variant="rapsodo"
    />
  );
}
