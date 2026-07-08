import { GolfRouteLoading } from "@/components/golf-loading";

export default function CourseRecordBoardLoading() {
  return (
    <GolfRouteLoading
      title="Loading course records"
      subtitle="Preparing course boards, proof tiers, friend toggles, personal bests, and chaseable gaps."
      variant="courseRecords"
    />
  );
}
