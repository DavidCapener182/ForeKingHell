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
const adminModerationSource = readFileSync(
  join(process.cwd(), "src/app/(admin)/admin/moderation/page.tsx"),
  "utf8",
);

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
    expect(adminUsersSource).toContain("AdminConfirmSubmitButton");
    expect(adminUsersSource).toContain("Deactivate admin access");
    expect(adminUsersSource).toContain("writes an audit entry");

    expect(adminModerationSource).toContain("AdminConfirmSubmitButton");
    expect(adminModerationSource).toContain("AdminBulkActionSubmit");
    expect(adminModerationSource).toContain("Resolve selected reports");
    expect(adminModerationSource).toContain('Resolve ${isReport ? "report" : "moderation event"}');
    expect(adminModerationSource).toContain("writes an admin audit entry");
  });
});
