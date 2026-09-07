import { createRoot } from "react-dom/client";
import { useState } from "react";
import { SegmentErrorState } from "@/components/segment-error-state";
import ChallengesLoading from "@/app/(app)/challenges/loading";
const error = new Error("Synthetic boundary failure");
function Fixture() {
  const [state, setState] = useState("error");
  return (
    <>
      <aside aria-label="Fixture controls">
        <button onClick={() => setState("ready")}>Finish fixture recovery</button>
      </aside>
      {state === "error" ? (
        <SegmentErrorState error={error} retry={() => setState("loading")} />
      ) : state === "loading" ? (
        <ChallengesLoading />
      ) : (
        <main id="main-content">
          <h1>Recovered challenge fixture</h1>
        </main>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
