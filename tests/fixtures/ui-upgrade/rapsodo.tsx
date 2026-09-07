import { createRoot } from "react-dom/client";
import { RapsodoSyncClient } from "@/app/rapsodo/rapsodo-sync-client";
createRoot(document.getElementById("root")!).render(
  <RapsodoSyncClient initialStatus={{ connected: false, expiresAt: null, profile: null }} />,
);
