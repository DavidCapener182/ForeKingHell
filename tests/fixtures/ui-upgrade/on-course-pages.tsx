import { useState } from "react";
import { createRoot } from "react-dom/client";
import { OnCourseRecovery, type OnCourseArea } from "../../../src/app/courses/on-course-recovery";
import { MobileStartRound } from "../../../src/app/rounds/new/mobile-start-round";
import { RoundsMobileList } from "../../../src/app/rounds/rounds-mobile-list";
import { RoundsScoringIndex } from "../../../src/app/rounds/rounds-scoring-index";
import { CourseRecordBoard } from "../../../src/app/course-records/course-record-board";
import type { RoundsWorkspaceRound } from "../../../src/app/rounds/rounds-workspace";
import { Button } from "../../../src/components/ui/button";

// Synthetic UI evidence only. No server actions, accounts or saved data are used.
const round: RoundsWorkspaceRound = {
  id: "synthetic-round",
  courseName: "Synthetic Riverside Championship Course with a deliberately long descriptive name",
  fileName: null,
  teeName: "White tees",
  dateLabel: "18 Oct 2026",
  dateIso: "2026-10-18",
  type: "real_round",
  typeLabel: "Real round",
  roundStatus: "in_progress",
  totalScore: 5,
  totalPar: 4,
  totalPutts: 2,
  toPar: 1,
  toParLabel: "+1",
  handicapDifferential: null,
  handicapDifferentialLabel: "Unavailable",
  handicapImpactLabel: "Incomplete round",
  handicapImpactTone: "neutral",
  mainVerdict: "Round in progress",
  scoreSummary: "1 hole scored",
  shotCount: 0,
  dataLabel: "Scorecard only",
  rowDataLabel: "Scorecard only",
  statusLabel: "In progress",
  holeResults: [],
  scorecardHoles: [{ holeNumber: 1, par: 4, yards: 360, score: 5 }],
};
function Fixture() {
  const [view, setView] = useState("Recovery");
  const [area, setArea] = useState<OnCourseArea>("courses");
  const [retried, setRetried] = useState(0);
  return (
    <main className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-4">
      <aside className="rounded-lg border bg-muted p-3 text-sm font-semibold">
        SYNTHETIC ON-COURSE ACCEPTANCE FIXTURE — no real rounds or player data
      </aside>
      <h1 className="text-xl font-semibold">On-course workflow recovery</h1>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Fixture section">
        {["Recovery", "Round setup", "Mobile history", "Desktop history", "Record search"].map(
          (item) => (
            <Button
              key={item}
              variant={item === view ? "secondary" : "outline"}
              onClick={() => setView(item)}
            >
              {item}
            </Button>
          ),
        )}
      </div>
      {view === "Recovery" ? (
        <>
          <label className="grid min-w-0 gap-1 text-sm">
            Route area
            <select
              aria-label="Route area"
              className="min-h-11 min-w-0 rounded-md border bg-background px-3"
              value={area}
              onChange={(event) => setArea(event.target.value as OnCourseArea)}
            >
              {["courses", "rounds", "play", "records", "lab"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <OnCourseRecovery area={area} retry={() => setRetried((value) => value + 1)} />
          <p role="status">Retry requests: {retried}</p>
        </>
      ) : null}
      {view === "Round setup" ? (
        <MobileStartRound
          courses={[]}
          creationId="synthetic-only"
          action={async () => ({ error: "Fixture never saves" })}
        />
      ) : null}
      {view === "Mobile history" ? <RoundsMobileList rounds={[round]} /> : null}
      {view === "Desktop history" ? <RoundsScoringIndex rounds={[round]} /> : null}
      {view === "Record search" ? (
        <CourseRecordBoard
          courses={[
            {
              id: "synthetic-course",
              name: "Synthetic Riverside",
              country: "England",
              recordCount: 2,
              teeSetCount: 1,
              attemptCount: 3,
              champion: {
                displayName: "Synthetic Golfer",
                scoreLabel: "72",
                verificationLabel: "Verified fixture",
                recordId: "synthetic-record",
                recordType: "stroke_play",
                categoryName: "Lowest gross score",
                period: "all_time",
                periodLabel: "All time",
                verificationStatus: "verified",
                proofStatus: "fixture-only",
              },
            },
          ]}
        />
      ) : null}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
