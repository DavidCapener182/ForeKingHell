import { createRoot } from "react-dom/client";
import { TodayClubTrends } from "../../../src/components/app/today-club-trends";
import { buildClubProgress } from "../../../src/lib/today-club-trends";
import type { TodayPracticeShot } from "../../../src/lib/today-session-data";
const rows: TodayPracticeShot[] = [];
for (let day = 1; day <= 22; day++) {
  for (const [clubId, clubType, model] of [
    ["driver", "driver", "Named Driver"],
    ["iron", "7i", "Named Iron"],
    ["inactive", "6i", "Retired Club"],
  ]) {
    for (let i = 0; i < 12; i++) {
      rows.push({
        id: `${clubId}-${day}-${i}`,
        sessionId: `upload-${day}`,
        sessionDate: new Date(`2026-09-${String(day).padStart(2, "0")}T12:00:00Z`),
        shotAt: new Date(`2026-09-${String(day).padStart(2, "0")}T12:00:00Z`),
        source: "fixture-provider",
        sessionType: "range",
        playContext: "outdoor",
        shotPlayContext: "outdoor",
        fileName: `A deliberately very long source filename for upload ${day} to test wrapping.csv`,
        clubId,
        clubType,
        clubBrand: "Fixture",
        clubModel: model,
        clubActive: clubId !== "inactive",
        reviewStatus: "included",
        qualityTag: null,
        dataIntegrityIssue: null,
        shotCategory: "full",
        carryYd: day === 21 ? null : 140 + day + i,
        totalYd: day === 21 ? null : 155 + day + i,
        sideCarryYd: i % 2 ? -10 : 10,
        ballSpeedMph: 110 + day,
        clubSpeedMph: 80 + day,
        smashFactor: 1.4,
        launchAngleDeg: 15,
        clubDataEstType: null,
      } as TodayPracticeShot);
    }
  }
}
const mode = location.pathname.endsWith("dashboard") ? "dashboard" : "today";
const data = buildClubProgress(rows, mode === "today" ? ["upload-21", "upload-22"] : null);
createRoot(document.getElementById("root")!).render(
  <main className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-4">
    <h1>{mode === "dashboard" ? "Dashboard" : "Today"}</h1>
    <TodayClubTrends
      {...data}
      accountId="isolated-fixture"
      mode={mode}
      history={location.search.includes("fixtureFailure=1") ? "failed" : "complete"}
    />
  </main>,
);
