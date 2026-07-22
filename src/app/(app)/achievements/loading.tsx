import { GolfRouteLoading } from "@/components/golf-loading";

export default function AchievementsLoading() {
  return (
    <GolfRouteLoading
      title="Loading achievement hub"
      subtitle="Preparing badge progress, XP history, next unlocks, and share controls."
      variant="achievements"
    />
  );
}
