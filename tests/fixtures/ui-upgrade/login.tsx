import { createRoot } from "react-dom/client";
import { LoginForm } from "@/app/login/login-form";
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <LoginForm next="/billing?from=fixture" />
  </main>,
);
