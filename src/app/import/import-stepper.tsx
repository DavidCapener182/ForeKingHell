"use client";

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

import { CompactReadoutGrid } from "@/components/premium";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ImportStepper({
  isCourseUpload,
  hasFiles,
  hasShots,
  hasCourseMapping,
  hasWarnings,
  canSave,
}: {
  isCourseUpload: boolean;
  hasFiles: boolean;
  hasShots: boolean;
  hasCourseMapping: boolean;
  hasWarnings: boolean;
  canSave: boolean;
}) {
  const steps = [
    { label: "Upload", detail: hasFiles ? "CSV selected" : "Choose CSV", complete: hasFiles },
    { label: "Confirm", detail: "Session settings", complete: hasFiles },
    {
      label: "Review",
      detail: isCourseUpload ? "Shots + round map" : "Shot preview",
      complete: hasShots && hasCourseMapping,
    },
    {
      label: "Save",
      detail: canSave ? "Ready" : hasWarnings ? "Warnings" : "Waiting",
      complete: canSave,
    },
  ];

  return (
    <Card className="shadow-sm" data-import-stepper>
      <CardContent className="p-4">
        <CompactReadoutGrid
          columnsClassName="sm:grid-cols-4"
          items={steps.map((step, index) => ({
            label: `Step ${index + 1}`,
            value: step.label,
            detail: step.detail,
            tone: step.complete ? "green" : "slate",
          }))}
        />
      </CardContent>
    </Card>
  );
}

export function ChecklistItem({ complete, children }: { complete: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2
        className={cn(
          "size-4",
          complete ? "text-[var(--status-success-foreground)]" : "text-muted-foreground",
        )}
      />
      <span className={complete ? "font-medium" : "text-muted-foreground"}>{children}</span>
    </div>
  );
}
