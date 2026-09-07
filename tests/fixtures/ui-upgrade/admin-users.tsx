import { createRoot } from "react-dom/client";
import { AdminUserDirectory } from "@/app/admin/admin-user-actions";
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <AdminUserDirectory
      currentUserId="actor"
      canManageOwners
      order="created_desc"
      users={[
        {
          id: "target",
          displayName: "Synthetic target player",
          email: "target@example.invalid",
          username: "targetplayer",
          activePlan: "free",
          sessionCount: 7,
          feedCount: 3,
          adminRole: null,
          adminStatus: null,
          createdLabel: "01 Jan 2026",
          auditEvents: [],
        },
      ]}
    />
  </main>,
);
