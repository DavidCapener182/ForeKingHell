"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useState, type ComponentProps } from "react";
import type { DistanceBenchmarkPanel as BenchmarkComponent } from "./distance-benchmark-panel";
import type { ClubIntelligencePanel as IntelligenceComponent } from "./club-intelligence-panel";
import type { TargetDistanceSelector as TargetComponent } from "./target-distance-selector";
import type { QuickBagClient as QuickBagComponent } from "@/app/quick-bag/quick-bag-client";

const loading = () => <p role="status">Loading bag tools…</p>;
const Benchmark = dynamic(
  () => import("./distance-benchmark-panel").then((m) => m.DistanceBenchmarkPanel),
  { loading },
);
const Intelligence = dynamic(
  () => import("./club-intelligence-panel").then((m) => m.ClubIntelligencePanel),
  { loading },
);
const Target = dynamic(
  () => import("./target-distance-selector").then((m) => m.TargetDistanceSelector),
  { loading },
);
const QuickBag = dynamic(
  () => import("@/app/quick-bag/quick-bag-client").then((m) => m.QuickBagClient),
  { loading },
);

// The page preserves visited tab contents; these tools follow the same lifecycle
// without downloading workflows for sections the player has not opened.
function useVisited(tab: "clubs" | "evidence") {
  const query = useSearchParams();
  const selected =
    query.get("tab") ??
    (query.get("view") === "target"
      ? "clubs"
      : query.get("mobile") === "benchmarks"
        ? "evidence"
        : "distances");
  const active = selected === tab;
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return active || visited;
}
export function LazyDistanceBenchmarkPanel(props: ComponentProps<typeof BenchmarkComponent>) {
  return useVisited("evidence") ? <Benchmark {...props} /> : null;
}
export function LazyClubIntelligencePanel(props: ComponentProps<typeof IntelligenceComponent>) {
  return useVisited("clubs") ? <Intelligence {...props} /> : null;
}
export function LazyTargetDistanceSelector(props: ComponentProps<typeof TargetComponent>) {
  return useVisited("clubs") ? <Target {...props} /> : null;
}
export function LazyQuickBagClient(props: ComponentProps<typeof QuickBagComponent>) {
  return useVisited("clubs") ? <QuickBag {...props} /> : null;
}
