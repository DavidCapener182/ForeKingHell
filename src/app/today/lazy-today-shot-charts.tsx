"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { TodayShotCharts } from "./today-shot-charts";

// Deeper shot inspection follows the shared progress answer. Keep its interactive
// bundle separate, as the companion surface already does for its shot patterns.
const Charts = dynamic(() => import("./today-shot-charts").then((m) => m.TodayShotCharts), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Drawing measured shot patterns"
      className="h-64 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
    />
  ),
});
export function LazyTodayShotCharts(props: ComponentProps<typeof TodayShotCharts>) {
  return <Charts {...props} />;
}
