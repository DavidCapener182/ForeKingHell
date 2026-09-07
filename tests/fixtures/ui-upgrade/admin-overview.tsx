import { createRoot } from "react-dom/client";
import { AdminNavigation } from "@/app/admin/admin-navigation";
import { AdminAttention } from "@/app/admin/admin-attention";
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <AdminNavigation active="/admin" />
    <AdminAttention
      rows={[
        {
          id: "unknown",
          area: "System verification",
          status: "unverified",
          statusLabel: "Unverified",
          evidence:
            "No live CI, RLS or automated test result is connected. This is not a healthy state.",
          href: "/admin/system-checks",
          action: "View register",
        },
        {
          id: "billing",
          area: "Billing",
          status: "failure",
          statusLabel: "2 failed states",
          evidence: "2 subscriptions need review in the database snapshot.",
          href: "/admin/billing",
          action: "Open billing",
        },
      ]}
    />
  </main>,
);
