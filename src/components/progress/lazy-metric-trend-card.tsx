"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { MetricTrendPoint } from "@/components/app/metric-trend-card";
import { cn } from "@/lib/utils";

type LazyMetricTrendCardProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  delta?: ReactNode;
  direction?: "up" | "down" | "neutral";
  points?: MetricTrendPoint[];
  threshold?: number;
  className?: string;
};
type DeferredMetricTrendCardProps = LazyMetricTrendCardProps & { onLoaded: () => void };

const DeferredMetricTrendCard = dynamic<DeferredMetricTrendCardProps>(
  () =>
    import("@/components/app/metric-trend-card").then((module) => {
      const MetricTrendCard = module.MetricTrendCard;

      return function LoadedMetricTrendCard({ onLoaded, ...props }: DeferredMetricTrendCardProps) {
        useEffect(() => {
          onLoaded();
        }, [onLoaded]);

        return <MetricTrendCard {...props} />;
      };
    }),
  {
    loading: () => null,
  },
);

export function LazyMetricTrendCard(props: LazyMetricTrendCardProps) {
  const [loaded, setLoaded] = useState(false);
  const revealContent = useCallback(() => setLoaded(true), []);

  return (
    <div
      className={cn("t-skel", loaded && "is-revealed")}
      data-state={loaded ? "loaded" : "loading"}
      aria-busy={!loaded}
      data-lazy-metric-trend-boundary
    >
      <MetricTrendCardSkeleton hidden={loaded} />
      <div className="t-skel-content" aria-hidden={!loaded} inert={!loaded}>
        <DeferredMetricTrendCard {...props} onLoaded={revealContent} />
      </div>
    </div>
  );
}

function MetricTrendCardSkeleton({ hidden }: { hidden: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading measured progress trend"
      aria-hidden={hidden}
      className="t-skel-skeleton grid min-h-36 gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      data-lazy-metric-trend-card
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
