"use client";

import { AccountRouteError } from "@/app/settings/account-route-error";

export default function SettingsError({ retry }: { retry: () => void }) {
  return (
    <AccountRouteError
      title="Settings could not load"
      description="Try loading your account settings again. If you had submitted a change, check the saved value before repeating it. Unsaved edits may need to be entered again."
      retry={retry}
      href="/dashboard"
      label="Back to your golf"
    />
  );
}
