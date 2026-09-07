import { createRoot } from "react-dom/client";
import { RecordAttemptForm } from "@/app/course-records/[recordId]/record-attempt-form";
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <h1>Synthetic record submission</h1>
    <RecordAttemptForm
      recordId="synthetic-record"
      selectedSessionId="round-1"
      rounds={[
        {
          id: "round-1",
          metricLabel: "45 strokes",
          dateLabel: "1 September 2026",
          holeCount: 9,
          teeSetName: "Synthetic tee one",
          proofLabel: "Manual round, evidence required",
        },
        {
          id: "round-2",
          metricLabel: "42 strokes",
          dateLabel: "2 September 2026",
          holeCount: 9,
          teeSetName: "Synthetic tee two",
          proofLabel: "Manual round, evidence required",
        },
      ]}
    />
  </main>,
);
