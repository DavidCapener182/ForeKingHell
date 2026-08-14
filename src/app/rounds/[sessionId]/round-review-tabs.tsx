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
      <TabsList
        variant="line"
        className="w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Round review sections"
      >
        <TabsTrigger value="summary" className="shrink-0">
          Summary
        </TabsTrigger>
        <TabsTrigger value="scorecard" className="shrink-0">
          Scorecard
        </TabsTrigger>
        <TabsTrigger value="map" className="shrink-0">
          Map
        </TabsTrigger>
        <TabsTrigger value="evidence" className="shrink-0">
          Evidence
        </TabsTrigger>
        <TabsTrigger value="corrections" className="shrink-0">
          Corrections
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
