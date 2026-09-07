"use client";
import { type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
export function LongestEvidenceViews({ carry, total }: { carry: ReactNode; total: ReactNode }) {
  const query = useSearchParams();
  return (
    <div data-pb-evidence-metric={query.get("metric") === "total" ? "total" : "carry"}>
      {query.get("metric") === "total" ? total : carry}
    </div>
  );
}
