import { billingPlans } from "@/lib/billing-plan-catalog";
import { createRoot } from "react-dom/client";
import { FullPlanCheckout } from "@/app/billing/billing-checkout";
import { BillingManageDialog } from "@/app/billing/billing-manage-dialog";
import { BillingHistory } from "@/app/billing/billing-history";
const selectedPlan =
  billingPlans.find(
    (plan) => plan.key === new URLSearchParams(window.location.search).get("plan"),
  ) ?? billingPlans.find((plan) => plan.key === "pro")!;
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <FullPlanCheckout plan={selectedPlan} availability={{ monthly: true, yearly: true }} />
    <BillingManageDialog />
    <BillingHistory
      rows={[
        {
          id: "one",
          plan: "Pro",
          status: "Active",
          period: "01 Jan 2026 – 01 Jan 2027",
          renewal: "Scheduled to continue",
          date: "2026-01-01",
        },
      ]}
    />
  </main>,
);
