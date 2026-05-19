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
    <>
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
      />
      <div className="px-4 pb-24 sm:px-6 lg:px-8">
        <ProviderHealthFeaturePanel data={featureData} />
      </div>
    </>
  );
}
