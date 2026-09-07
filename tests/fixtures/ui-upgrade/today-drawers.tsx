import { createRoot } from "react-dom/client";
import { TodayPrimaryAnswer } from "@/components/app/today-primary-answer";
import { MobileTodayChangeDetail } from "@/components/app/mobile-today-change";
createRoot(document.getElementById("root")!).render(
  <main>
    <TodayPrimaryAnswer
      accountId="isolated-today-drawer"
      serverState={{
        eyebrow: "Practice",
        title: "Practise 7i",
        reason: "Owned measured evidence",
        status: "Moderate",
        tone: "positive",
        href: "/practice",
        action: "Start practice",
      }}
      facts={[]}
      evidenceContent={<p>Exact owned shot evidence</p>}
    />
    <MobileTodayChangeDetail
      change={{
        clubLabel: "7 iron",
        delta: 5,
        latest: {
          value: 155,
          count: 6,
          dateLabel: "Today",
          sessions: [
            {
              id: "latest",
              label: "Latest owned session",
              count: 6,
              date: "Today",
              href: "/sessions/latest",
            },
          ],
        },
        previous: {
          value: 150,
          count: 6,
          sessions: [
            {
              id: "earlier",
              label: "Earlier owned session",
              count: 6,
              date: "Earlier",
              href: "/sessions/earlier",
            },
          ],
        },
      }}
    />
  </main>,
);
