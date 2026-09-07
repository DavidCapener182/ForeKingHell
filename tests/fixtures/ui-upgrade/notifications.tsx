import React from "react";
import { createRoot } from "react-dom/client";
import { NotificationCentre } from "../../../src/components/app/workbench/notification-centre";

createRoot(document.getElementById("root")!).render(
  <main style={{ padding: 16 }}>
    <h1>Notification fixture</h1>
    <NotificationCentre embedded />
  </main>,
);
