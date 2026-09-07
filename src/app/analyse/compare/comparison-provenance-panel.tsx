"use client";

import { useState, useSyncExternalStore } from "react";
import { Info } from "lucide-react";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";

type ProvenanceMetric = {
  key: string;
  label: string;
  source: string;
  method: string;
  confidenceLabel: string;
};

export function ComparisonProvenancePanel({ metrics }: { metrics: ProvenanceMetric[] }) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);

  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={setOpen}
      title="How this comparison was calculated"
      description="Source, method and confidence for every selected result."
      footer={
        <Button variant="outline" onClick={() => setOpen(false)}>
          Close evidence
        </Button>
      }
      trigger={
        <Button type="button" variant="outline" size="sm" disabled={!ready}>
          <Info className="size-4" aria-hidden="true" />
          Evidence & method
        </Button>
      }
    >
      <div className="grid gap-4">
        {metrics.map((metric) => (
          <section key={metric.key} className="grid gap-2 rounded-lg border p-4">
            <h3 className="font-semibold">{metric.label}</h3>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-medium">Source</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                  {metric.source}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Method</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                  {metric.method}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Confidence</dt>
                <dd>{metric.confidenceLabel}</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
    </ResponsiveDetailPanel>
  );
}
