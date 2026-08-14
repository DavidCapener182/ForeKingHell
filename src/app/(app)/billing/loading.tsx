import { GolfRouteLoading } from "@/components/golf-loading";

export default function BillingLoading() {
  return (
    <GolfRouteLoading
      title="Loading your plan"
      subtitle="Checking your plan status, renewal, and billing history."
      variant="billing"
    />
  );
}
