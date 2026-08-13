"use client";

import { useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type RoundReviewView = "summary" | "scorecard" | "map" | "evidence" | "corrections";

export function RoundReviewTabs({
  value,
  sessionId,
}: {
  value: RoundReviewView;
  sessionId: string;
}) {
  const router = useRouter();

  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => {
        const params = new URLSearchParams(window.location.search);
        params.set("view", nextValue);
        router.replace(`/rounds/${sessionId}?${params.toString()}`, { scroll: false });
      }}
      data-round-review-tabs
    >
      <TabsList variant="line" aria-label="Round review sections">
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
        <TabsTrigger value="map">Map</TabsTrigger>
        <TabsTrigger value="evidence">Evidence</TabsTrigger>
        <TabsTrigger value="corrections">Corrections</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
