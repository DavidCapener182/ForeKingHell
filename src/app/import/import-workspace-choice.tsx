"use client";
import { useState } from "react";
import { CompanionRangeImport } from "./companion-range-import";
import { ImportForm } from "./import-form";
import { Button } from "@/components/ui/button";
import type { DistanceUnit } from "@/lib/rapsodo/parser";

export function ImportWorkspaceChoice({
  practicePlanId,
  defaultDistanceUnit,
  sample = false,
}: {
  practicePlanId: string | null;
  defaultDistanceUnit: DistanceUnit;
  sample?: boolean;
}) {
  const [full, setFull] = useState(sample);
  return (
    <div className="grid min-w-0 gap-4">
      <div role="group" aria-label="Import workflow" className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={full ? "outline" : "default"}
          aria-pressed={!full}
          onClick={() => setFull(false)}
          className="min-h-11 whitespace-normal"
        >
          Quick range import
        </Button>
        <Button
          type="button"
          variant={full ? "default" : "outline"}
          aria-pressed={full}
          onClick={() => setFull(true)}
          className="min-h-11 whitespace-normal"
        >
          Full import workflow
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Full workflow includes multiple files, all session types, column mapping and scorecard
        review. Each workspace retains its draft when you switch.
      </p>
      <div hidden={full}>
        <CompanionRangeImport practicePlanId={practicePlanId} />
      </div>
      <div hidden={!full}>
        <ImportForm
          defaultDistanceUnit={defaultDistanceUnit}
          startWithSampleData={sample}
          practicePlanId={practicePlanId}
        />
      </div>
    </div>
  );
}
