import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
  join(process.cwd(), "src/components/app/confirm-submit-button.tsx"),
  "utf8",
);
const adminUsersSource = readFileSync(
  join(process.cwd(), "src/app/(admin)/admin/users/page.tsx"),
  "utf8",
);
const adminUserActionsSource = readFileSync(
  join(process.cwd(), "src/app/admin/admin-user-actions.tsx"),
  "utf8",
);
const adminModerationSource = readFileSync(
  join(process.cwd(), "src/app/(admin)/admin/moderation/page.tsx"),
  "utf8",
);
const operationSource = readFileSync(
  join(process.cwd(), "src/app/admin/admin-operation-form.tsx"),
  "utf8",
);
const queueSource = readFileSync(join(process.cwd(), "src/app/admin/moderation-queue.tsx"), "utf8");

describe("confirm submit button", () => {
  it("uses an accessible in-app confirmation dialog instead of a browser prompt", () => {
    expect(componentSource).toContain("DialogContent");
    expect(componentSource).toContain("DialogTitle");
    expect(componentSource).toContain("DialogDescription");
    expect(componentSource).toContain("requestSubmit(buttonRef.current)");
    expect(componentSource).toContain('data-confirm-submit="true"');
    expect(componentSource).toContain("confirmedClickRef");
    expect(componentSource).not.toContain("window.confirm");
  });

  it("guards admin destructive actions with clear confirmation copy", () => {
    expect(adminUsersSource).toContain("<AdminUserDirectory");
    expect(adminUserActionsSource).toContain('operation="deactivate-admin"');
    expect(adminUserActionsSource).toContain("The player account and golf data remain.");
    expect(adminUserActionsSource).toContain("<AdminOperationForm");
    expect(operationSource).toContain("setReview(data)");
    expect(operationSource).toContain("Cancel review");
    expect(operationSource).toContain("Confirm ${title.toLowerCase()}");
    expect(operationSource).toContain("await adminFormAction({ ok: false }, review)");
    expect(operationSource).toContain("if (busy.current) return");
    expect(adminModerationSource).toContain("<ModerationQueue");
    expect(queueSource).toContain("Only these reviewed records are submitted.");
    expect(queueSource).toContain("Underlying user content is not deleted.");
    expect(queueSource).toContain("Confirm selected resolution");
    expect(queueSource).toContain("for (const row of review)");
    expect(queueSource).toContain(
      'data.append(kind === "report" ? "reportId" : "eventId", row.id)',
    );
    expect(queueSource).toContain("if (lock.current || !review) return");
    expect(queueSource).toContain("typeof result.resolvedCount");
  });
});
