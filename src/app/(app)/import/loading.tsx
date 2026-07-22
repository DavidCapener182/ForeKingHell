import { GolfRouteLoading } from "@/components/golf-loading";

export default function ImportLoading() {
  return (
    <GolfRouteLoading
      title="Opening import centre"
      subtitle="Preparing upload flow, provider options, import history, and quality checks."
      variant="import"
    />
  );
}
