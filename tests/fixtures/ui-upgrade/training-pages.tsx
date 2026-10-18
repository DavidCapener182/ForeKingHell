import { useState } from "react";
import { createRoot } from "react-dom/client";
import { LockedDataChatPanel } from "../../../src/app/data-chat/locked-data-chat-panel";
import { TransferShotReading } from "../../../src/app/speed/transfer-shot-reading";
import { MeasuredPracticeResultCard } from "../../../src/app/practice/measured-practice-result-card";
import PracticeError from "../../../src/app/(app)/practice/error";
import PracticeLoading from "../../../src/app/(app)/practice/loading";

// SYNTHETIC UI FIXTURE. No account, saved data, database or remote service is used.
const block = {
  id: "fixture-driver",
  order: 1,
  type: "technical" as const,
  title: "Driver retest",
  clubs: ["driver"],
  ballCount: 10,
  timeMinutes: 10,
  purpose: "Synthetic target",
  drill: "Synthetic retest",
  successTarget: "Saved target",
  recordPrompt: "Upload",
  scoringRules: { metric: "playable", target: 7 },
};
const comparison = {
  sourceSessionId: null,
  scoringMode: "aggregate" as const,
  matchConfidence: 92,
  sessionMatch: "linked" as const,
  coverage: "unresolved" as const,
  outcome: "inconclusive" as const,
  outcomeReason:
    "The upload is linked. Repeated-club block allocation is unresolved; missing evidence is inconclusive.",
  importedSession: {
    shotCount: 10,
    sessionType: "range",
    dateLabel: "Synthetic date",
    clubTypes: ["driver"],
  },
  planVsActual: {
    plannedBalls: 10,
    actualShots: 10,
    plannedClubs: ["driver"],
    actualClubs: ["driver"],
  },
  whatWorked: [],
  needsWork: [],
  nextRecommendation: "Capture identified blocks on the next upload.",
  summary: "Synthetic unresolved block",
  decisions: [
    {
      blockId: block.id,
      title: block.title,
      target: block.successTarget,
      actual: "10 club observations; block allocation unresolved",
      plannedBalls: 10,
      actualBalls: 0,
      matchedPlannedVolume: false,
      result: "insufficient_data" as const,
      confidence: "low" as const,
      scoringMode: "aggregate" as const,
      linkedShotIds: [],
      metrics: {},
      summary: "Inconclusive",
      decision: "keep_priority" as const,
    },
  ],
  clubEvidence: [
    {
      clubType: "driver",
      shotIds: [],
      shotCount: 10,
      carryAverageYd: 180,
      offlineAverageYd: 15,
      allocation: "club_level_only" as const,
    },
  ],
};
function TrainingPreview() {
  const [retries, setRetries] = useState(0);
  const mode = new URLSearchParams(location.search).get("mode") || "locked";
  return (
    <div data-training-preview className="min-w-0 bg-background text-foreground">
      <p className="border-b bg-muted px-4 py-3 text-sm font-semibold">
        SYNTHETIC TRAINING UI FIXTURE — not live account data
      </p>
      {mode === "locked" ? (
        <main className="p-4 sm:p-6">
          <LockedDataChatPanel />
        </main>
      ) : mode === "recovery" ? (
        <>
          <PracticeError
            error={new Error("Synthetic recovery fixture")}
            retry={() => setRetries((value) => value + 1)}
          />
          <output aria-label="Fixture retry count">{retries}</output>
        </>
      ) : mode === "loading" ? (
        <PracticeLoading />
      ) : (
        <main className="grid min-w-0 gap-4 p-4 sm:p-6">
          <h1 className="text-2xl font-semibold">Practice evidence review</h1>
          <MeasuredPracticeResultCard
            blocks={[block]}
            result={{
              verdict: "Inconclusive — block evidence unavailable",
              nextAction: comparison.nextRecommendation,
              practiceScore: 20,
              comparison,
            }}
          />
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">Speed transfer readings</h2>
            <ol className="grid gap-2">
              <TransferShotReading
                shot={{ shotNumber: 1, clubSpeedMph: 95, sideCarryYd: null }}
                position={1}
                corridor={{ minSideCarryYd: -20, maxSideCarryYd: 20 }}
              />
              <TransferShotReading
                shot={{ shotNumber: 2, clubSpeedMph: 94, sideCarryYd: 0 }}
                position={2}
                corridor={{ minSideCarryYd: -20, maxSideCarryYd: 20 }}
              />
            </ol>
          </section>
        </main>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<TrainingPreview />);
