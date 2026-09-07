import { createRoot } from "react-dom/client";
import { AdminLifetimeGrant } from "@/app/admin/admin-lifetime-grant";
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <AdminLifetimeGrant />
  </main>,
);
