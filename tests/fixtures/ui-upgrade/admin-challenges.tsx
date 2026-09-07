import { createRoot } from "react-dom/client";
import { AdminChallengeTemplates } from "@/app/admin/admin-challenge-templates";
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <AdminChallengeTemplates
      templates={[
        {
          id: "template-identity",
          slug: "synthetic-drive",
          name: "Synthetic drive",
          description: "Complete stored description",
          challengeType: "longest_drive",
          rulesJson: { minShots: 5 },
          scoringDirection: "desc",
          active: true,
          createdAt: "2026-09-07",
          updatedAt: "2026-09-07T00:00:00.000Z",
          referenceCount: 1,
        },
      ]}
    />
  </main>,
);
