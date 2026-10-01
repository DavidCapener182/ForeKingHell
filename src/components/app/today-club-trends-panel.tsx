import { getClubProgressData } from "@/lib/club-progress-data";
import type { TodayPracticeShot } from "@/lib/today-session-data";
import { TodayClubTrends } from "./today-club-trends";

/** Shared server boundary for Today and Dashboard. Undefined scope means Dashboard;
 * an explicitly empty Today scope stays empty.
 */
export async function TodayClubTrendsPanel({
  selectedShots,
  mode = "today",
}: {
  selectedShots?: TodayPracticeShot[];
  mode?: "today" | "dashboard";
}) {
  const data = await getClubProgressData(selectedShots);
  return <TodayClubTrends {...data} mode={mode} />;
}
