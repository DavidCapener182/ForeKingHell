"use client";

import { AccountRouteError } from "@/app/settings/account-route-error";

export default function BillingError({ retry }: { retry: () => void }) {
  return (
    <AccountRouteError
      title="Your plan could not load"
      description="Load your saved plan again before repeating a checkout or subscription change. This error does not confirm whether a payment or account change completed."
      retry={retry}
      href="/settings?section=billing"
      label="Back to account settings"
    />
  );
}
