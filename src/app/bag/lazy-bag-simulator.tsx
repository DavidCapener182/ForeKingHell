"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { BagSimulatorClub } from "@/lib/bag-simulator";
import { cn } from "@/lib/utils";

type BagSimulatorProps = { clubs: BagSimulatorClub[] };
type DeferredBagSimulatorProps = BagSimulatorProps & { onLoaded: () => void };

const DeferredBagSimulator = dynamic<DeferredBagSimulatorProps>(
  () =>
    import("@/app/bag/bag-simulator").then((module) => {
      const BagSimulator = module.BagSimulator;

      return function LoadedBagSimulator({ onLoaded, ...props }: DeferredBagSimulatorProps) {
        useEffect(() => {
          onLoaded();
        }, [onLoaded]);

        return <BagSimulator {...props} />;
      };
    }),
  {
    loading: () => null,
  },
);

export function LazyBagSimulator({ clubs }: { clubs: BagSimulatorClub[] }) {
  const [loaded, setLoaded] = useState(false);
  const revealContent = useCallback(() => setLoaded(true), []);

  return (
    <div
      className={cn("t-skel", loaded && "is-revealed")}
      data-state={loaded ? "loaded" : "loading"}
      aria-busy={!loaded}
      data-lazy-bag-simulator-boundary
    >
      <BagSimulatorSkeleton hidden={loaded} />
      <div className="t-skel-content" aria-hidden={!loaded} inert={!loaded}>
        <DeferredBagSimulator clubs={clubs} onLoaded={revealContent} />
      </div>
    </div>
  );
}

function BagSimulatorSkeleton({ hidden }: { hidden: boolean }) {
  return (
    <section
      role="status"
      aria-label="Loading bag simulator"
      aria-hidden={hidden}
      className="t-skel-skeleton grid gap-4 rounded-2xl border border-border bg-card p-4"
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
