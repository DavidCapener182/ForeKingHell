import { GolfRouteLoading } from "@/components/golf-loading";

export default function GroupsLoading() {
  return (
    <GolfRouteLoading
      title="Loading group workspace"
      subtitle="Preparing group activity, members, challenge tools, and privacy-aware digests."
      variant="groups"
    />
  );
}
