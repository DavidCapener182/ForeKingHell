import { RapsodoSyncClient } from "@/app/rapsodo/rapsodo-sync-client";
import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";

export const dynamic = "force-dynamic";

export default async function RapsodoPage() {
  const status = await getRapsodoConnectionStatusAction();

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
    />
  );
}
