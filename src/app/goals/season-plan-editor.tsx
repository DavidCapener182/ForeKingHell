"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSeasonPlanWithStateAction } from "./actions";
import type { SeasonPlan } from "@/lib/product-preferences-model";
import { DraftForm } from "@/components/untitled-ui/draft-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function SeasonPlanEditor({ plan }: { plan: SeasonPlan }) {
  const [editing, setEditing] = useState(false);
  const id = useId();
  const router = useRouter();
  if (!editing)
    return (
      <Button variant="outline" className="min-h-11" onClick={() => setEditing(true)}>
        Edit season plan
      </Button>
    );
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-4 text-xl font-semibold">Edit season plan</h2>
      <DraftForm
        action={saveSeasonPlanWithStateAction}
        submitLabel="Save season plan"
        onCancel={() => setEditing(false)}
        onSuccess={() => {
          setEditing(false);
          router.refresh();
        }}
      >
        {[
          {
            name: "outcome",
            label: "Season outcome",
            value: plan.outcome,
            type: "text",
            maxLength: 160,
          },
          {
            name: "targetDate",
            label: "Target date",
            value: plan.targetDate,
            type: "date",
            optional: true,
          },
          { name: "focus", label: "Primary focus", value: plan.focus, type: "text", maxLength: 80 },
          {
            name: "weeklySessions",
            label: "Measured sessions per week",
            value: plan.weeklySessions,
            type: "number",
            min: 1,
            max: 7,
          },
          {
            name: "successMeasure",
            label: "What success looks like",
            value: plan.successMeasure,
            type: "text",
            maxLength: 180,
          },
        ].map((field) => (
          <div key={field.name}>
            <Label htmlFor={`${id}-${field.name}`}>{field.label}</Label>
            <Input
              id={`${id}-${field.name}`}
              name={field.name}
              type={field.type}
              defaultValue={field.value}
              required={!field.optional}
              min={field.min}
              max={field.max}
              maxLength={field.maxLength}
              className="mt-2 min-h-11"
            />
          </div>
        ))}
      </DraftForm>
    </section>
  );
}
