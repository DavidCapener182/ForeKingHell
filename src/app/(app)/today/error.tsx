"use client";

import { TodayHydrationBoundary } from "@/components/app/today-hydration-boundary";

import { SegmentErrorState } from "@/components/segment-error-state";

export default function TodayError(props: React.ComponentProps<typeof SegmentErrorState>) {
  return (
    <>
      <SegmentErrorState {...props} />
      <TodayHydrationBoundary />
    </>
  );
}
