import { GolfRouteLoading } from "@/components/golf-loading";

export default function ProfileLoading() {
  return (
    <GolfRouteLoading
      title="Loading profile workspace"
      subtitle="Preparing profile details, privacy settings, public preview, and comparison context."
      variant="profile"
    />
  );
}
