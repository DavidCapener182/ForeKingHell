import { GolfRouteLoading } from "@/components/golf-loading";

export default function AdminLoading() {
  return (
    <GolfRouteLoading
      title="Opening admin console"
      subtitle="Loading operational tables, moderation signals, provider health, user lookup, and audit context."
      variant="admin"
    />
  );
}
