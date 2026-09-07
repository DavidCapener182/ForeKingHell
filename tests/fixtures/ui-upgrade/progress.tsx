import { createRoot } from "react-dom/client";
import { ProgressComparison } from "../../../src/app/progress/progress-comparison";
import { ProgressSnapshot } from "../../../src/app/progress/progress-snapshot";
import { TimelineStory } from "../../../src/app/progress/progress-timeline";
import { ProgressTabs } from "../../../src/app/progress/progress-tabs";
import { UntitledPageHeader } from "../../../src/components/untitled-ui/headers";
import type { ComparisonClub } from "../../../src/app/progress/progress-comparison-data";
const clubs: ComparisonClub[] = [
  {
    clubId: "coastal-7i",
    name: "7 iron · Coastal exceptionally long custom fitted club name with preserved source identity",
    observations: [
      {
        sessionId: "before",
        date: "2026-08-01T12:00:00Z",
        count: 10,
        carry: 150,
        total: 165,
        side: 4,
        counts: { carry: 10, total: 10, side: 10 },
      },
      {
        sessionId: "latest",
        date: "2026-09-01T12:00:00Z",
        count: 10,
        carry: 150,
        total: null,
        side: 4,
        counts: { carry: 10, total: 0, side: 10 },
      },
    ],
  },
  { clubId: "empty-driver", name: "Driver · No measured shots", observations: [] },
];
createRoot(document.getElementById("root")!).render(
  <main className="grid w-full min-w-0 gap-5 p-4">
    <UntitledPageHeader title="Progress" description="Current evidence" />
    <ProgressTabs
      panels={{
        performance: (
          <>
            <ProgressSnapshot score={0} cleanShots={20} />
            <ProgressComparison clubs={clubs} />
          </>
        ),
        goals: <p>Saved goal fixture</p>,
        load: <p>Measured training fixture</p>,
        timeline: (
          <TimelineStory
            items={Array.from({ length: 15 }, (_, index) => ({
              id: `event-${index}`,
              category: index % 2 ? "Round" : "Practice",
              dateLabel: "6 Sept 2026",
              sortTime: 1788696000000,
              title: "Repeated session title with distinct saved identity",
              detail: `Source event ${index + 1}`,
              href: `/sessions/event-${index}`,
            }))}
          />
        ),
      }}
    />
  </main>,
);
