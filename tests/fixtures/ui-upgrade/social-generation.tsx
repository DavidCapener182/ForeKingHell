import { createRoot } from "react-dom/client";
import { SocialTaskForm } from "@/app/social-intelligence/social-task-form";
createRoot(document.getElementById("root")!).render(
  <main style={{ padding: 20 }}>
    <SocialTaskForm task="generate" sourceCount={8} sourcePeriod="1–7 September 2026" />
  </main>,
);
