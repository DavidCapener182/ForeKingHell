import { GolfRouteLoading } from "@/components/golf-loading";

export default function CourseHolesLoading() {
  return (
    <GolfRouteLoading
      title="Loading hole workspace"
      subtitle="Preparing mapped holes, tee geometry, yardages, source confidence, and editable hole data."
      variant="courses"
    />
  );
}
