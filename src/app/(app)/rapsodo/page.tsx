import { RapsodoSyncClient } from "@/app/rapsodo/rapsodo-sync-client";
import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import { ProviderHealthFeaturePanel } from "@/components/features/feature-panels";
import { getFeatureIdeasData } from "@/lib/feature-ideas";

export const dynamic = "force-dynamic";

export default async function RapsodoPage() {
  const [status, featureData] = await Promise.all([
    getRapsodoConnectionStatusAction(),
    getFeatureIdeasData(),
  ]);

  return (
    <RapsodoSyncClient
      initialStatus={
        status.ok
          ? status.data
          : {
              connected: false,
              expiresAt: null,
              profile: null,
            }
      }
    >
      <div className="pb-16">
        <ProviderHealthFeaturePanel data={featureData} />
      </div>
    </RapsodoSyncClient>
  );
}
