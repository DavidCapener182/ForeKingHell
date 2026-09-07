import { createRoot } from "react-dom/client";
import { FullPlanCheckout } from "@/app/billing/billing-checkout";
import { BillingManageDialog } from "@/app/billing/billing-manage-dialog";
import { BillingHistory } from "@/app/billing/billing-history";
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <FullPlanCheckout
      plan={{ key: "pro", monthlyPrice: "£12.99", yearlyPrice: "£119" }}
      availability={{ monthly: true, yearly: true }}
    />
    <BillingManageDialog />
    <BillingHistory
      rows={[
        {
          id: "one",
          plan: "Full",
          status: "Active",
          period: "01 Jan 2026 – 01 Jan 2027",
          renewal: "Scheduled to continue",
          date: "2026-01-01",
        },
      ]}
    />
  </main>,
);
