import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import { RapsodoSyncClient } from "@/app/rapsodo/rapsodo-sync-client";
import { ProviderHealthFeaturePanel } from "@/components/features/feature-panels";
import { getFeatureIdeasData } from "@/lib/feature-ideas";

export default async function RapsodoWorkbenchPage() {
  const [status, featureData] = await Promise.all([
    getRapsodoConnectionStatusAction(),
    getFeatureIdeasData(),
  ]);
  const initialStatus = status.ok
    ? status.data
    : { connected: false, expiresAt: null, profile: null };

  return (
    <RapsodoSyncClient initialStatus={initialStatus}>
      <div className="pb-16">
        <ProviderHealthFeaturePanel data={featureData} />
      </div>
    </RapsodoSyncClient>
  );
}
