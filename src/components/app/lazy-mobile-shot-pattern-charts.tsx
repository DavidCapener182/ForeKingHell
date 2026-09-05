"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { MobileShotPatternCharts } from "./mobile-shot-pattern-charts";
const Charts = dynamic(
  () => import("./mobile-shot-pattern-charts").then((module) => module.MobileShotPatternCharts),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Drawing measured shot pattern"
        className="aspect-[82/43] rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
      />
    ),
  },
);
export function LazyMobileShotPatternCharts(props: ComponentProps<typeof MobileShotPatternCharts>) {
  return <Charts {...props} />;
}
