import { GolfRouteLoading } from "@/components/golf-loading";

export default function EquipmentLoading() {
  return (
    <GolfRouteLoading
      title="Loading equipment history"
      subtitle="Checking current bag, club changes, before/after comparisons, and impact notes."
      variant="equipment"
    />
  );
}
