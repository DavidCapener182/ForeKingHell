import { GolfRouteLoading } from "@/components/golf-loading";

export default function FeedLoading() {
  return (
    <GolfRouteLoading
      title="Loading social feed"
      subtitle="Preparing privacy-aware updates, friend PBs, challenge invites, and network activity."
      variant="feed"
    />
  );
}
