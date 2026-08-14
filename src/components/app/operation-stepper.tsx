import { Check, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type OperationStep = {
  id: string;
  label: string;
  description?: string;
  status: "complete" | "current" | "upcoming" | "error";
};

export function OperationStepper({
  steps,
  label = "Workflow progress",
  compact = false,
  className,
}: {
  steps: OperationStep[];
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const completed = steps.filter((step) => step.status === "complete").length;
  const current = steps.some((step) => step.status === "current") ? 1 : 0;
  const progress = steps.length
    ? Math.min(100, ((completed + current * 0.5) / steps.length) * 100)
    : 0;

  return (
    <section
      aria-label={label}
      className={cn(
        "grid gap-3 rounded-xl border bg-card p-3",
        compact && "gap-2 p-2.5",
        className,
      )}
      data-operation-stepper
    >
      <Progress
        value={progress}
        aria-label={`${label}: ${Math.round(progress)}%`}
        className="h-1.5"
      />
      <ol
        className="grid grid-cols-[repeat(var(--step-count),minmax(0,1fr))] gap-1"
        style={{ "--step-count": steps.length } as React.CSSProperties}
      >
        {steps.map((step, index) => (
          <li
            key={step.id}
            data-workflow-status={step.status}
            aria-current={step.status === "current" ? "step" : undefined}
            className="min-w-0"
          >
            <div className="flex items-center">
              <Badge
                variant={
                  step.status === "complete"
                    ? "default"
                    : step.status === "error"
                      ? "destructive"
                      : "outline"
                }
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full p-0 text-[11px] font-bold shadow-none",
                  step.status === "current" &&
                    "border-primary bg-primary/10 text-primary ring-2 ring-primary/15",
                  step.status === "upcoming" && "bg-muted text-muted-foreground",
                )}
              >
                {step.status === "complete" ? (
                  <Check className="size-3.5" aria-hidden />
                ) : step.status === "error" ? (
                  <CircleAlert className="size-3.5" aria-hidden />
                ) : (
                  index + 1
                )}
              </Badge>
              {index < steps.length - 1 ? (
                <Separator className="mx-1 min-w-0 flex-1 data-horizontal:w-auto" aria-hidden />
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs font-semibold">{step.label}</p>
            {!compact && step.description ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                {step.description}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
