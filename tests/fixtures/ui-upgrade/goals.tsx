import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { GoalCreateDialog, GoalDeleteDialog } from "@/app/goals/goal-form-panels";
import { calls } from "./goal-actions";
const subscribe = (callback: () => void) => {
  window.addEventListener("fixture-goal-calls", callback);
  return () => window.removeEventListener("fixture-goal-calls", callback);
};
function Fixture() {
  const result = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(calls),
    () => "[]",
  );
  return (
    <main className="p-4">
      <h1>Goal form fixture</h1>
      <GoalCreateDialog />
      <GoalDeleteDialog goal={{ id: "fixture-goal", title: "My measured carry" }} />
      <output aria-label="Goal calls">{result}</output>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
