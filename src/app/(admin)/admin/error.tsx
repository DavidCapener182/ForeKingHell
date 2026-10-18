"use client";

import { AccountRouteError } from "@/app/settings/account-route-error";

export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <AccountRouteError
      title="Admin records could not load"
      description="Try loading this page again. If you were submitting an operation, check its saved record before repeating it; this error does not confirm the outcome."
      retry={retry}
      href="/dashboard"
      label="Back to your golf"
    />
  );
}
