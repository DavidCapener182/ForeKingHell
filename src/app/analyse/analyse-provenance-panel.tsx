"use client";

import { useState } from "react";
import { Database } from "lucide-react";

import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";

export function AnalyseProvenancePanel({
  trustedShots,
  sessions,
  usefulSessions,
  activeClubs,
  coveredClubs,
  excludedShots,
  dateRange,
  explanation,
  components,
}: {
  trustedShots: number;
  sessions: number;
  usefulSessions: number;
  activeClubs: number;
  coveredClubs: number;
  excludedShots: number;
  dateRange: string;
  explanation: string;
  components: Array<{
    key: string;
    label: string;
    assessment: "limited" | "mixed" | "healthy";
  }>;
}) {
  const [open, setOpen] = useState(false);

  const rows = [
    ["Trusted shots", trustedShots.toLocaleString("en-GB")],
    [
      "Useful sessions",
      `${usefulSessions.toLocaleString("en-GB")} of ${sessions.toLocaleString("en-GB")}`,
    ],
    [
      "Bag coverage",
      `${coveredClubs.toLocaleString("en-GB")} of ${activeClubs.toLocaleString("en-GB")} active clubs`,
    ],
    ["Excluded rows", excludedShots.toLocaleString("en-GB")],
    ["Date range", dateRange],
    ["Source", "Measured launch-monitor imports and session history"],
  ];

  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={setOpen}
      title="Evidence and calculation details"
      description="The measured coverage and confidence inputs behind this Performance Lab read."
      trigger={
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-emerald-100/20 bg-[#0b2a1d] text-white shadow-none hover:border-emerald-100/35 hover:bg-[#123c2b] hover:text-white"
        >
          <Database className="size-4" aria-hidden />
          Evidence & calculation
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
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Confidence inputs
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {components.map((component) => (
            <div
              key={component.key}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span>{component.label}</span>
              <span className="capitalize text-muted-foreground">{component.assessment}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 border-l-2 border-primary pl-3 text-sm leading-6 text-muted-foreground">
        {explanation}
      </p>
    </ResponsiveDetailPanel>
  );
}
