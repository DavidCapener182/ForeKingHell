import { GolfRouteLoading } from "@/components/golf-loading";

export default function FriendsLoading() {
  return (
    <GolfRouteLoading
      title="Loading friend manager"
      subtitle="Preparing friend search, requests, invites, comparisons, and safety controls."
      variant="friends"
    />
  );
}
