"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";

export function PbMetricToggle({ label }: { label: string }) {
  const query = useSearchParams();
  const ready = useClientReady();
  const selected = query.get("metric") === "total" ? "total" : "carry";

  function select(metric: "carry" | "total") {
    if (metric === selected) return;
    const next = new URLSearchParams(window.location.search);
    next.set("metric", metric);
    window.history.pushState(null, "", `?${next.toString()}${window.location.hash}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label={label}
        className="inline-flex gap-1 rounded-xl border border-border bg-muted p-1"
      >
        {(["carry", "total"] as const).map((metric) => (
          <Button
            key={metric}
            type="button"
            variant={selected === metric ? "default" : "ghost"}
            aria-pressed={selected === metric}
            disabled={!ready}
            className="min-h-11"
            onClick={() => select(metric)}
          >
            {metric === "carry" ? "Carry PB" : "Total PB"}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {selected === "carry"
          ? "Distance through the air, before the first bounce."
          : "Distance including roll after landing."}
      </p>
    </div>
  );
}
