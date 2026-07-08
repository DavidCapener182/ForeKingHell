import { GolfRouteLoading } from "@/components/golf-loading";

export default function CourseRecordsLoading() {
  return (
    <GolfRouteLoading
      title="Loading record boards"
      subtitle="Checking proof tiers, course filters, friend boards, and records worth chasing next."
      variant="courseRecords"
    />
  );
}
