"use client";
import type { ReactNode } from "react";
import { CheckCircle2, Circle, AlertCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImportStepper({
  hasFiles,
  hasShots,
  hasCourseMapping,
  hasWarnings,
  canSave,
  isPending = false,
  saved = false,
  error = false,
  settingsConfirmed = false,
  isCourseUpload,
}: {
  isCourseUpload: boolean;
  hasFiles: boolean;
  hasShots: boolean;
  hasCourseMapping: boolean;
  hasWarnings: boolean;
  canSave: boolean;
  isPending?: boolean;
  saved?: boolean;
  error?: boolean;
  settingsConfirmed?: boolean;
}) {
  const active = saved
    ? 3
    : !hasFiles
      ? 0
      : !settingsConfirmed
        ? 1
        : !hasShots || !hasCourseMapping || hasWarnings
          ? 2
          : 3;
  const steps = [
    { label: "Choose files", href: "#import-files" },
    { label: "Confirm settings", href: "#import-settings" },
    { label: isCourseUpload ? "Review shots and holes" : "Review shots", href: "#import-preview" },
    { label: "Save import", href: "#import-save" },
  ];
  return (
    <nav
      aria-label="Current import progress"
      className="rounded-xl border border-border bg-card p-3"
      data-import-stepper
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold" role="status">
          {saved ? "Import saved" : `Step ${active + 1} of 4 · ${steps[active].label}`}
          {isPending ? " · Saving…" : error ? " · Needs attention" : ""}
        </p>
        {active > 0 ? (
          <a
            href={steps[active - 1].href}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to {steps[active - 1].label.toLowerCase()}
          </a>
        ) : null}
      </div>
      <details className="mt-1">
        <summary className="min-h-11 cursor-pointer py-3 text-sm text-muted-foreground">
          View all steps
        </summary>
        <ol className="grid gap-2 sm:grid-cols-4">
          {steps.map((step, index) => {
            const complete = saved || index < active;
            const failed = error && index === active;
            return (
              <li key={step.label}>
                <a
                  href={step.href}
                  aria-current={index === active && !saved ? "step" : undefined}
                  className="flex min-h-11 items-start gap-2 rounded-lg p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {failed ? (
                    <AlertCircle size={18} className="shrink-0 text-destructive" aria-hidden />
                  ) : complete ? (
                    <CheckCircle2 size={18} className="shrink-0 text-primary" aria-hidden />
                  ) : (
                    <Circle size={18} aria-hidden className="shrink-0" />
                  )}
                  <span>
                    {step.label}
                    <span className="block text-xs text-muted-foreground">
                      {failed
                        ? "Needs attention"
                        : complete
                          ? "Complete"
                          : index === active
                            ? canSave
                              ? "Ready to save"
                              : "Current"
                            : "Pending"}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </details>
    </nav>
  );
}
export function ChecklistItem({ complete, children }: { complete: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {complete ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className={cn("text-sm", complete ? "font-medium" : "text-muted-foreground")}>
        {children}
        <span className="sr-only">: {complete ? "Ready" : "Needs review"}</span>
      </span>
    </div>
  );
}
