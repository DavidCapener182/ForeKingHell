"use client";

import { useState } from "react";
import { Database } from "lucide-react";

import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";

export function AnalyseProvenancePanel({
  trustedShots,
  sessions,
  activeClubs,
  excludedShots,
  dateRange,
  explanation,
}: {
  trustedShots: number;
  sessions: number;
  activeClubs: number;
  excludedShots: number;
  dateRange: string;
  explanation: string;
}) {
  const [open, setOpen] = useState(false);

  const rows = [
    ["Trusted shots", trustedShots.toLocaleString("en-GB")],
    ["Session coverage", sessions.toLocaleString("en-GB")],
    ["Active clubs", activeClubs.toLocaleString("en-GB")],
    ["Excluded rows", excludedShots.toLocaleString("en-GB")],
    ["Date range", dateRange],
    ["Source", "Measured launch-monitor imports and session history"],
  ];

  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={setOpen}
      title="Metric provenance"
      description="The measured coverage behind the Analyse overview."
      trigger={
        <Button type="button" variant="outline" className="min-h-11">
          <Database className="size-4" aria-hidden />
          View metric provenance
        </Button>
      }
    >
      <dl className="grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-muted/30 px-3 py-2">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-l-2 border-primary pl-3 text-sm leading-6 text-muted-foreground">
        {explanation}
      </p>
    </ResponsiveDetailPanel>
  );
}
