import { GolfRouteLoading } from "@/components/golf-loading";

export default function CoursesLoading() {
  return (
    <GolfRouteLoading
      title="Loading course library"
      subtitle="Preparing course search, mapped holes, source health, records, and recent round context."
      variant="courses"
    />
  );
}
