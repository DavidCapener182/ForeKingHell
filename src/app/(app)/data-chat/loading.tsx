import { GolfRouteLoading } from "@/components/golf-loading";

export default function DataChatLoading() {
  return (
    <GolfRouteLoading
      title="Opening data chat"
      subtitle="Loading saved answers, cited metrics, and the context needed for grounded replies."
      variant="dataChat"
    />
  );
}
