"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { MetricTrendPoint } from "@/components/app/metric-trend-card";

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

const DeferredMetricTrendCard = dynamic<LazyMetricTrendCardProps>(
  () => import("@/components/app/metric-trend-card").then((module) => module.MetricTrendCard),
  {
    loading: () => <MetricTrendCardSkeleton />,
  },
);

export function LazyMetricTrendCard(props: LazyMetricTrendCardProps) {
  return <DeferredMetricTrendCard {...props} />;
}

function MetricTrendCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading measured progress trend"
      className="grid min-h-36 gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
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
