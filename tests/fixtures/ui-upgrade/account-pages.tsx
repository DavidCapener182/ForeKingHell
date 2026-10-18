import { createRoot } from "react-dom/client";
import { useState } from "react";
import { SettingsWorkspace } from "../../../src/app/settings/settings-workspace";
import { AccountRouteError } from "../../../src/app/settings/account-route-error";
import { BillingHistory } from "../../../src/app/billing/billing-history";

function Fixture() {
  const [retries, setRetries] = useState(0);
  return (
    <div className="grid min-w-0 gap-6 p-4">
      <p>SYNTHETIC ACCOUNT PAGE FIXTURE — no account, payment or administrator operations</p>
      <SettingsWorkspace
        initialSection={null}
        items={[
          {
            id: "general",
            label: "Account",
            description: "Profile settings",
            content: (
              <label>
                Fixture display name
                <input aria-label="Fixture display name" defaultValue="Synthetic golfer" />
              </label>
            ),
          },
          {
            id: "privacy",
            label: "Privacy",
            description: "Visibility choices",
            content: <p>Fixture privacy details</p>,
          },
        ]}
      />
      <AccountRouteError
        title="Your plan could not load"
        description="Review saved status before repeating a payment."
        retry={() => setRetries((value) => value + 1)}
        href="/settings?section=billing"
        label="Back to account settings"
      />
      <p role="status">Fixture retries: {retries}</p>
      <BillingHistory rows={[]} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
