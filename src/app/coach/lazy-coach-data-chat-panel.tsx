"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DataChatPanel = dynamic(
  () => import("@/app/data-chat/data-chat-panel").then((module) => module.DataChatPanel),
  {
    loading: () => (
      <div className="grid gap-3" role="status" aria-label="Loading Data Chat">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[28rem] w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    ),
  },
);

export function LazyCoachDataChatPanel({ monthlyRemaining }: { monthlyRemaining: number }) {
  return (
    <DataChatPanel
      monthlyRemaining={monthlyRemaining}
      questionId="coach-data-chat-question"
      embedded
      suggestions={[
        "Explain the main diagnosis",
        "Show me the source records",
        "Compare my last three sessions",
        "Build a 30-ball practice plan",
      ]}
    />
  );
}
