import { GolfRouteLoading } from "@/components/golf-loading";

export default function BillingLoading() {
  return (
    <GolfRouteLoading
      title="Loading billing console"
      subtitle="Checking plan status, entitlements, invoices, and upgrade actions."
      variant="billing"
    />
  );
}
