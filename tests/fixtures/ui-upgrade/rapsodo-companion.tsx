import { createRoot } from "react-dom/client";
import { RapsodoCompanionClient } from "@/app/rapsodo/rapsodo-companion-client";
createRoot(document.getElementById("root")!).render(
  <RapsodoCompanionClient
    initialStatus={{ connected: false, expiresAt: null, profile: null }}
    practicePlanId="fixture-plan-123"
  />,
);
