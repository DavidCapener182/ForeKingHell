import { createRoot } from "react-dom/client";
import { WelcomeJourney } from "@/app/welcome/welcome-journey";
const available = !location.search.includes("unavailable");
createRoot(document.getElementById("root")!).render(
  <WelcomeJourney
    journey={{
      available,
      established: false,
      dismissed: false,
      completedCount: available ? 1 : 0,
      firstTrustedResult: null,
      steps: available
        ? [
            {
              id: "source",
              title: "Choose a launch-monitor source",
              description: "Saved source",
              href: "/providers",
              complete: true,
            },
            {
              id: "import",
              title: "Import your first measured session",
              description: "Keep original evidence",
              href: "/import",
              complete: false,
            },
          ]
        : [],
    }}
  />,
);
