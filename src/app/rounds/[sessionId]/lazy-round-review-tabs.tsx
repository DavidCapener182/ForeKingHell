"use client";

import dynamic from "next/dynamic";

import type { RoundReviewView } from "@/app/rounds/[sessionId]/round-review-tabs";

const RoundReviewTabs = dynamic(
  () =>
    import("@/app/rounds/[sessionId]/round-review-tabs").then((module) => module.RoundReviewTabs),
  {
    ssr: false,
    loading: () => <div className="h-9 border-b border-border" aria-hidden />,
  },
);

export function LazyRoundReviewTabs({
  value,
  sessionId,
}: {
  value: RoundReviewView;
  sessionId: string;
}) {
  return <RoundReviewTabs value={value} sessionId={sessionId} />;
}
