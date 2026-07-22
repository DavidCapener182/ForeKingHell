import { GolfRouteLoading } from "@/components/golf-loading";

export default function SettingsLoading() {
  return (
    <GolfRouteLoading
      title="Loading settings"
      subtitle="Preparing account, privacy, units, display, data access, and platform controls."
      variant="settings"
    />
  );
}
