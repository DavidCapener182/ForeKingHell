import { createRoot } from "react-dom/client";
import { useState } from "react";
import { DirectionAttention } from "@/app/analyse/workspace/direction-attention";
const sessions = Array.from({ length: 100 }, (_, i) => ({
  id: `direction-${i}`,
  label:
    i === 0
      ? "Synthetic unusually long session filename with alignment and directional evidence.csv"
      : `Synthetic session ${i}`,
  date: "2026-09-07T12:00:00Z",
  alignment: i === 0 ? "misaligned" : null,
  alignmentNeedsReview: i === 0,
  questionableShots: i === 0 ? 2 : 1,
  href: `/sessions/direction-${i}`,
}));
function Fixture() {
  const [empty, setEmpty] = useState(false);
  return (
    <main className="p-4">
      <h1>Direction review fixture</h1>
      <button onClick={() => setEmpty(true)}>Show resolved state</button>
      <DirectionAttention
        data={empty ? { sessions: [], totalSessions: 0 } : { sessions, totalSessions: 103 }}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
