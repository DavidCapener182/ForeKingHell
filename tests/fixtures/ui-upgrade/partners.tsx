import { createRoot } from "react-dom/client";
import { PartnerCreationForms } from "@/app/partners/partner-creation-forms";
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <PartnerCreationForms sponsors={[{ id: "exact-sponsor-id", name: "Synthetic sponsor" }]} />
  </main>,
);
