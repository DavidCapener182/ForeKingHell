"use client";
import { type ReactNode } from "react";
import { PbMetricToggle } from "./pb-metric-toggle";
import { useSearchParams } from "next/navigation";
export function LongestEvidenceViews({ carry, total }: { carry: ReactNode; total: ReactNode }) {
  const query = useSearchParams();
  return (
    <div data-pb-evidence-metric={query.get("metric") === "total" ? "total" : "carry"}>
      <div className="mb-4">
        <PbMetricToggle label="Evidence PB distance" />
      </div>
      {query.get("metric") === "total" ? total : carry}
    </div>
  );
}
