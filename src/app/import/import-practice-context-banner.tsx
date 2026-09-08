import { isObservationOnlyPracticePlan, type SavedPracticePlan } from "@/lib/practice-planner";

export function ImportPracticeContextBanner({ plan }: { plan: SavedPracticePlan | null }) {
  if (!plan) return null;
  return (
    <p
      data-import-practice-context
      className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
    >
      Evidence for {plan.title}.{" "}
      {isObservationOnlyPracticePlan(plan)
        ? "This plan records observations; uploads will not automatically score it."
        : "After saving, eligible measured evidence can be matched and scored against this plan."}
    </p>
  );
}
