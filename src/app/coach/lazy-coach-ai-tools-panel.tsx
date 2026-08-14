"use client";

import dynamic from "next/dynamic";

import type { CoachAiToolsPanelProps } from "@/app/coach/coach-ai-tools-panel";
import { Skeleton } from "@/components/ui/skeleton";

const CoachAiToolsPanel = dynamic(
  () => import("@/app/coach/coach-ai-tools-panel").then((module) => module.CoachAiToolsPanel),
  {
    loading: () => (
      <div className="grid gap-4" role="status" aria-label="Loading coach tools">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    ),
  },
);

export function LazyCoachAiToolsPanel(props: CoachAiToolsPanelProps) {
  return <CoachAiToolsPanel {...props} />;
}
