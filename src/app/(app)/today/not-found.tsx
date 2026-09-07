import { TodayHydrationBoundary } from "@/components/app/today-hydration-boundary";
import { RouteNotFoundState } from "@/components/route-state";

export default function NotFound() {
  return (
    <>
      <RouteNotFoundState />
      <TodayHydrationBoundary />
    </>
  );
}
