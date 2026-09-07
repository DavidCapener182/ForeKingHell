import type { OperationStep } from "@/components/app/operation-stepper";
export function TournamentRoundProgress({ steps }: { steps: OperationStep[] }) {
  const completed = steps.filter((step) => step.status === "complete").length;
  return (
    <div className="mt-4 grid gap-3">
      <label className="grid gap-2 text-sm">
        {completed}/{steps.length} rounds submitted
        <progress
          aria-label="Submitted tournament rounds"
          value={completed}
          max={steps.length || 1}
          className="h-2 w-full accent-primary"
        />
      </label>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <li
            key={step.id}
            aria-current={step.status === "current" ? "step" : undefined}
            className="rounded-lg border p-3"
          >
            <p className="font-medium">{step.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
