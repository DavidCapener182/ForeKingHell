import { useState } from "react";
import WorkspaceError from "../../../src/app/(app)/analyse/workspace/error";
import { createRoot } from "react-dom/client";
import { QuickBagClient, type QuickBagClub } from "../../../src/app/quick-bag/quick-bag-client";
import { SpeedReadinessPanel } from "../../../src/app/stats/training-over-time/speed-readiness-panel";
// Synthetic component acceptance evidence only. No authenticated data or writes.
const clubs: QuickBagClub[] = [
  {
    id: "synthetic-seven",
    clubType: "7i",
    label: "7 iron",
    model: "Synthetic example iron",
    trustedCarryYd: 151,
    playNumberYd: 151,
    lowYd: 145,
    highYd: 157,
    typicalMiss: "8 yd left",
    widerSide: "Left",
    medianLateralYd: -8,
    lateralLowYd: -14,
    lateralHighYd: 4,
    patternSampleSize: 30,
    confidence: 75,
    sampleSize: 30,
    latestEvidenceDate: "2026-10-17",
    evidenceKind: "full",
  },
  {
    id: "synthetic-eight",
    clubType: "8i",
    label: "8 iron",
    model: "Synthetic example iron",
    trustedCarryYd: 140,
    playNumberYd: 140,
    lowYd: 135,
    highYd: 145,
    typicalMiss: "6 yd right",
    widerSide: "Right",
    medianLateralYd: 6,
    lateralLowYd: -4,
    lateralHighYd: 12,
    patternSampleSize: 25,
    confidence: 70,
    sampleSize: 25,
    latestEvidenceDate: "2026-10-16",
    evidenceKind: "full",
  },
];
function Fixture() {
  const [empty, setEmpty] = useState(false);
  const [retries, setRetries] = useState(0);
  if (new URLSearchParams(location.search).has("recovery"))
    return (
      <div>
        <p className="p-4 text-sm font-semibold">
          SYNTHETIC ANALYSIS RECOVERY FIXTURE · no live data
        </p>
        <WorkspaceError retry={() => setRetries((value) => value + 1)} />
        <output aria-label="Recovery retry count">{retries}</output>
      </div>
    );
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6">
      <header>
        <p className="text-sm font-semibold text-primary">
          SYNTHETIC ANALYSIS PAGES FIXTURE · no live player data
        </p>
        <h1 className="text-2xl font-semibold">On-course evidence and training context</h1>
      </header>
      <button
        className="min-h-11 w-fit rounded-lg border bg-card px-4 focus-aaa"
        onClick={() => setEmpty(!empty)}
      >
        {empty ? "Show measured example" : "Show empty bag"}
      </button>
      <section aria-label="Quick Bag component">
        <QuickBagClient clubs={empty ? [] : clubs} accountId="synthetic-owner" />
      </section>
      <SpeedReadinessPanel
        development={{
          readiness: {
            score: null,
            status: "build",
            label: "Build a baseline",
            tone: "sky",
            recommendation: "Record a comparable speed session before choosing speed work.",
            nextRecommendedDateIso: null,
            reasons: [
              {
                label: "Session evidence",
                detail: "Only one comparable session is available in this synthetic fixture.",
                state: "missing",
              },
              {
                label: "Training context",
                detail:
                  "Logged activity describes workload; it does not measure physical recovery.",
                state: "caution",
              },
            ],
          },
        }}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
