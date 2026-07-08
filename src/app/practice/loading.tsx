import { GolfRouteLoading } from "@/components/golf-loading";

export default function PracticeLoading() {
  return (
    <GolfRouteLoading
      title="Loading practice planner"
      subtitle="Preparing plan blocks, latest session evidence, checklist state, and coach context."
      variant="practice"
    />
  );
}
