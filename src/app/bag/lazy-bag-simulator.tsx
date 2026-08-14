"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { BagSimulatorClub } from "@/lib/bag-simulator";

const DeferredBagSimulator = dynamic<{ clubs: BagSimulatorClub[] }>(
  () => import("@/app/bag/bag-simulator").then((module) => module.BagSimulator),
  {
    loading: () => <BagSimulatorSkeleton />,
  },
);

export function LazyBagSimulator({ clubs }: { clubs: BagSimulatorClub[] }) {
  return <DeferredBagSimulator clubs={clubs} />;
}

function BagSimulatorSkeleton() {
  return (
    <section
      role="status"
      aria-label="Loading bag simulator"
      className="grid gap-4 rounded-2xl border border-border bg-card p-4"
      data-lazy-bag-simulator
    >
      <div className="grid gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-9 w-40" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </section>
  );
}
